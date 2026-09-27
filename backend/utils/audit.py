import json
import os
import traceback
from datetime import datetime, timedelta, timezone

import models
from database import SessionLocal

from .timestamp import audit_now_str, now_str


AUDIT_COUNTERS = {
    "written": 0, "failed": 0, "drained": 0,
    "last_failure_at": "", "last_error": "",
}


def log_activity_safe(board_id, user_name, action, task_id=None):
    try:
        db2 = SessionLocal()
        db2.add(models.Activity(board_id=board_id, user_name=user_name, action=action, created_at=now_str(), task_id=task_id))
        db2.commit()
        db2.close()
    except Exception:
        pass


def log_audit_event(event_type, action, *, actor_user_id=None, actor_email="", actor_name="",
                    target_type="", target_id="", target_label="", ip_address="",
                    user_agent="", severity="info", outcome="success", board_id=None,
                    details=None, db=None, actor=None, request=None):
    """Record one audit event.

    `actor=` takes a User row and fills the three actor columns; `request=` takes
    a Starlette request and fills ip_address and user_agent. Both are
    conveniences - anything passed explicitly wins, so a caller can override the
    address (a job with no request, or a known proxy hop).

    Mirrors log_activity_safe: an audit write must never roll back or fail the
    business action it is describing, so failures are swallowed - but not
    discarded. Each attempt gets one immediate retry (transient lock and
    serialization errors are common), and a final failure is written to
    audit_write_failures for drain_audit_failures to replay. Losing an audit line
    is bad; losing the user's work because auditing broke is worse; and losing
    both without a trace is unacceptable.

    Accepts an explicit session (db=) so a caller that already has one does not
    open a second connection mid-transaction; otherwise a short-lived one is
    used, matching log_activity_safe. Pass db= only when the audit row should
    share the caller's fate - a success path. On a path that raises, omitting db
    keeps the row from being rolled back with the error.
    """
    try:
        if actor is not None:
            actor_user_id = actor_user_id if actor_user_id is not None else getattr(actor, "id", None)
            actor_email = actor_email or getattr(actor, "email", "") or ""
            actor_name = actor_name or getattr(actor, "name", "") or ""
        if request is not None:
            if not ip_address:
                ip_address = client_ip(request)
            if not user_agent:
                user_agent = request.headers.get("user-agent", "") or ""

        payload = json.dumps(details or {}, default=str)
        fields = dict(
            created_at=audit_now_str(),
            actor_user_id=actor_user_id,
            actor_email=(actor_email or "")[:320],
            actor_name=(actor_name or "")[:160],
            event_type=(event_type or "system.unknown")[:120],
            action=(action or "")[:500],
            target_type=(target_type or "")[:80],
            target_id=str(target_id or "")[:160],
            target_label=(target_label or "")[:300],
            ip_address=(ip_address or "")[:64],
            user_agent=(user_agent or "")[:500],
            severity=severity if severity in ("info", "notice", "warning", "critical") else "info",
            outcome=outcome if outcome in ("success", "failure", "denied") else "success",
            board_id=board_id,
            details=payload,
        )
        last_error = None
        for _attempt in (1, 2):
            try:
                if db is not None:
                    db.add(models.AuditEvent(**fields))
                else:
                    own = SessionLocal()
                    try:
                        own.add(models.AuditEvent(**fields))
                        own.commit()
                    finally:
                        own.close()
                AUDIT_COUNTERS["written"] += 1
                return
            except Exception as exc:
                last_error = exc
                if db is not None:
                    db.rollback()

        _record_audit_failure(fields, last_error, event_type, action)
    except Exception as exc:
        _record_audit_failure({"event_type": event_type, "action": action}, exc, event_type, action)


def _record_audit_failure(fields, error, event_type, action):
    """Persist a failed audit write so it can be replayed rather than lost."""
    AUDIT_COUNTERS["failed"] += 1
    AUDIT_COUNTERS["last_failure_at"] = audit_now_str()
    AUDIT_COUNTERS["last_error"] = str(error)[:500]
    try:
        db2 = SessionLocal()
        try:
            db2.add(models.AuditWriteFailure(
                created_at=audit_now_str(),
                event_type=(event_type or "")[:120],
                action=(action or "")[:500],
                payload=json.dumps(fields, default=str),
                error=str(error)[:1000],
                attempts=1,
            ))
            db2.commit()
        finally:
            db2.close()
    except Exception:
        print(f"[audit] could not even record the write failure for {event_type}", flush=True)


