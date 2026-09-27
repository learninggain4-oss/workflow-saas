"""Tests for GET /api/audit.

The two things most likely to be wrong in an audit read API are access control
(it holds every user's IP) and pagination (an audit table only grows, so OFFSET
silently skips or repeats rows). Both are pinned here.
"""
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"
os.environ["AUTOMATION_SCHEDULER"] = "off"

import pytest
from fastapi.testclient import TestClient

import models
import utils
from database import SessionLocal, engine


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(autouse=True)
def clean_database():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for model in (models.AuditEvent, models.Notification, models.Activity, models.Comment,
                      models.Subtask, models.Task, models.BoardMember, models.Board, models.User):
            db.query(model).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


@pytest.fixture
def owner():
    """The first registered user is the owner per utils.is_owner_user."""
    db = SessionLocal()
    try:
        email = _unique_email("owner")
        user = models.User(email=email, name="Owner", password_hash="x", role="administrator")
        db.add(user)
        db.commit()
        db.refresh(user)
        yield {"id": user.id, "email": email, "role": "administrator"}
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(main.app)


def _token(user):
    return {"Authorization": f"Bearer {utils.create_token({'sub': user['email']})}"}


def _event(minutes_ago=0, **overrides):
    stamp = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%d %H:%M:%S")
    fields = dict(
        created_at=stamp,
        actor_user_id=None,
        actor_email="someone@example.test",
        actor_name="Someone",
        event_type="task.created",
        action="Someone created a task",
        target_type="task",
        target_id="task-1",
        target_label="Atlas rollout",
        ip_address="203.0.113.10",
        user_agent="curl/8.5.0",
        severity="info",
        outcome="success",
        board_id=None,
        details="{}",
    )
    fields.update(overrides)
    db = SessionLocal()
    try:
        row = models.AuditEvent(**fields)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    finally:
        db.close()


import main  # noqa: E402  (after the env vars are set)


# ---------------------------------------------------------------- access

def test_the_audit_log_requires_authentication(client):
    assert client.get("/api/audit").status_code in (401, 403)


def test_a_non_owner_is_refused(client, owner):
    """An ordinary administrator must not read every user's IP address."""
    db = SessionLocal()
    try:
        later = models.User(email=_unique_email("admin"), name="Admin",
                            password_hash="x", role="administrator")
        db.add(later)
        db.commit()
        db.refresh(later)
        token = _token({"email": later.email})
    finally:
        db.close()

    resp = client.get("/api/audit", headers=token)
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"] == "Owner access required"


def test_the_owner_can_read_the_log(client, owner):
    _event()
    resp = client.get("/api/audit", headers=_token(owner))
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["items"]) == 1


# ---------------------------------------------------------------- shape

def test_the_response_carries_items_cursor_and_summary(client, owner):
    for i in range(5):
        _event(minutes_ago=i, severity="critical" if i == 0 else "info")
    body = client.get("/api/audit", headers=_token(owner)).json()

    assert len(body["items"]) == 5
    assert body["has_more"] is False
    assert body["next_cursor"] is None
    assert body["total"] == 5

    summary = body["summary"]
    assert summary["critical"] == 1
    assert summary["events_today"] == 5
    assert summary["distinct_actors"] == 1
    assert summary["by_outcome"]["success"] == 5
    assert summary["top_event_types"][0]["event_type"] == "task.created"


def test_system_events_are_flagged_not_shown_as_a_person(client, owner):
    _event(actor_user_id=None, actor_name="System", actor_email="system@example.test")
    item = client.get("/api/audit", headers=_token(owner)).json()["items"][0]
    assert item["is_system"] is True


def test_a_human_event_is_not_flagged_as_system(client, owner):
    _event(actor_user_id=owner["id"], actor_email=owner["email"])
    item = client.get("/api/audit", headers=_token(owner)).json()["items"][0]
    assert item["is_system"] is False


def test_details_are_parsed_into_json(client, owner):
    _event(details=json.dumps({"plan": "pro", "seats": 4}))
    item = client.get("/api/audit", headers=_token(owner)).json()["items"][0]
    assert item["details"] == {"plan": "pro", "seats": 4}


