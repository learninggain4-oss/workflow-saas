"""Tests for audit write durability.

The failure this exists to prevent: a swallowed write makes a missing audit
line indistinguishable from an event that never happened. A deleted project with
no record, and a project nobody deleted, look identical. So a failed write must
be recoverable, countable, and visible.
"""
import json
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"
os.environ["AUTOMATION_SCHEDULER"] = "off"

import pytest

import main
import models
import utils
from database import SessionLocal, engine

# Captured before any monkeypatching, so stubs can delegate to a real session.
REAL_SESSION = SessionLocal


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(autouse=True)
def clean_database():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for model in (models.AuditWriteFailure, models.AuditEvent, models.Notification,
                      models.Activity, models.Comment, models.Subtask, models.Task,
                      models.BoardMember, models.Board, models.User):
            db.query(model).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    utils.AUDIT_COUNTERS.update(
        {"written": 0, "failed": 0, "drained": 0, "last_failure_at": "", "last_error": ""}
    )


def _events():
    db = SessionLocal()
    try:
        return db.query(models.AuditEvent).all()
    finally:
        db.close()


def _failures():
    db = SessionLocal()
    try:
        return db.query(models.AuditWriteFailure).all()
    finally:
        db.close()


class _BadSession:
    """Total outage: nothing can be written. Only the in-process counter survives."""

    def add(self, *_a, **_k):
        return None

    def commit(self):
        raise RuntimeError("database is locked")

    def rollback(self):
        pass

    def close(self):
        pass


class _EventsTableBroken:
    """A realistic partial failure: audit_events rejects writes, everything
    else still works. This is the case where buffering actually rescues an
    event, and the reason the buffer is a separate table.

    Non-AuditEvent writes are delegated to a real session, so a buffered row
    really lands in the database - a stub that only swallowed writes would prove
    nothing.
    """

    def __init__(self):
        self._real = REAL_SESSION()

    def add(self, obj, *_a, **_k):
        if isinstance(obj, models.AuditEvent):
            raise RuntimeError("audit_events is locked")
        self._real.add(obj)

    def commit(self):
        return self._real.commit()

    def rollback(self):
        return self._real.rollback()

    def close(self):
        return self._real.close()


class _ExplodingFields(dict):
    """A payload that cannot even be assembled, to test the outer guard."""

    def __contains__(self, key):
        raise RuntimeError("payload exploded")


# ---------------------------------------------------------------- happy path

def test_a_good_write_is_counted_and_buffered_nothing():
    utils.log_audit_event("task.created", "created a task", actor_email="a@b.test")
    assert len(_events()) == 1
    assert _failures() == []
    assert utils.AUDIT_COUNTERS["written"] == 1
    assert utils.AUDIT_COUNTERS["failed"] == 0


def test_health_reports_healthy_when_nothing_failed():
    utils.log_audit_event("task.created", "ok", actor_email="a@b.test")
    db = SessionLocal()
    try:
        health = utils.audit_health(db)
    finally:
        db.close()
    assert health["failed"] == 0
    assert health["pending_replay"] == 0
    assert health["last_failure_at"] == ""


# ---------------------------------------------------------------- failures

def test_a_failed_write_is_buffered_rather_than_lost(monkeypatch):
    """The core property: the event is recoverable, not merely logged."""
    monkeypatch.setattr(utils, "SessionLocal", lambda: _EventsTableBroken())

    utils.log_audit_event(
        "board.deleted", "Owner deleted project 'Secret'", actor_email="o@b.test",
        target_type="board", target_id="7", target_label="Secret", severity="warning",
    )

    assert _events() == [], "the event should not have been written"
    failures = _failures()
    assert len(failures) == 1, "the failed event was not buffered"
    assert failures[0].event_type == "board.deleted"
    assert "Secret" in failures[0].action
    # The whole event is kept, so it can be replayed verbatim.
    payload = failures[0].fields
    assert payload["target_id"] == "7"
    assert payload["target_label"] == "Secret"
    assert payload["severity"] == "warning"
    assert "audit_events is locked" in failures[0].error


