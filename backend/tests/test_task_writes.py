"""Regression tests for the task write routes.

These exist because a refactor left TASK_WRITABLE_FIELDS behind in main.py while
the routes that use it moved to routers/tasks.py. The app still imported, the
OpenAPI surface was unchanged, and every existing test passed - but POST and PUT
/api/tasks returned 500 (NameError) at runtime. Nothing covered the write path,
so the breakage was invisible until a user tried to save a task.
"""
import json
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"

import pytest
from fastapi.testclient import TestClient

import main
from routers import tasks as tasks_router
import models
from database import SessionLocal
from utils import create_token


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(autouse=True)
def clean_database():
    def clear():
        db = SessionLocal()
        try:
            for model in (
                main.Automation, models.Notification, models.Activity, models.Comment,
                models.Subtask, models.Task, models.BoardMember, models.Board, models.User,
            ):
                db.query(model).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    clear()
    yield
    clear()


@pytest.fixture
def workspace():
    """Owner + board, returned as (client, headers, board_id)."""
    db = SessionLocal()
    try:
        email = _unique_email("tasks")
        user = models.User(email=email, name="Owner", password_hash="x", role="owner")
        db.add(user)
        db.commit()
        db.refresh(user)
        board = models.Board(name="Task Board", owner_id=user.id)
        db.add(board)
        db.commit()
        db.refresh(board)
        client = TestClient(main.app)
        headers = {"Authorization": f"Bearer {create_token({'sub': email})}"}
        yield client, headers, board.id
    finally:
        db.close()


def test_writable_fields_constant_is_importable():
    """The exact regression: the routes referenced a constant they never imported."""
    assert "title" in tasks_router.TASK_WRITABLE_FIELDS
    assert "status" in tasks_router.TASK_WRITABLE_FIELDS
    # board_id must stay out, or a caller could relocate a task to a board they
    # have no access to.
    assert "board_id" not in tasks_router.TASK_WRITABLE_FIELDS
    assert "id" not in tasks_router.TASK_WRITABLE_FIELDS
    assert "user_id" not in tasks_router.TASK_WRITABLE_FIELDS


def test_create_task_returns_200_not_500(workspace):
    client, headers, board_id = workspace
    resp = client.post(
        "/api/tasks",
        json={"board_id": board_id, "title": "Write docs", "status": "todo", "priority": "high"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "Write docs"
    assert body["board_id"] == board_id


def test_update_task_returns_200_not_500(workspace):
    client, headers, board_id = workspace
    created = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "T", "status": "todo"}, headers=headers
    ).json()

    resp = client.put(f"/api/tasks/{created['id']}", json={"status": "doing", "title": "T2"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "doing"
    assert resp.json()["title"] == "T2"


def test_update_accepts_the_full_task_object(workspace):
    """The frontend sends the whole task back, not just the changed fields."""
    client, headers, board_id = workspace
    created = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "T", "status": "todo"}, headers=headers
    ).json()

    # saveEdit() passes `editing`, which is the entire task as held in state.
    resp = client.put(f"/api/tasks/{created['id']}", json=created, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == created["id"]


def test_update_ignores_id_user_id_and_board_id(workspace):
    client, headers, board_id = workspace
    created = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "T", "status": "todo"}, headers=headers
    ).json()

    resp = client.put(
        f"/api/tasks/{created['id']}",
        json={"id": 99999, "user_id": 99999, "board_id": 99999, "title": "Renamed"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == created["id"]
    assert resp.json()["board_id"] == board_id
    assert resp.json()["title"] == "Renamed"


def test_dependencies_round_trip_as_json_text(workspace):
    """dependencies is a TEXT column; binding a list makes the driver reject it.

    Ids travel as strings: _task_response emits str(d) and TaskUpdate declares
    List[str], so that is exactly what the frontend replays on save.
    """
    client, headers, board_id = workspace
    blocker = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "Blocker", "status": "done"}, headers=headers
    ).json()
    blocked = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "Blocked", "status": "todo"}, headers=headers
    ).json()

    resp = client.put(
        f"/api/tasks/{blocked['id']}", json={"dependencies": [str(blocker["id"])]}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["dependencies"] == [str(blocker["id"])]


def test_dependencies_reject_non_string_ids(workspace):
    """Documents the strict List[str] contract instead of silently coercing."""
    client, headers, board_id = workspace
    blocked = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "Blocked", "status": "todo"}, headers=headers
    ).json()

    resp = client.put(f"/api/tasks/{blocked['id']}", json={"dependencies": [1]}, headers=headers)
    assert resp.status_code == 422, resp.text


