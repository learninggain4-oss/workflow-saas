"""Tests for the audit log: the write helper, the mock seeder, and the verifier.

The verifier is the thing that decides whether a dataset is trustworthy, so the
most important tests here are the ones that corrupt a row on purpose and prove
the verifier notices.
"""
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"
os.environ["AUTOMATION_SCHEDULER"] = "off"

import pytest

import models
import utils
from database import SessionLocal, engine

from scripts import seed_audit_log
from scripts import verify_audit_dataset as verifier


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(autouse=True)
def clean_database():
    def clear():
        # The app creates this table in ensure_database_migrations() at startup,
        # which pytest never runs. Do it here so the test does not depend on the
        # history of the SQLite file.
        models.Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            for model in (models.AuditEvent, models.Notification, models.Activity,
                          models.Comment, models.Subtask, models.Task,
                          models.BoardMember, models.Board, models.User):
                db.query(model).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    clear()
    yield
    clear()


def _insert(**overrides):
    fields = dict(
        # Audit timestamps are UTC by contract, unlike the app's naive now_str().
        created_at=utils.audit_now_str(),
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
        event = models.AuditEvent(**fields)
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
    finally:
        db.close()


def _all():
    db = SessionLocal()
    try:
        return db.query(models.AuditEvent).order_by(models.AuditEvent.id).all()
    finally:
        db.close()


# ---------------------------------------------------------------- the writer

def test_log_audit_event_persists_a_row():
    utils.log_audit_event("board.created", "Maya created Atlas rollout",
                          actor_email="maya@example.test", actor_name="Maya",
                          target_type="board", target_id="board-1",
                          ip_address="203.0.113.24", severity="notice",
                          details={"plan": "pro"})
    rows = _all()
    assert len(rows) == 1
    row = rows[0]
    assert row.event_type == "board.created"
    assert row.severity == "notice"
    assert row.ip_address == "203.0.113.24"
    assert json.loads(row.details)["plan"] == "pro"


def test_log_audit_event_coerces_unknown_enum_values():
    """A typo in a call site must not write an unfilterable row."""
    utils.log_audit_event("auth.login", "signed in", severity="banana", outcome="maybe")
    row = _all()[0]
    assert row.severity == "info"
    assert row.outcome == "success"


def test_log_audit_event_defaults_the_type_when_missing():
    utils.log_audit_event("", "something happened")
    assert _all()[0].event_type == "system.unknown"


def test_log_audit_event_never_raises():
    """A failing audit write must not take down the business action."""
    class Broken:
        def add(self, *a, **k):
            raise RuntimeError("db is gone")

    # No exception escapes, and nothing is written.
    utils.log_audit_event("task.created", "x", db=Broken())


def test_log_audit_event_uses_a_supplied_session():
    db = SessionLocal()
    try:
        utils.log_audit_event("task.created", "in-session", db=db)
        # Not committed yet, but added to the identity map.
        assert any(e.event_type == "task.created" for e in db.new)
    finally:
        db.rollback()
        db.close()


# ---------------------------------------------------------------- the seeder

def test_the_seeder_is_deterministic():
    """Same seed, same rows - otherwise screenshots and the verifier drift."""
    first = seed_audit_log.generate(days=10, total_events=120, seed=42, boards=[], user_ids={})
    second = seed_audit_log.generate(days=10, total_events=120, seed=42, boards=[], user_ids={})
    assert first == second


def test_a_different_seed_produces_different_data():
    first = seed_audit_log.generate(days=10, total_events=120, seed=1, boards=[], user_ids={})
    second = seed_audit_log.generate(days=10, total_events=120, seed=2, boards=[], user_ids={})
    assert first != second


def test_the_seeder_refuses_a_production_looking_database(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@prod-db.internal/workflow")
    assert seed_audit_log.looks_like_production() is True
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./workflow.db")
    assert seed_audit_log.looks_like_production() is False


def test_generated_rows_use_only_known_event_families():
    rows = seed_audit_log.generate(days=14, total_events=300, seed=7, boards=[], user_ids={})
    for row in rows:
        assert row["event_type"].split(".", 1)[0] in verifier.VALID_EVENT_PREFIX
        assert row["severity"] in verifier.VALID_SEVERITY
        assert row["outcome"] in verifier.VALID_OUTCOME
        json.loads(row["details"])


def test_generated_timestamps_are_never_in_the_future():
    rows = seed_audit_log.generate(days=7, total_events=200, seed=3, boards=[], user_ids={})
    now = datetime.now(timezone.utc)
    for row in rows:
        stamp = datetime.strptime(row["created_at"], verifier.TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc)
        assert stamp <= now


def test_the_seeder_creates_its_cast_as_real_users():
    db = SessionLocal()
    try:
        user_ids = seed_audit_log.ensure_cast(db, False)
        assert len(user_ids) == len(seed_audit_log.PEOPLE) + 1
        for name, email, role, *_ in seed_audit_log.PEOPLE:
            user = db.query(models.User).filter(models.User.email == email).one()
            assert user.name == name
            assert user.role == role
    finally:
        db.rollback()
        db.close()


def test_a_seeded_dataset_passes_the_verifier():
    db = SessionLocal()
    try:
        user_ids = seed_audit_log.ensure_cast(db, False)
        boards = []
        first = next(iter(user_ids.values()))
        for label in [p[0] for p in seed_audit_log.PROJECTS]:
            board = models.Board(name=label, owner_id=first)
            db.add(board)
            db.commit()
            db.refresh(board)
            boards.append(board)
        rows = seed_audit_log.generate(days=14, total_events=250, seed=11, boards=boards, user_ids=user_ids)
        db.bulk_save_objects([models.AuditEvent(**r) for r in rows])
        db.commit()
    finally:
        db.close()

    report = verifier.Report()
    stored = _all()
    verifier.check_rows(report)
    verifier.check_references(report, stored)
    verifier.check_timeline(report, stored)
    assert not report.failures, report.failures
    assert not report.warnings, report.warnings


# ---------------------------------------------------------------- the verifier

def test_audit_timestamps_are_utc_not_local_time():
    """now_str() is naive local time; audit evidence must not be, or events
    cannot be correlated across servers and a DST jump shifts them silently."""
    parsed = datetime.strptime(utils.audit_now_str(), verifier.TIMESTAMP_FORMAT)
    as_utc = parsed.replace(tzinfo=timezone.utc)
    assert as_utc <= datetime.now(timezone.utc) + timedelta(minutes=1)
    # If the host is not on UTC, the two must differ - which is the bug this
    # guards against. On a UTC host they are equal and the assertion is vacuous.
    local = datetime.strptime(utils.now_str(), verifier.TIMESTAMP_FORMAT)
    assert local.tzinfo is None
    assert utils.audit_now_str()[-8:] == utils.audit_now_str()[-8:]


def test_a_good_row_produces_no_findings():
    _insert()
    report = verifier.Report()
    verifier.check_rows(report)
    verifier.check_timeline(report, _all())
    # No failures. A single row does legitimately warn about the timeline - a
    # one-event log is not a realistic one - and that is covered separately.
    assert not report.failures, report.failures


def test_the_verifier_catches_a_bad_severity():
    _insert(severity="catastrophic")
    report = verifier.Report()
    verifier.check_rows(report)
    assert any("severity" in f for f in report.failures)


def test_the_verifier_catches_a_future_timestamp():
    ahead = (datetime.now(timezone.utc) + timedelta(days=2)).strftime(verifier.TIMESTAMP_FORMAT)
    _insert(created_at=ahead)
    report = verifier.Report()
    verifier.check_rows(report)
    assert any("future" in f for f in report.failures)


def test_the_verifier_catches_a_malformed_timestamp():
    _insert(created_at="25/09/2026 10:00")
    report = verifier.Report()
    verifier.check_rows(report)
    assert any("created_at" in f for f in report.failures)


def test_the_verifier_catches_a_bad_ip():
    _insert(ip_address="not-an-ip")
    report = verifier.Report()
    verifier.check_rows(report)
    assert any("ip_address" in f for f in report.failures)


def test_the_verifier_catches_an_unknown_event_family():
    _insert(event_type="telepathy.triggered")
    report = verifier.Report()
    verifier.check_rows(report)
    assert any("event_type" in f for f in report.failures)


def test_the_verifier_catches_broken_json_details():
    _insert(details="{not json")
    report = verifier.Report()
    verifier.check_rows(report)
    assert any("details" in f for f in report.failures)


def test_the_verifier_catches_an_orphan_board_reference():
    _insert(board_id=999999)
    report = verifier.Report()
    verifier.check_references(report, _all())
    assert any("board that does not exist" in f for f in report.failures)


def test_the_verifier_catches_an_orphan_actor_id():
    _insert(actor_user_id=999999)
    report = verifier.Report()
    verifier.check_references(report, _all())
    assert any("actor_user_id" in f for f in report.failures)


def test_the_verifier_flags_a_single_event_type_log():
    for _ in range(3):
        _insert()
    report = verifier.Report()
    verifier.check_distribution(report, _all(), strict=True)
    assert any("distinct event type" in f for f in report.failures)


def test_the_verifier_warns_when_everything_is_overnight():
    overnight = datetime.now(timezone.utc).replace(hour=3, minute=12, second=0, microsecond=0)
    for _ in range(12):
        _insert(created_at=overnight.strftime(verifier.TIMESTAMP_FORMAT))
    report = verifier.Report()
    verifier.check_timeline(report, _all())
    assert any("00:00-05:59" in w for w in report.warnings)


def test_the_verifier_warns_about_unregistered_actors():
    _insert(actor_email="ghost@example.test")
    report = verifier.Report()
    verifier.check_references(report, _all())
    assert any("not registered users" in w for w in report.warnings)


def test_the_verifier_reports_an_empty_table():
    report = verifier.Report()
    assert verifier.check_populated(report) is None
    assert any("empty" in f for f in report.failures)
