"""Tests for board- and task-scoped audit emission.

Two properties matter here and neither is obvious from the route code:
  1. A successful action and its audit row must land together, so a rolled-back
     action is not audited and a committed one always is.
  2. A single task save must not fan out into a row per field. The frontend
     sends the whole task on every edit, so the audit has to be written per
     distinct change or the log is mostly noise and the real change is buried.
"""
import json
import os
import uuid

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
def owner():
    db = SessionLocal()
    try:
        email = _unique_email("scope")
        user = models.User(email=email, name="Scope Owner", password_hash="x", role="owner")
        db.add(user)
        db.commit()
        db.refresh(user)
        board = models.Board(name="Scope Board", owner_id=user.id)
        db.add(board)
        db.commit()
        db.refresh(board)
        yield {
            "user": user, "board_id": board.id,
            "client": TestClient(main.app),
            "headers": {"Authorization": f"Bearer {utils.create_token({'sub': email})}"},
        }
    finally:
        db.close()


def _rows(event_type=None, board_id=None):
    db = SessionLocal()
    try:
        q = db.query(models.AuditEvent).order_by(models.AuditEvent.id)
        if event_type:
            q = q.filter(models.AuditEvent.event_type == event_type)
        if board_id is not None:
            q = q.filter(models.AuditEvent.board_id == board_id)
        return q.all()
    finally:
        db.close()