def test_a_total_outage_leaves_only_the_counter():
    """If the database is gone there is nowhere to buffer. The counter is then
    the only evidence, which is why it exists and why it is reported as
    unhealthy rather than swallowed."""
    original = utils.SessionLocal
    utils.SessionLocal = lambda: _BadSession()
    try:
        utils.log_audit_event("board.deleted", "gone", actor_email="o@b.test")
    finally:
        utils.SessionLocal = original

    assert _failures() == [], "nothing could be buffered during a full outage"
    assert utils.AUDIT_COUNTERS["failed"] == 1
    assert utils.AUDIT_COUNTERS["last_failure_at"]
    assert "database is locked" in utils.AUDIT_COUNTERS["last_error"]


def test_a_failure_increments_the_counter():
    original = utils.SessionLocal
    utils.SessionLocal = lambda: _EventsTableBroken()
    try:
        utils.log_audit_event("task.created", "boom", actor_email="a@b.test")
    finally:
        utils.SessionLocal = original
    assert utils.AUDIT_COUNTERS["failed"] == 1
    assert utils.AUDIT_COUNTERS["last_failure_at"]
    assert "audit_events is locked" in utils.AUDIT_COUNTERS["last_error"]


def test_the_write_is_retried_once_before_giving_up(monkeypatch):
    """A transient lock is common; one retry recovers it without buffering."""
    attempts = {"n": 0}
    real = utils.SessionLocal

    def flaky():
        attempts["n"] += 1
        return _BadSession() if attempts["n"] == 1 else real()

    monkeypatch.setattr(utils, "SessionLocal", flaky)
    utils.log_audit_event("task.created", "transient", actor_email="a@b.test")

    assert attempts["n"] == 2, "expected exactly one retry"
    assert len(_events()) == 1, "the retry did not land"
    assert _failures() == [], "a recovered write must not also be buffered"
    assert utils.AUDIT_COUNTERS["failed"] == 0


class _ExplodingActor:
    """An actor whose attributes cannot be read, to exercise the outer guard."""

    @property
    def id(self):
        raise RuntimeError("actor exploded")


def test_a_payload_error_is_still_buffered():
    """A bad argument is a different failure from a dead database, and must not
    escape to the caller."""
    utils.log_audit_event("task.created", "x", actor=_ExplodingActor())
    assert _events() == []
    failures = _failures()
    assert len(failures) == 1, "a malformed event must still be buffered"
    assert failures[0].event_type == "task.created"
    assert utils.AUDIT_COUNTERS["failed"] == 1


def test_health_surfaces_a_pending_failure():
    original = utils.SessionLocal
    utils.SessionLocal = lambda: _EventsTableBroken()
    try:
        utils.log_audit_event("board.deleted", "gone", actor_email="o@b.test")
    finally:
        utils.SessionLocal = original

    db = SessionLocal()
    try:
        health = utils.audit_health(db)
    finally:
        db.close()
    assert health["failed"] == 1
    assert health["pending_replay"] == 1


# ---------------------------------------------------------------- replay

def test_drain_replays_a_buffered_event():
    original = utils.SessionLocal
    utils.SessionLocal = lambda: _EventsTableBroken()
    try:
        utils.log_audit_event("board.deleted", "Owner deleted project 'Secret'",
                              actor_email="o@b.test", target_id="7", severity="warning")
    finally:
        utils.SessionLocal = original
    assert _events() == []

    db = SessionLocal()
    try:
        recovered, still_failing = utils.drain_audit_failures(db)
    finally:
        db.close()

    assert (recovered, still_failing) == (1, 0)
    events = _events()
    assert len(events) == 1
    assert events[0].event_type == "board.deleted"
    assert events[0].target_id == "7"
    assert events[0].severity == "warning"
    assert _failures() == [], "a recovered row must leave the buffer"
    assert utils.AUDIT_COUNTERS["drained"] == 1


def test_drain_on_an_empty_buffer_is_a_no_op():
    db = SessionLocal()
    try:
        assert utils.drain_audit_failures(db) == (0, 0)
    finally:
        db.close()


