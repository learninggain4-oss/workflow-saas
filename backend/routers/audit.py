"""Platform-wide audit log reads.

Owner-only via utils.is_owner_user, the same gate /api/admin/users uses. An
audit trail is the most sensitive table in the app - it holds every user's IP
address and user agent - so it is not board-scoped and not readable by ordinary
administrators.

Pagination is keyset, not OFFSET. An audit table only ever grows, and OFFSET
makes page N re-scan every newer row, so a user paging to page 5 of a log that
is still receiving writes silently skips or repeats events. The cursor is
(created_at, id): created_at alone is not unique at one-second resolution.
"""
from datetime import datetime, timedelta, timezone

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from core import get_current_user, get_db, models
from utils import audit_health, is_owner_user


router = APIRouter()

MAX_LIMIT = 200
DEFAULT_LIMIT = 50
TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S"


def _parse_ts(value, field):
    if not value:
        return None
    try:
        return datetime.strptime(value, TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"{field} must look like 'YYYY-MM-DD HH:MM:SS'.",
        )


def _as_list(raw, allowed, field):
    if not raw:
        return None
    values = [v.strip() for v in str(raw).split(",") if v.strip()]
    bad = [v for v in values if v not in allowed]
    if bad:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported {field}: {', '.join(bad)}. Allowed: {', '.join(sorted(allowed))}.",
        )
    return values or None


def _serialize(row):
    try:
        details = json.loads(row.details or "{}")
    except (TypeError, ValueError):
        details = {}
    return {
        "id": row.id,
        "created_at": row.created_at,
        "actor_user_id": row.actor_user_id,
        "actor_email": row.actor_email,
        "actor_name": row.actor_name,
        # A system event has no user behind it, and the UI must not present a
        # missing actor as a named person.
        "is_system": row.actor_user_id is None,
        "event_type": row.event_type,
        "action": row.action,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "target_label": row.target_label,
        "ip_address": row.ip_address,
        "user_agent": row.user_agent,
        "severity": row.severity,
        "outcome": row.outcome,
        "board_id": row.board_id,
        "details": details,
    }


def _apply_filters(query, *, event_type, family, severities, outcomes,
                   actor_email, board_id, since, until, search):
    if event_type:
        query = query.filter(models.AuditEvent.event_type == event_type)
    if family:
        query = query.filter(models.AuditEvent.event_type.like(f"{family}.%"))
    if severities:
        query = query.filter(models.AuditEvent.severity.in_(severities))
    if outcomes:
        query = query.filter(models.AuditEvent.outcome.in_(outcomes))
    if actor_email:
        query = query.filter(models.AuditEvent.actor_email.ilike(f"%{actor_email}%"))
    if board_id is not None:
        query = query.filter(models.AuditEvent.board_id == board_id)
    if since:
        query = query.filter(models.AuditEvent.created_at >= since.strftime(TIMESTAMP_FORMAT))
    if until:
        # Inclusive of the whole day when only a date was supplied.
        edge = until if until.hour or until.minute or until.second else until + timedelta(days=1)
        query = query.filter(models.AuditEvent.created_at < edge.strftime(TIMESTAMP_FORMAT))
    if search:
        needle = f"%{search}%"
        query = query.filter(
            or_(
                models.AuditEvent.action.ilike(needle),
                models.AuditEvent.target_label.ilike(needle),
                models.AuditEvent.actor_name.ilike(needle),
                models.AuditEvent.event_type.ilike(needle),
            )
        )
    return query