def test_broken_details_do_not_break_the_row(client, owner):
    _event(details="{not json")
    item = client.get("/api/audit", headers=_token(owner)).json()["items"][0]
    assert item["details"] == {}


# ---------------------------------------------------------------- ordering

def test_events_come_back_newest_first(client, owner):
    for i in range(3):
        _event(minutes_ago=i, action=f"event {i}")
    items = client.get("/api/audit", headers=_token(owner)).json()["items"]
    assert [i["action"] for i in items] == ["event 0", "event 1", "event 2"]


# ---------------------------------------------------------------- pagination

def test_keyset_paging_covers_every_row_exactly_once(client, owner):
    """The reason OFFSET is wrong here: new rows must not shift a page."""
    for i in range(25):
        _event(minutes_ago=i, action=f"row-{i:02d}")

    seen = []
    cursor = None
    for _ in range(10):
        params = {"limit": 10}
        if cursor:
            params.update(cursor)
        body = client.get("/api/audit", params=params, headers=_token(owner)).json()
        seen.extend(i["action"] for i in body["items"])
        if not body["has_more"]:
            break
        cursor = {"cursor_created_at": body["next_cursor"]["created_at"],
                  "cursor_id": body["next_cursor"]["id"]}

    assert len(seen) == 25
    assert len(set(seen)) == 25, "a row was repeated"
    assert seen == sorted(seen), "paging changed the order"


def test_the_last_page_reports_no_more(client, owner):
    for i in range(3):
        _event(minutes_ago=i)
    body = client.get("/api/audit", params={"limit": 3}, headers=_token(owner)).json()
    assert len(body["items"]) == 3
    assert body["has_more"] is False
    assert body["next_cursor"] is None


def test_a_partial_page_still_advertises_more(client, owner):
    for i in range(5):
        _event(minutes_ago=i)
    body = client.get("/api/audit", params={"limit": 2}, headers=_token(owner)).json()
    assert len(body["items"]) == 2
    assert body["has_more"] is True
    assert body["next_cursor"] is not None


def test_rows_sharing_a_timestamp_are_not_skipped(client, owner):
    """created_at has one-second resolution, so id is the tiebreaker."""
    stamp = utils.audit_now_str()
    db = SessionLocal()
    try:
        for i in range(4):
            db.add(models.AuditEvent(
                created_at=stamp, actor_email="a@b.test", actor_name="A",
                event_type="task.created", action=f"same-second-{i}",
                severity="info", outcome="success", details="{}",
            ))
        db.commit()
    finally:
        db.close()

    seen = []
    cursor = None
    for _ in range(6):
        params = {"limit": 1}
        if cursor:
            params.update(cursor)
        body = client.get("/api/audit", params=params, headers=_token(owner)).json()
        seen.extend(i["action"] for i in body["items"])
        if not body["has_more"]:
            break
        cursor = {"cursor_created_at": body["next_cursor"]["created_at"],
                  "cursor_id": body["next_cursor"]["id"]}
    assert sorted(seen) == [f"same-second-{i}" for i in range(4)]


# ---------------------------------------------------------------- filters

def test_filter_by_event_family(client, owner):
    _event(event_type="task.created")
    _event(event_type="auth.login")
    _event(event_type="board.created")
    body = client.get("/api/audit", params={"family": "task"}, headers=_token(owner)).json()
    assert [i["event_type"] for i in body["items"]] == ["task.created"]
    assert body["total"] == 1


def test_filter_by_exact_event_type(client, owner):
    _event(event_type="task.created")
    _event(event_type="task.updated")
    body = client.get("/api/audit", params={"event_type": "task.updated"}, headers=_token(owner)).json()
    assert [i["event_type"] for i in body["items"]] == ["task.updated"]


def test_filter_by_severity(client, owner):
    _event(severity="info")
    _event(severity="critical")
    _event(severity="critical")
    body = client.get("/api/audit", params={"severity": "critical"}, headers=_token(owner)).json()
    assert body["total"] == 2
    assert all(i["severity"] == "critical" for i in body["items"])


def test_filter_accepts_several_severities(client, owner):
    _event(severity="info")
    _event(severity="warning")
    _event(severity="critical")
    body = client.get("/api/audit", params={"severity": "warning,critical"}, headers=_token(owner)).json()
    assert body["total"] == 2


