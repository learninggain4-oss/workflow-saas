"""Tests for a task_created rule that saved fine and then did nothing.

Two defects:
  1. assign_to saved successfully even when the address matched no user, so the
     rule looked healthy and never fired. The failure only ever appeared in the
     server log.
  2. task_created ignored its own trigger_condition, so a rule reading
     "IF task created IS todo" also fired for doing/blocked/done tasks.
"""
import json
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"
os.environ["AUTOMATION_SCHEDULER"] = "off"

import pytest
from fastapi.testclient import TestClient

import core
import main
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
    db = SessionLocal()
    try:
        email = _unique_email("rule")
        owner = models.User(email=email, name="Owner", password_hash="x", role="administrator")
        teammate = models.User(email=_unique_email("mate"), name="Teammate", password_hash="x")
        db.add(owner)
        db.add(teammate)
        db.commit()
        db.refresh(owner)
        db.refresh(teammate)
        board = models.Board(name="Rule Board", owner_id=owner.id)
        db.add(board)
        db.commit()
        db.refresh(board)
        client = TestClient(main.app)
        yield {
            "board_id": board.id,
            "mate_email": teammate.email,
            "client": client,
            "headers": {"Authorization": f"Bearer {create_token({'sub': email})}"},
        }
    finally:
        db.close()


def _rule(workspace, action_payload, trigger_type="task_created", trigger_condition="todo",
          action_type="assign_to"):
    return workspace["client"].post(
        f"/api/boards/{workspace['board_id']}/automations",
        json={
            "trigger_type": trigger_type,
            "trigger_condition": trigger_condition,
            "action_type": action_type,
            "action_payload": json.dumps(action_payload),
        },
        headers=workspace["headers"],
    )


# ---------------------------------------------------------------- save time

def test_assigning_to_an_unknown_email_is_rejected_at_save_time(workspace):
    resp = _rule(workspace, {"email": "client@gmail.com"})
    assert resp.status_code == 422, resp.text
    detail = resp.json()["detail"]
    assert "client@gmail.com" in detail
    assert "already has an account" in detail


def test_a_rejected_rule_is_not_stored(workspace):
    _rule(workspace, {"email": "client@gmail.com"})
    listed = workspace["client"].get(
        f"/api/boards/{workspace['board_id']}/automations", headers=workspace["headers"]
    )
    assert listed.status_code == 200
    assert listed.json() == []


def test_a_known_email_is_accepted(workspace):
    resp = _rule(workspace, {"email": workspace["mate_email"]})
    assert resp.status_code == 200, resp.text


def test_a_username_is_rejected_with_a_useful_message(workspace):
    resp = _rule(workspace, {"email": "teammate"})
    assert resp.status_code == 422, resp.text
    assert "not an email address" in resp.json()["detail"]


def test_a_blank_assignee_is_rejected(workspace):
    resp = _rule(workspace, {"email": "   "})
    assert resp.status_code == 422, resp.text


def test_updating_a_rule_is_validated_too(workspace):
    created = _rule(workspace, {"email": workspace["mate_email"]})
    rule_id = created.json()["id"]

    resp = workspace["client"].put(
        f"/api/boards/{workspace['board_id']}/automations/{rule_id}",
        json={
            "trigger_type": "task_created",
            "trigger_condition": "todo",
            "action_type": "assign_to",
            "action_payload": json.dumps({"email": "ghost@nowhere.test"}),
        },
        headers=workspace["headers"],
    )
    assert resp.status_code == 422, resp.text

    # And the rule still holds the old, working target.
    listed = workspace["client"].get(
        f"/api/boards/{workspace['board_id']}/automations", headers=workspace["headers"]
    ).json()
    assert json.loads(listed[0]["action_payload"])["email"] == workspace["mate_email"]


def test_other_actions_are_unaffected_by_the_assignee_check(workspace):
    resp = _rule(workspace, {"label": "auto-done"}, action_type="add_label")
    assert resp.status_code == 200, resp.text
    resp = _rule(workspace, {"to": "anyone@anywhere.test"}, action_type="send_email")
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------- the condition

def _create_task(workspace, status):
    resp = workspace["client"].post(
        "/api/tasks",
        json={"board_id": workspace["board_id"], "title": f"Task {status}", "status": status},
        headers=workspace["headers"],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_task_created_fires_for_the_matching_status(workspace):
    _rule(workspace, {"email": workspace["mate_email"]}, trigger_condition="todo")
    task = _create_task(workspace, "todo")
    assert task["assigned_to"] == workspace["mate_email"]


def test_task_created_no_longer_fires_for_a_different_status(workspace):
    """The core fix: the condition in the builder is actually checked."""
    _rule(workspace, {"email": workspace["mate_email"]}, trigger_condition="todo")
    for status in ("doing", "blocked", "done"):
        task = _create_task(workspace, status)
        assert task["assigned_to"] == "", f"fired for status={status}"


def test_an_empty_condition_still_fires_for_every_status(workspace):
    _rule(workspace, {"email": workspace["mate_email"]}, trigger_condition="")
    for status in ("todo", "doing"):
        task = _create_task(workspace, status)
        assert task["assigned_to"] == workspace["mate_email"], status


def test_the_condition_match_is_case_insensitive(workspace):
    _rule(workspace, {"email": workspace["mate_email"]}, trigger_condition="TODO")
    task = _create_task(workspace, "todo")
    assert task["assigned_to"] == workspace["mate_email"]


def test_status_change_rules_still_need_an_actual_transition(workspace):
    _rule(workspace, {"email": workspace["mate_email"]},
          trigger_type="status_change", trigger_condition="done")
    created = _create_task(workspace, "todo")
    assert created["assigned_to"] == ""

    moved = workspace["client"].put(
        f"/api/tasks/{created['id']}", json={"status": "done"}, headers=workspace["headers"]
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["assigned_to"] == workspace["mate_email"]


# ---------------------------------------------------------------- end to end

def test_the_screenshot_flow_works_with_a_registered_email(workspace):
    """IF task created IS todo THEN assign to <existing user>."""
    saved = _rule(workspace, {"email": workspace["mate_email"]},
                  trigger_type="task_created", trigger_condition="todo")
    assert saved.status_code == 200, saved.text

    task = _create_task(workspace, "todo")
    assert task["assigned_to"] == workspace["mate_email"]
    assert task["status"] == "todo"


def test_the_screenshot_flow_explains_itself_for_an_unknown_email(workspace):
    saved = _rule(workspace, {"email": "client@gmail.com"},
                  trigger_type="task_created", trigger_condition="todo")
    assert saved.status_code == 422
    detail = saved.json()["detail"]
    assert "client@gmail.com" in detail
    assert "invite them first" in detail
