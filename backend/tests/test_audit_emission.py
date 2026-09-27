"""Tests for Phase 2: emitting real audit events, and the PII retention job.

The two things that can quietly ruin an audit trail here:
  1. A failed-login row that is rolled back by the 401 it accompanies.
  2. X-Forwarded-For being trusted from an untrusted peer, which lets any caller
     write whatever address they like into the evidence.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"
os.environ["AUTOMATION_SCHEDULER"] = "off"

import pytest
from fastapi.testclient import TestClient

import main
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
def user():
    db = SessionLocal()
    try:
        email = _unique_email("auth")
        row = models.User(email=email, name="Real Person", password_hash=utils.pwd_context.hash("Secret123!"))
        db.add(row)
        db.commit()
        db.refresh(row)
        yield row
    finally:
        db.close()


def _events(event_type=None):
    db = SessionLocal()
    try:
        q = db.query(models.AuditEvent)
        if event_type:
            q = q.filter(models.AuditEvent.event_type == event_type)
        return q.order_by(models.AuditEvent.id).all()
    finally:
        db.close()


# ---------------------------------------------------------------- emitting

def test_a_successful_login_is_recorded(user):
    client = TestClient(main.app)
    resp = client.post("/api/login", data={"username": user.email, "password": "Secret123!"},
                       headers={"User-Agent": "TestAgent/1.0"})
    assert resp.status_code == 200, resp.text

    rows = _events("auth.login")
    assert len(rows) == 1
    row = rows[0]
    assert row.actor_user_id == user.id
    assert row.actor_email == user.email
    assert row.actor_name == "Real Person"
    assert row.outcome == "success"
    assert row.severity == "info"
    assert row.user_agent == "TestAgent/1.0"
    assert row.ip_address, "an IP should be recorded"
    assert "signed in" in row.action


def test_a_failed_login_is_recorded_and_survives_the_401(user):
    """The row must not share the transaction the 401 rolls back."""
    client = TestClient(main.app)
    resp = client.post("/api/login", data={"username": user.email, "password": "wrong-password"},
                       headers={"User-Agent": "BadAgent/2.0"})
    assert resp.status_code == 401

    rows = _events("auth.login_failed")
    assert len(rows) == 1, "the failed sign-in was lost"
    row = rows[0]
    assert row.actor_user_id == user.id
    assert row.outcome == "failure"
    assert row.severity == "warning"


def test_a_failed_login_for_an_unknown_account_is_still_recorded():
    ghost = f"ghost-{uuid.uuid4().hex[:6]}@nowhere.test"
    client = TestClient(main.app)
    resp = client.post("/api/login", data={"username": ghost, "password": "whatever"})
    assert resp.status_code == 401

    rows = _events("auth.login_failed")
    assert len(rows) == 1
    assert rows[0].actor_email == ghost
    assert rows[0].actor_user_id is None, "no user id may be invented"
    assert rows[0].actor_name == ""


def test_the_submitted_password_is_never_recorded(user):
    client = TestClient(main.app)
    client.post("/api/login", data={"username": user.email, "password": "hunter2-very-secret"})
    rows = _events("auth.login_failed")
    assert rows
    blob = " ".join([rows[0].action or "", rows[0].details or "", rows[0].user_agent or ""])
    assert "hunter2-very-secret" not in blob


def test_the_failure_message_does_not_reveal_whether_the_account_exists(user):
    client = TestClient(main.app)
    known = client.post("/api/login", data={"username": user.email, "password": "nope"})
    unknown = client.post("/api/login", data={"username": "nobody@nowhere.test", "password": "nope"})
    assert known.status_code == unknown.status_code == 401
    assert known.json()["detail"] == unknown.json()["detail"]


def test_logins_are_not_double_counted():
    db = SessionLocal()
    try:
        email = _unique_email("count")
        db.add(models.User(email=email, name="C", password_hash=utils.pwd_context.hash("Secret123!")))
        db.commit()
    finally:
        db.close()

    client = TestClient(main.app)
    client.post("/api/login", data={"username": email, "password": "Secret123!"})
    assert len(_events("auth.login")) == 1
    client.post("/api/login", data={"username": email, "password": "Secret123!"})
    assert len(_events("auth.login")) == 2, "one row per sign-in"


# ---------------------------------------------------------------- client ip

class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    def __init__(self, host="10.0.0.1", headers=None):
        self.client = _FakeClient(host)
        self.headers = headers or {}


def test_without_trusted_proxies_the_peer_is_used():
    """Default: believe nothing, record what we actually saw."""
    req = _FakeRequest(host="10.0.0.9", headers={"x-forwarded-for": "1.2.3.4"})
    assert utils.client_ip(req, proxies=set()) == "10.0.0.9"


def test_an_untrusted_peer_cannot_forge_the_address():
    req = _FakeRequest(host="203.0.113.200", headers={"x-forwarded-for": "1.2.3.4"})
    assert utils.client_ip(req, proxies={"10.0.0.1"}) == "203.0.113.200"


def test_a_trusted_proxy_header_is_used():
    req = _FakeRequest(host="10.0.0.1", headers={"x-forwarded-for": "203.0.113.42"})
    assert utils.client_ip(req, proxies={"10.0.0.1"}) == "203.0.113.42"


def test_only_the_rightmost_untrusted_hop_is_taken():
    """A client that prepends fake hops must not be able to hide behind them."""
    req = _FakeRequest(host="10.0.0.1", headers={
        "x-forwarded-for": "9.9.9.9, 8.8.8.8, 203.0.113.42"
    })
    assert utils.client_ip(req, proxies={"10.0.0.1", "8.8.8.8"}) == "203.0.113.42"


def test_a_chain_of_only_trusted_hops_falls_back_to_the_peer():
    req = _FakeRequest(host="10.0.0.1", headers={"x-forwarded-for": "8.8.8.8"})
    assert utils.client_ip(req, proxies={"10.0.0.1", "8.8.8.8"}) == "10.0.0.1"


def test_no_forwarded_header_is_fine():
    req = _FakeRequest(host="10.0.0.1", headers={})
    assert utils.client_ip(req, proxies={"10.0.0.1"}) == "10.0.0.1"


def test_trusted_proxies_reads_the_environment(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "10.0.0.1, 10.0.0.2 ,")
    assert utils.trusted_proxies() == {"10.0.0.1", "10.0.0.2"}


def test_trusted_proxies_is_empty_by_default(monkeypatch):
    monkeypatch.delenv("TRUSTED_PROXY_IPS", raising=False)
    assert utils.trusted_proxies() == set()


def test_a_missing_client_still_returns_something():
    class NoClient:
        client = None
        headers = {}

    assert utils.client_ip(NoClient(), proxies={"10.0.0.1"}) == ""


# ---------------------------------------------------------------- retention

def _row(days_ago, ip="203.0.113.5", agent="Agent/1.0"):
    stamp = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
    db = SessionLocal()
    try:
        row = models.AuditEvent(
            created_at=stamp, actor_email="a@b.test", actor_name="A",
            event_type="auth.login", action="signed in",
            ip_address=ip, user_agent=agent, severity="info",
            outcome="success", details="{}",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    finally:
        db.close()


def test_retention_blanks_pii_past_the_window():
    old = _row(400)
    recent = _row(10)

    db = SessionLocal()
    try:
        assert utils.scrub_audit_pii(db, months=12) == 1
    finally:
        db.close()

    assert _events()[0] is not None
    after = {r.id: r for r in _events()}
    assert after[old.id].ip_address == ""
    assert after[old.id].user_agent == ""
    assert after[recent.id].ip_address == "203.0.113.5", "recent rows must keep their IP"


def test_retention_keeps_the_event_itself():
    old = _row(400)
    utils.scrub_audit_pii(SessionLocal(), months=12)
    row = {r.id: r for r in _events()}[old.id]
    assert row.event_type == "auth.login"
    assert row.actor_email == "a@b.test"
    assert row.action == "signed in"
    assert row.created_at == old.created_at


def test_retention_is_idempotent():
    _row(400)
    db = SessionLocal()
    try:
        assert utils.scrub_audit_pii(db, months=12) == 1
        assert utils.scrub_audit_pii(db, months=12) == 0, "second pass should find nothing"
    finally:
        db.close()


def test_a_zero_or_negative_window_is_a_no_op():
    _row(400)
    db = SessionLocal()
    try:
        assert utils.scrub_audit_pii(db, months=0) == 0
    finally:
        db.close()
    assert _events()[0].ip_address == "203.0.113.5"


def test_retention_batches():
    rows = [_row(400 + i) for i in range(7)]
    db = SessionLocal()
    try:
        assert utils.scrub_audit_pii(db, months=12, batch_size=2) == 7
    finally:
        db.close()
    assert all(r.ip_address == "" for r in _events())


def test_retention_is_off_unless_configured(monkeypatch):
    """A dev or demo database must keep its seeded IPs."""
    monkeypatch.delenv("AUDIT_RETENTION_MONTHS", raising=False)
    old = _row(400)
    main.run_audit_retention()
    assert {r.id: r for r in _events()}[old.id].ip_address == "203.0.113.5"


def test_configured_retention_scrubs(monkeypatch):
    monkeypatch.setenv("AUDIT_RETENTION_MONTHS", "12")
    old = _row(400)
    main.run_audit_retention()
    assert {r.id: r for r in _events()}[old.id].ip_address == ""


def test_an_invalid_retention_setting_is_ignored(monkeypatch):
    monkeypatch.setenv("AUDIT_RETENTION_MONTHS", "twelve months")
    old = _row(400)
    main.run_audit_retention()  # must not raise
    assert {r.id: r for r in _events()}[old.id].ip_address == "203.0.113.5"