def test_filter_by_outcome(client, owner):
    _event(outcome="success")
    _event(outcome="denied")
    body = client.get("/api/audit", params={"outcome": "denied"}, headers=_token(owner)).json()
    assert body["total"] == 1
    assert body["items"][0]["outcome"] == "denied"


def test_filter_by_actor(client, owner):
    _event(actor_email="maya@example.test")
    _event(actor_email="alex@example.test")
    body = client.get("/api/audit", params={"actor_email": "maya"}, headers=_token(owner)).json()
    assert body["total"] == 1


def test_free_text_search_covers_action_and_actor(client, owner):
    _event(action="Maya created Atlas rollout", actor_name="Maya", target_label="Atlas rollout")
    _event(action="Alex deleted Payments revamp", actor_name="Alex", target_label="Payments revamp")
    body = client.get("/api/audit", params={"search": "Atlas"}, headers=_token(owner)).json()
    assert body["total"] == 1
    body = client.get("/api/audit", params={"search": "Alex"}, headers=_token(owner)).json()
    assert body["total"] == 1


def test_filters_combine(client, owner):
    _event(severity="critical", outcome="denied", event_type="security.access_denied")
    _event(severity="critical", outcome="success", event_type="task.created")
    body = client.get("/api/audit",
                      params={"severity": "critical", "outcome": "denied"},
                      headers=_token(owner)).json()
    assert body["total"] == 1
    assert body["items"][0]["event_type"] == "security.access_denied"


def test_total_reflects_the_filters_not_the_page(client, owner):
    for i in range(5):
        _event(severity="warning")
    body = client.get("/api/audit", params={"severity": "warning", "limit": 2}, headers=_token(owner)).json()
    assert len(body["items"]) == 2
    assert body["total"] == 5


# ---------------------------------------------------------------- validation

def test_an_unknown_severity_is_rejected(client, owner):
    resp = client.get("/api/audit", params={"severity": "apocalyptic"}, headers=_token(owner))
    assert resp.status_code == 422, resp.text
    assert "apocalyptic" in resp.json()["detail"]


def test_an_unknown_outcome_is_rejected(client, owner):
    resp = client.get("/api/audit", params={"outcome": "maybe"}, headers=_token(owner))
    assert resp.status_code == 422, resp.text


def test_a_malformed_date_is_rejected(client, owner):
    resp = client.get("/api/audit", params={"from_date": "yesterday"}, headers=_token(owner))
    assert resp.status_code == 422, resp.text


def test_inverted_dates_are_rejected(client, owner):
    resp = client.get("/api/audit",
                      params={"from_date": "2026-09-20", "to_date": "2026-09-01"},
                      headers=_token(owner))
    assert resp.status_code == 422, resp.text
    assert "from_date" in resp.json()["detail"]


def test_limit_is_capped(client, owner):
    resp = client.get("/api/audit", params={"limit": 5000}, headers=_token(owner))
    assert resp.status_code == 422, resp.text


def test_a_bare_end_date_includes_that_whole_day(client, owner):
    today = datetime.now(timezone.utc)
    _event(created_at=today.strftime("%Y-%m-%d 00:00:01"))
    _event(created_at=(today - timedelta(days=3)).strftime("%Y-%m-%d 12:00:00"))
    day = today.strftime("%Y-%m-%d")
    body = client.get("/api/audit", params={"from_date": day, "to_date": day}, headers=_token(owner)).json()
    assert body["total"] == 1, "a bare to_date must include the whole day"


def test_date_range_excludes_older_rows(client, owner):
    today = datetime.now(timezone.utc)
    _event(created_at=today.strftime("%Y-%m-%d 09:00:00"))
    _event(created_at=(today - timedelta(days=10)).strftime("%Y-%m-%d 09:00:00"))
    body = client.get("/api/audit",
                      params={"from_date": (today - timedelta(days=1)).strftime("%Y-%m-%d")},
                      headers=_token(owner)).json()
    assert body["total"] == 1


def test_an_empty_table_is_not_an_error(client, owner):
    body = client.get("/api/audit", headers=_token(owner)).json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["summary"]["events_today"] == 0
    assert body["summary"]["distinct_actors"] == 0