def test_drain_counts_a_row_that_keeps_failing_and_leaves_it_buffered(monkeypatch):
    # A payload that looks like a real event but carries a column the table does
    # not have: it parses, it is replayable in principle, and the insert fails.
    db = SessionLocal()
    try:
        db.add(models.AuditWriteFailure(
            created_at=utils.audit_now_str(), event_type="task.created",
            action="still broken",
            payload=json.dumps({"created_at": utils.audit_now_str(),
                                "event_type": "task.created", "action": "still broken",
                                "details": "{}", "no_such_column": "x"}),
            error="original", attempts=1,
        ))
        db.commit()
    finally:
        db.close()

    db = SessionLocal()
    try:
        recovered, still_failing = utils.drain_audit_failures(db)
    finally:
        db.close()

    assert recovered == 0
    assert still_failing == 1
    buffered = _failures()
    assert len(buffered) == 1, "a permanently bad row must stay visible, not vanish"
    assert buffered[0].attempts == 2
    assert "no_such_column" in buffered[0].error


def test_a_corrupt_buffer_row_does_not_crash_the_drain():
    db = SessionLocal()
    try:
        db.add(models.AuditWriteFailure(
            created_at=utils.audit_now_str(), event_type="task.created",
            action="unparseable", payload="{not json", error="", attempts=1,
        ))
        db.commit()
    finally:
        db.close()

    db = SessionLocal()
    try:
        recovered, still_failing = utils.drain_audit_failures(db)
    finally:
        db.close()
    assert (recovered, still_failing) == (0, 1)
    assert len(_failures()) == 1


def test_drain_is_bounded_by_the_limit():
    db = SessionLocal()
    try:
        for i in range(7):
            db.add(models.AuditWriteFailure(
                created_at=utils.audit_now_str(), event_type="task.created",
                action=f"event {i}",
                payload=json.dumps({"actor_email": f"u{i}@b.test", "event_type": "task.created",
                                    "action": f"event {i}", "details": "{}",
                                    "created_at": utils.audit_now_str()}),
                error="", attempts=1,
            ))
        db.commit()
    finally:
        db.close()

    db = SessionLocal()
    try:
        recovered, still_failing = utils.drain_audit_failures(db, limit=3)
    finally:
        db.close()
    assert recovered == 3
    assert len(_failures()) == 4, "the batch limit was not respected"


# ---------------------------------------------------------------- endpoint

def test_the_health_endpoint_is_owner_only():
    from fastapi.testclient import TestClient

    db = SessionLocal()
    try:
        # is_owner_user also treats the first registered user as owner, so a
        # non-owner only exists once somebody is ahead of them in the table.
        first = models.User(email=_unique_email("first"), name="First", password_hash="x")
        second = models.User(email=_unique_email("second"), name="Second", password_hash="x",
                             role="administrator")
        db.add(first)
        db.add(second)
        db.commit()
        second_email = second.email
    finally:
        db.close()

    client = TestClient(main.app)
    token = utils.create_token({"sub": second_email})
    resp = client.get("/api/audit/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403, resp.text


def test_the_health_endpoint_reports_unhealthy_on_a_pending_failure():
    from fastapi.testclient import TestClient

    db = SessionLocal()
    try:
        email = _unique_email("owner")
        db.add(models.User(email=email, name="Owner", password_hash="x", role="owner"))
        db.commit()
    finally:
        db.close()

    client = TestClient(main.app)
    token = {"Authorization": f"Bearer {utils.create_token({'sub': email})}"}

    healthy = client.get("/api/audit/health", headers=token)
    assert healthy.status_code == 200, healthy.text
    assert healthy.json()["healthy"] is True

    db = SessionLocal()
    try:
        db.add(models.AuditWriteFailure(created_at=utils.audit_now_str(), event_type="x",
                                        action="y", payload="{}", error="z", attempts=1))
        db.commit()
    finally:
        db.close()

    unhealthy = client.get("/api/audit/health", headers=token)
    assert unhealthy.json()["healthy"] is False
    assert unhealthy.json()["pending_replay"] == 1


# ---------------------------------------------------------------- scheduling

def test_daily_maintenance_replays_even_with_retention_off(monkeypatch):
    """Replay is about evidence, not privacy: it must not be gated on the
    retention setting."""
    monkeypatch.delenv("AUDIT_RETENTION_MONTHS", raising=False)

    original = utils.SessionLocal
    utils.SessionLocal = lambda: _EventsTableBroken()
    try:
        utils.log_audit_event("board.deleted", "Owner deleted project 'X'", actor_email="o@b.test")
    finally:
        utils.SessionLocal = original
    assert _events() == []

    main.run_daily_audit_maintenance()
    assert len(_events()) == 1, "the buffered event was not replayed"
    assert _failures() == []