@router.get("/api/audit/health")
def audit_health_endpoint(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Write-health for the audit pipeline itself.

    An audit trail is only worth anything if you can tell that a line is missing
    because nothing happened rather than because the write failed. This is that
    signal: a non-zero `failed` or a non-zero `pending_replay` means events are
    missing and being retried, not that nothing happened.
    """
    if not is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")
    health = audit_health(db)
    health["healthy"] = health["failed"] == 0 and (health["pending_replay"] or 0) == 0
    return health


@router.get("/api/audit")
def list_audit_events(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor_created_at: str = Query("", description="Keyset cursor: created_at of the last row seen"),
    cursor_id: int = Query(0, description="Keyset cursor: id of the last row seen"),
    event_type: str = Query(""),
    family: str = Query("", description="Event family prefix, e.g. 'auth' or 'task'"),
    severity: str = Query("", description="Comma separated: info,notice,warning,critical"),
    outcome: str = Query("", description="Comma separated: success,failure,denied"),
    actor_email: str = Query(""),
    board_id: int = Query(None),
    from_date: str = Query("", description="'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS', UTC"),
    to_date: str = Query("", description="Inclusive when a bare date is given"),
    search: str = Query(""),
):
    if not is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")

    severities = _as_list(severity, {"info", "notice", "warning", "critical"}, "severity")
    outcomes = _as_list(outcome, {"success", "failure", "denied"}, "outcome")

    since = _parse_ts(_coerce_day(from_date, start=True), "from_date")
    until = _parse_ts(_coerce_day(to_date, start=False), "to_date")
    if since and until and since > until:
        raise HTTPException(status_code=422, detail="from_date must not be after to_date.")

    base = _apply_filters(
        db.query(models.AuditEvent),
        event_type=event_type or None,
        family=family or None,
        severities=severities,
        outcomes=outcomes,
        actor_email=actor_email or None,
        board_id=board_id,
        since=since,
        until=until,
        search=search or None,
    )

    # Keyset: strictly older than (cursor_created_at, cursor_id).
    page_query = base
    if cursor_created_at and cursor_id:
        cursor_ts = _parse_ts(cursor_created_at, "cursor_created_at")
        page_query = page_query.filter(
            or_(
                models.AuditEvent.created_at < cursor_ts.strftime(TIMESTAMP_FORMAT),
                (models.AuditEvent.created_at == cursor_ts.strftime(TIMESTAMP_FORMAT))
                & (models.AuditEvent.id < cursor_id),
            )
        )

    # Fetch one extra row to learn whether another page exists without a
    # second COUNT.
    rows = (
        page_query.order_by(models.AuditEvent.created_at.desc(), models.AuditEvent.id.desc())
        .limit(limit + 1)
        .all()
    )
    has_more = len(rows) > limit
    rows = rows[:limit]

    last = rows[-1] if rows else None
    next_cursor = (
        {"created_at": last.created_at, "id": last.id} if has_more and last else None
    )

    return {
        "items": [_serialize(r) for r in rows],
        "next_cursor": next_cursor,
        "has_more": has_more,
        "total": base.count(),
        "limit": limit,
        "summary": _summary(db),
    }


def _coerce_day(value, start):
    """Accept a bare date as well as a full timestamp."""
    value = (value or "").strip()
    if not value:
        return None
    if len(value) == 10:
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return value  # let _parse_ts produce the error message
        return parsed.strftime(TIMESTAMP_FORMAT) if start else (
            parsed + timedelta(days=1) - timedelta(seconds=1)
        ).strftime(TIMESTAMP_FORMAT)
    return value


def _summary(db):
    """Header tiles. Deliberately global, not filter-scoped: 'events today'
    is a statement about the platform, not about the current filter."""
    today = datetime.now(timezone.utc).date().strftime("%Y-%m-%d")
    tomorrow = (datetime.now(timezone.utc).date() + timedelta(days=1)).strftime("%Y-%m-%d")

    events_today = db.query(models.AuditEvent).filter(
        models.AuditEvent.created_at >= today,
        models.AuditEvent.created_at < tomorrow,
    ).count()

    by_severity = {
        row[0]: row[1]
        for row in db.query(models.AuditEvent.severity, func.count(models.AuditEvent.id))
        .group_by(models.AuditEvent.severity)
        .all()
    }
    by_outcome = {
        row[0]: row[1]
        for row in db.query(models.AuditEvent.outcome, func.count(models.AuditEvent.id))
        .group_by(models.AuditEvent.outcome)
        .all()
    }
    top_types = [
        {"event_type": row[0], "count": row[1]}
        for row in db.query(models.AuditEvent.event_type, func.count(models.AuditEvent.id))
        .group_by(models.AuditEvent.event_type)
        .order_by(func.count(models.AuditEvent.id).desc())
        .limit(5)
        .all()
    ]
    distinct_actors = db.query(func.count(func.distinct(models.AuditEvent.actor_email))).scalar() or 0

    return {
        "events_today": events_today,
        "critical": by_severity.get("critical", 0),
        "warning": by_severity.get("warning", 0),
        "failed": by_outcome.get("failure", 0),
        "denied": by_outcome.get("denied", 0),
        "by_severity": by_severity,
        "by_outcome": by_outcome,
        "top_event_types": top_types,
        "distinct_actors": distinct_actors,
    }