def drain_audit_failures(db, limit=100):
    """Replay buffered audit writes. Returns (recovered, still_failing).

    Called daily by the scheduler. A row that keeps failing stays in place with
    its attempt count incremented, so a permanently bad payload is visible
    instead of being retried forever.
    """
    rows = db.query(models.AuditWriteFailure).order_by(models.AuditWriteFailure.id).limit(limit).all()
    recovered = 0
    still_failing = 0
    for row in rows:
        try:
            fields = row.fields
            if not fields.get("event_type") or not fields.get("created_at"):
                raise ValueError(f"buffered row {row.id} has an unusable payload")
            db.add(models.AuditEvent(**fields))
            db.commit()
            db.delete(row)
            db.commit()
            AUDIT_COUNTERS["drained"] += 1
            recovered += 1
        except Exception as exc:
            db.rollback()
            row.attempts = (row.attempts or 0) + 1
            row.error = str(exc)[:1000]
            try:
                db.commit()
            except Exception:
                db.rollback()
            still_failing += 1
    return recovered, still_failing


def audit_health(db):
    """Counters plus anything still waiting to be replayed."""
    try:
        pending = db.query(models.AuditWriteFailure).count()
    except Exception:
        pending = None
    return {
        "written": AUDIT_COUNTERS["written"],
        "failed": AUDIT_COUNTERS["failed"],
        "drained": AUDIT_COUNTERS["drained"],
        "last_failure_at": AUDIT_COUNTERS["last_failure_at"],
        "last_error": AUDIT_COUNTERS["last_error"],
        "pending_replay": pending,
    }


# --- Network origin (IP address capture) ---

def trusted_proxies():
    """Proxy addresses whose X-Forwarded-For header we are willing to believe.

    Empty by default, which means we believe none of them.
    """
    return {p.strip() for p in os.getenv("TRUSTED_PROXY_IPS", "").split(",") if p.strip()}


def client_ip(request, proxies=None):
    """Best-effort client address for an audit row.

    X-Forwarded-For is supplied by the client: anyone can send it. Trusting it
    unconditionally lets a caller write whatever address they like into the
    audit trail, and in a log that is read as evidence that is forgery, not a
    cosmetic problem.

    So the header is consulted only when the immediate peer is a proxy the
    operator has explicitly trusted, and then only the right-most untrusted
    entry - the address the last proxy actually observed, with trusted hops
    stripped off.

    With TRUSTED_PROXY_IPS unset (the default) this returns the direct peer,
    which behind Render/Railway is the proxy's own address. That is a real
    limitation and it is the safe one: the alternative is trusting a header
    straight from the internet. Set TRUSTED_PROXY_IPS to the proxy's address to
    get real client IPs.

    PREREQUISITE, and this is the part that actually matters: uvicorn rewrites
    request.client from X-Forwarded-For *before* this function runs, whenever
    the peer is in its --forwarded-allow-ips list (default 127.0.0.1). If that
    default is left in place, anything able to reach the app on localhost can
    write any address it likes into the audit trail. Run the app with
    --forwarded-allow-ips set to the real proxy, or with --no-proxy-headers.
    This function is the second layer, not the first.
    """
    peer = ""
    if request is not None and getattr(request, "client", None) is not None:
        peer = request.client.host or ""

    trusted = trusted_proxies() if proxies is None else set(proxies)
    if not trusted or peer not in trusted:
        return peer

    forwarded = ""
    headers = getattr(request, "headers", None)
    if headers is not None:
        forwarded = headers.get("x-forwarded-for", "") or ""
    for candidate in reversed([c.strip() for c in forwarded.split(",") if c.strip()]):
        if candidate not in trusted:
            return candidate
    return peer


def scrub_audit_pii(db, months=12, batch_size=1000):
    """Blank the IP and user agent on audit rows older than the retention window.

    IP address and user agent are personal data under GDPR, so they are kept for
    a bounded window and then removed. Only those two columns are touched: the
    event itself, who did it and what they did remain, which is what an audit
    trail is actually for.

    Batched, and each batch committed, so a large backlog does not hold one
    long transaction. Returns the number of rows scrubbed.
    """
    if months <= 0:
        return 0
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=30 * months)
    ).strftime("%Y-%m-%d %H:%M:%S")

    scrubbed = 0
    while True:
        ids = [
            row[0]
            for row in db.query(models.AuditEvent.id)
            .filter(
                models.AuditEvent.created_at < cutoff,
                (models.AuditEvent.ip_address != "") | (models.AuditEvent.user_agent != ""),
            )
            .limit(batch_size)
            .all()
        ]
        if not ids:
            break
        db.query(models.AuditEvent).filter(models.AuditEvent.id.in_(ids)).update(
            {models.AuditEvent.ip_address: "", models.AuditEvent.user_agent: ""},
            synchronize_session=False,
        )
        db.commit()
        scrubbed += len(ids)
    return scrubbed
