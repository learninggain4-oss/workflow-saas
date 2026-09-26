"""
Shared backend core: cross-domain models, response shaping, and automations.

Everything here is domain-agnostic and importable without pulling in the FastAPI
app, so routers/ can depend on it without a circular import. main.py stays a thin
app factory that includes the routers.
"""
import os
import json
import threading
import models
import schemas
import utils
import templates_catalog
from sqlalchemy import Boolean, Column, Integer, String, Text
from pydantic import BaseModel
from database import SessionLocal, get_db
from utils import create_notification_safe, create_token, get_current_user, get_user_boards, log_activity_safe, manager, now_str, pwd_context, send_email_safe


# --- CLOUDINARY CONFIGURATION ---
try:
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "").strip(),
        api_key=os.getenv("CLOUDINARY_API_KEY", "").strip(),
        api_secret=os.getenv("CLOUDINARY_API_SECRET", "").strip(),
        secure=True,
    )
    CLOUDINARY_ENABLED = bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
except Exception:
    CLOUDINARY_ENABLED = False

class Automation(models.Base):
    __tablename__ = "automations"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, index=True)
    trigger_type = Column(String, default="")
    trigger_condition = Column(String, default="")
    action_type = Column(String, default="")
    action_payload = Column(Text, default="{}")
    is_active = Column(Boolean, default=True)


class AutomationCreatePayload(BaseModel):
    trigger_type: str
    trigger_condition: str
    action_type: str
    action_payload: str
    is_active: bool = True


class BoardMessage(models.Base):
    __tablename__ = "board_messages"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, index=True)
    user_id = Column(Integer)
    user_name = Column(String, default="")
    text = Column(Text, default="")
    created_at = Column(String, default="")


class BoardMessageCreate(BaseModel):
    text: str


def _parse_json(value, default):
    if value in (None, "", "null"):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _dump_json(value, default):
    if value is None:
        return json.dumps(default, ensure_ascii=False)
    return json.dumps(value, ensure_ascii=False)


def _to_int(value):
    """Dependency ids travel through JSON as strings. Postgres compares
    integer = text and raises OperatorError, so normalise before .in_()."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _task_response(t: models.Task) -> dict:
    """Single serialisation point for tasks. `dependencies`/`recurring` are stored
    as TEXT but must be returned as real JSON types or the frontend's
    `currentDeps.includes(String(t.id))` check breaks on the second edit."""
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "start_date": t.start_date,
        "due_date": t.due_date,
        "time_estimated": t.time_estimated,
        "time_spent": t.time_spent,
        "assigned_to": t.assigned_to,
        "assigned_to_name": getattr(t, "assigned_to_name", ""),
        "attachment_url": getattr(t, "attachment_url", ""),
        "labels": getattr(t, "labels", ""),
        "user_id": t.user_id,
        "board_id": t.board_id,
        "dependencies": _parse_json(getattr(t, "dependencies", "[]"), []),
        "recurring": _parse_json(getattr(t, "recurring", ""), None),
        "created_at": getattr(t, "created_at", "") or "",
        "updated_at": getattr(t, "updated_at", "") or "",
    }


def _board_response(board, current_user, db: Session):
    role = utils.get_board_member_role(board.id, current_user.id, db)
    if role is None and utils.normalize_role(getattr(current_user, "role", "")) == "owner":
        role = "owner"
    role = role or "editor"
    
    # Retrieve the raw permissions
    raw_perms = utils.default_permissions_for_role("owner") if role == "owner" else utils.get_board_member_permissions(board.id, current_user.id, db)
    
    # Normalize permissions so the key set matches get_board_members
    permissions = utils.normalize_permissions(role, raw_perms)
    
    # Retain viewRoleDistribution if it exists in raw_perms
    if isinstance(raw_perms, dict) and "viewRoleDistribution" in raw_perms:
        permissions["viewRoleDistribution"] = bool(raw_perms["viewRoleDistribution"])

    return {
        "id": board.id,
        "name": board.name,
        "description": getattr(board, "description", "") or "",
        "owner_id": board.owner_id,
        "role": role,
        "permissions": permissions,
    }


# Columns that may be written through the task endpoints. `id`, `user_id` and
# `board_id` are deliberately excluded: `board_id` would let a caller move a task
# onto a board they have no access to, since ensure_board_access only validates
# the task's original board. Lives here rather than in main.py because the task
# routes live in routers/tasks.py, and routers cannot import from main.
TASK_WRITABLE_FIELDS = {
    "title", "description", "status", "priority", "start_date", "due_date",
    "time_estimated", "time_spent", "assigned_to", "assigned_to_name",
    "attachment_url", "labels", "dependencies", "recurring",
}


def apply_automations(task: models.Task, board_id: int, event: str, old_status: str, db: Session):
    """Executes board automation rules against the in-session task object.

    Callers commit once afterwards, so a rule that changes the task cannot
    re-enter update_task and recurse. The changes ride the caller's commit."""
    automations = db.query(Automation).filter(Automation.board_id == board_id, Automation.is_active == True).all()
    modified = False
    
    for rule in automations:
        trigger = False
        
        # Evaluate triggers
        if rule.trigger_type == "status_change":
            if event == "update" and old_status != task.status and task.status == rule.trigger_condition:
                trigger = True
        elif rule.trigger_type == "task_created" and event == "create":
            trigger = True
            
        if trigger:
            payload = _parse_json(rule.action_payload, {})
            
            # Execute Actions
            if rule.action_type == "send_email":
                to_email = payload.get("to")
                subject = payload.get("subject", "Task Automation Update")
                body = payload.get("body", f"Automation triggered for task '{task.title}'.")
                if to_email:
                    html_body = utils.build_professional_email_html(
                        title="Automation Notification",
                        intro=f"An automation rule was triggered for task <strong>{task.title}</strong>.",
                        rows=[("Task", task.title), ("Status", task.status), ("Condition", rule.trigger_condition)]
                    )
                    threading.Thread(
                        target=send_email_safe,
                        args=(to_email, subject, html_body)
                    ).start()
                    
            elif rule.action_type == "assign_to":
                assignee = payload.get("email") or payload.get("assigned_to")
                if assignee and task.assigned_to != assignee:
                    task.assigned_to = assignee
                    modified = True
                    
            elif rule.action_type == "add_label":
                new_label = payload.get("label")
                if new_label:
                    current_labels = task.labels or ""
                    labels_list = [l.strip() for l in current_labels.split(",") if l.strip()]
                    if new_label not in labels_list:
                        labels_list.append(new_label)
                        task.labels = ",".join(labels_list)
                        modified = True
                        
    return modified