def _create_task(scope, status="todo", title="Scoped task"):
    resp = scope["client"].post(
        "/api/tasks",
        json={"board_id": scope["board_id"], "title": title, "status": status, "priority": "medium"},
        headers=scope["headers"],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------- boards

def test_creating_a_project_is_audited(owner):
    resp = owner["client"].post("/api/boards", json={"name": "Fresh Project"},
                                headers=owner["headers"])
    assert resp.status_code == 200, resp.text
    board_id = resp.json()["id"]

    rows = _rows("board.created")
    assert len(rows) == 1
    assert rows[0].actor_user_id == owner["user"].id
    assert rows[0].board_id == board_id
    assert rows[0].target_id == str(board_id)
    assert rows[0].severity == "notice"
    assert "Fresh Project" in rows[0].action


def test_a_rejected_project_create_is_not_audited(owner):
    """A 422 raises, so nothing should be recorded for it."""
    resp = owner["client"].post("/api/boards", json={"name": "   "}, headers=owner["headers"])
    assert resp.status_code in (400, 422)
    assert _rows("board.created") == []


def test_renaming_a_project_is_audited_with_the_previous_name(owner):
    resp = owner["client"].put(
        f"/api/boards/{owner['board_id']}",
        json={"name": "Renamed Scope", "description": "new"},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text

    row = _rows("board.renamed")[0]
    assert row.details and json.loads(row.details)["previous_name"] == "Scope Board"
    assert "Renamed Scope" in row.action


def test_deleting_a_project_leaves_an_audit_row(owner):
    board_id = owner["board_id"]
    _create_task(owner)

    resp = owner["client"].delete(f"/api/boards/{board_id}", headers=owner["headers"])
    assert resp.status_code == 200, resp.text

    rows = _rows("board.deleted")
    assert len(rows) == 1
    # board_id is deliberately null: the project no longer exists, but the record
    # that it was deleted must.
    assert rows[0].board_id is None
    assert rows[0].target_id == str(board_id)
    assert json.loads(rows[0].details)["tasks_removed"] == 1


# ---------------------------------------------------------------- members

def _invite(scope, email, role="editor"):
    return scope["client"].post(
        f"/api/boards/{scope['board_id']}/invite",
        json={"email": email, "role": role, "password": "Secret123!"},
        headers=scope["headers"],
    )


def test_inviting_a_member_is_audited(owner):
    resp = _invite(owner, _unique_email("invitee"))
    assert resp.status_code == 200, resp.text

    row = _rows("member.invited")[0]
    assert row.board_id == owner["board_id"]
    assert json.loads(row.details)["role"] == "editor"
    assert json.loads(row.details)["account_created"] is True


def test_changing_a_member_role_is_audited(owner):
    email = _unique_email("mate")
    _invite(owner, email)
    target = None
    db = SessionLocal()
    try:
        target = db.query(models.User).filter(models.User.email == email).one().id
    finally:
        db.close()

    resp = owner["client"].put(
        f"/api/boards/{owner['board_id']}/members/{target}",
        json={"role": "viewer"}, headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text

    # "viewer" is normalised to the stored role name, "subscriber", so the audit
    # records what was actually applied rather than what was typed.
    applied = utils.normalize_role("viewer")
    details = json.loads(_rows("member.role_changed")[0].details)
    assert details == {"previous_role": "editor", "role": applied,
                       "access_granted": False}


def test_removing_a_member_is_audited(owner):
    email = _unique_email("dropme")
    _invite(owner, email)
    db = SessionLocal()
    try:
        target = db.query(models.User).filter(models.User.email == email).one().id
    finally:
        db.close()

    resp = owner["client"].delete(
        f"/api/boards/{owner['board_id']}/members/{target}", headers=owner["headers"]
    )
    assert resp.status_code == 200, resp.text

    row = _rows("member.removed")[0]
    assert row.severity == "warning"
    assert row.target_label == email


def test_a_rejected_member_change_is_not_audited(owner):
    resp = owner["client"].put(
        f"/api/boards/{owner['board_id']}/members/{owner['user'].id}",
        json={"role": "viewer"}, headers=owner["headers"],
    )
    assert resp.status_code == 400
    assert _rows("member.role_changed") == []


# ---------------------------------------------------------------- tasks

def test_creating_a_task_is_audited(owner):
    task = _create_task(owner)
    row = _rows("task.created")[0]
    assert row.target_id == str(task["id"])
    assert row.board_id == owner["board_id"]
    assert json.loads(row.details)["status"] == "todo"


def test_a_status_change_is_audited(owner):
    task = _create_task(owner, status="todo")
    resp = owner["client"].put(f"/api/tasks/{task['id']}", json={"status": "doing"},
                               headers=owner["headers"])
    assert resp.status_code == 200, resp.text

    row = _rows("task.status_changed")[0]
    assert json.loads(row.details) == {"from": "todo", "to": "doing"}


def test_assigning_a_task_is_audited(owner):
    task = _create_task(owner)
    mate = _unique_email("assignee")
    _invite(owner, mate)
    resp = owner["client"].put(f"/api/tasks/{task['id']}", json={"assigned_to": mate},
                               headers=owner["headers"])
    assert resp.status_code == 200, resp.text

    rows = _rows("task.assigned")
    assert len(rows) == 1
    assert json.loads(rows[0].details)["assignee"] == mate


def test_deleting_a_task_leaves_an_audit_row(owner):
    task = _create_task(owner)
    resp = owner["client"].delete(f"/api/tasks/{task['id']}", headers=owner["headers"])
    assert resp.status_code == 200, resp.text

    row = _rows("task.deleted")[0]
    assert row.target_id == str(task["id"])
    assert row.severity == "warning"
    assert json.loads(row.details)["project"] == "Scope Board"


# ---------------------------------------------------------------- noise

def test_a_no_op_save_writes_nothing(owner):
    """The frontend resends the whole task on every edit. A save that changes
    nothing must not produce a row, or the log drowns in phantom updates."""
    task = _create_task(owner)
    before = len(_rows())

    resp = owner["client"].put(f"/api/tasks/{task['id']}",
                               json={"title": task["title"], "status": "todo",
                                     "priority": task["priority"]},
                               headers=owner["headers"])
    assert resp.status_code == 200, resp.text
    assert len(_rows()) == before, "a save that changed nothing was audited"


def test_one_save_with_two_changes_writes_two_rows(owner):
    task = _create_task(owner, title="Original title")
    before = len(_rows())

    resp = owner["client"].put(f"/api/tasks/{task['id']}",
                               json={"title": "New title", "status": "doing"},
                               headers=owner["headers"])
    assert resp.status_code == 200, resp.text

    new = _rows()[before:]
    kinds = sorted(r.event_type for r in new)
    assert kinds == ["task.status_changed", "task.updated"]
    rename_row = [r for r in new if r.event_type == "task.updated"][0]
    assert json.loads(rename_row.details)["previous_title"] == "Original title"


def test_the_audit_row_does_not_disturb_the_activity_feed(owner):
    """The two systems are separate; a project action still logs activity."""
    before = len(_rows("board.created"))
    owner["client"].post("/api/boards", json={"name": "Two Pipelines"}, headers=owner["headers"])

    db = SessionLocal()
    try:
        activity = [a.action for a in db.query(models.Activity).all()]
    finally:
        db.close()
    assert len(_rows("board.created")) == before + 1
    assert any("Two Pipelines" in a for a in activity), "activity feed lost the entry"