def test_recurring_round_trips_as_json_text(workspace):
    client, headers, board_id = workspace
    created = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "T", "status": "todo"}, headers=headers
    ).json()

    resp = client.put(
        f"/api/tasks/{created['id']}",
        json={"recurring": {"frequency": "weekly", "interval": 1}},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["recurring"]["frequency"] == "weekly"


def test_blocker_validation_rejects_incomplete_status(workspace):
    client, headers, board_id = workspace
    blocker = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "Blocker", "status": "todo"}, headers=headers
    ).json()
    blocked = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "Blocked", "status": "todo"}, headers=headers
    ).json()
    client.put(f"/api/tasks/{blocked['id']}", json={"dependencies": [str(blocker["id"])]}, headers=headers)

    resp = client.put(f"/api/tasks/{blocked['id']}", json={"status": "done"}, headers=headers)
    assert resp.status_code == 400, resp.text
    assert "not done" in resp.json()["detail"]


def test_delete_task_returns_200_and_drops_it_from_blocker_lists(workspace):
    client, headers, board_id = workspace
    blocker = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "Blocker", "status": "done"}, headers=headers
    ).json()
    blocked = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "Blocked", "status": "todo"}, headers=headers
    ).json()
    client.put(f"/api/tasks/{blocked['id']}", json={"dependencies": [str(blocker["id"])]}, headers=headers)

    resp = client.delete(f"/api/tasks/{blocker['id']}", headers=headers)
    assert resp.status_code == 200, resp.text

    after = client.put(f"/api/tasks/{blocked['id']}", json={"title": "Still here"}, headers=headers)
    assert after.status_code == 200, after.text
    assert after.json()["dependencies"] == []


def test_unknown_task_returns_404_not_500(workspace):
    client, headers, _ = workspace
    resp = client.put("/api/tasks/999999", json={"title": "ghost"}, headers=headers)
    assert resp.status_code == 404, resp.text


def test_subtask_and_comment_routes_are_healthy(workspace):
    """The sibling write routes moved in the same refactor, so they get covered too."""
    client, headers, board_id = workspace
    task = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "T", "status": "todo"}, headers=headers
    ).json()

    sub = client.post(f"/api/tasks/{task['id']}/subtasks", json={"title": "step 1"}, headers=headers)
    assert sub.status_code == 200, sub.text

    com = client.post(f"/api/tasks/{task['id']}/comments", json={"text": "a note"}, headers=headers)
    assert com.status_code == 200, com.text
    assert com.json()["text"] == "a note"

    listed = client.get(f"/api/tasks/{task['id']}/comments", headers=headers)
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 1


def test_cors_allows_the_deployed_railway_frontends():
    """The allowlist had a typo'd railway domain and no railway pattern in the regex."""
    import re as _re

    source = open("main.py", encoding="utf-8").read()
    for domain in (
        "https://workflow-saas-production.up.railway.app",
        "https://workflow-saas-sirk.onrender.com",
    ):
        assert domain in source, f"{domain} missing from the allowlist"

    match = _re.search(r'allow_origin_regex=r"([^"]+)"', source)
    assert match, "allow_origin_regex not found"
    assert "railway" in match.group(1), "regex does not cover railway.app deployments"

    # And a real preflight against one of those origins must succeed.
    client = TestClient(main.app)
    resp = client.options(
        "/api/tasks",
        headers={
            "Origin": "https://workflow-saas-production.up.railway.app",
            "Access-Control-Request-Method": "PUT",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers.get("access-control-allow-origin") == "https://workflow-saas-production.up.railway.app"


def test_automation_rules_ride_the_task_update(workspace):
    """apply_automations runs on status change; it shares the task write path."""
    client, headers, board_id = workspace
    task = client.post(
        "/api/tasks", json={"board_id": board_id, "title": "T", "status": "todo"}, headers=headers
    ).json()

    db = SessionLocal()
    try:
        db.add(main.Automation(
            board_id=board_id, trigger_type="status_change", trigger_condition="done",
            action_type="add_label", action_payload=json.dumps({"label": "auto-done"}), is_active=True,
        ))
        db.commit()
    finally:
        db.close()

    resp = client.put(f"/api/tasks/{task['id']}", json={"status": "done"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert "auto-done" in resp.json()["labels"]
