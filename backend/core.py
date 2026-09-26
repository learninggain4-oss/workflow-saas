"""
Shared backend core: cross-domain models, response shaping, and automations.

Everything here is domain-agnostic and importable without pulling in the FastAPI
app, so routers/ can depend on it without a circular import. main.py stays a thin
app factory that includes the routers.
"""
import os
import json
import threading
from datetime import date, datetime, timedelta

import models
import schemas
import utils
import templates_catalog
from sqlalchemy import Boolean, Column, Integer, String, Text, func
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
    # due_date rules only: how many days before the due date to fire. Empty
    # means DEFAULT_DUE_REMINDER_DAYS. Ignored by the event-driven triggers.
    trigger_value = Column(String, default="")
    is_active = Column(Boolean, default=True)


class AutomationCreatePayload(BaseModel):
    trigger_type: str
    trigger_condition: str
    action_type: str
    action_payload: str
    trigger_value: str = ""
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


def _resolve_assignee(db, payload):
    """Resolve an assign_to target to the email of a user who actually exists.

    Task.assigned_to holds an email address - update_task matches it against
    users.email before notifying anyone. The automation used to write whatever
    string it was handed, so a typo silently set a field that no user could ever
    satisfy and no notification could ever fire. Returns None when the target
    does not resolve, so the caller skips instead of storing a dead value.
    """
    raw = str(payload.get("email") or payload.get("assigned_to") or "").strip()
    if not raw or "@" not in raw:
        if raw:
            print(f"[automations] assign_to target {raw!r} is not an email address; skipping", flush=True)
        return None

    user = db.query(models.User).filter(func.lower(models.User.email) == raw.lower()).first()
    if user is None:
        print(f"[automations] assign_to target {raw!r} matches no user; skipping", flush=True)
        return None
    return user.email


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
                assignee = _resolve_assignee(db, payload)
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


# ---------------------------------------------------------------------------
# Time-based automations ("Due Date is Approaching")
# ---------------------------------------------------------------------------
# apply_automations() above is event-driven: it only runs when a task is created
# or edited. A due-date reminder is neither - it has to fire at a moment nobody
# touched the task - so it cannot be implemented as another branch there. It needs
# a scan, which the scheduler in main.py calls on an interval.

DEFAULT_DUE_REMINDER_DAYS = 3
# Conditions that make sense for a time-based rule. "high_priority" is a
# priority, not a status, so it is rejected here rather than silently matching
# nothing; the event-driven path still accepts it for status_change rules.
DUE_DATE_STATUS_CONDITIONS = ("todo", "doing", "in_progress", "blocked", "done", "")


def _parse_due_date(raw):
    """Parse a stored due_date into a date.

    The UI stores <input type="date"> values verbatim, so this is normally
    YYYY-MM-DD. Returns None for anything unparseable so one malformed row
    cannot break the whole scan.
    """
    value = (raw or "").strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value[:10], fmt).date()
        except ValueError:
            continue
    return None


def _reminder_days(rule):
    """Lead time in days for a due_date rule, clamped to a sane range."""
    try:
        days = int(str(rule.trigger_value or "").strip())
    except (TypeError, ValueError):
        return DEFAULT_DUE_REMINDER_DAYS
    if days < 0:
        return 0
    return min(days, 90)


def run_due_date_automations(db, today=None):
    """Fire every active due_date rule whose window is open.

    Returns the number of reminders sent. Safe to call repeatedly: a task is
    recorded as notified per (rule, due date), so the same reminder never fires
    twice, and moving a due date re-arms it.
    """
    today = today or date.today()
    rules = (
        db.query(Automation)
        .filter(Automation.trigger_type == "due_date", Automation.is_active == True)
        .all()
    )
    sent = 0

    for rule in rules:
        condition = (rule.trigger_condition or "").strip().lower()
        if condition not in DUE_DATE_STATUS_CONDITIONS:
            # A status-shaped condition this rule cannot honour. Skipping keeps
            # the scan honest instead of emailing for tasks that never match.
            continue

        lead = _reminder_days(rule)
        # Window: [today, today + lead]. Overdue tasks are not "approaching",
        # and a rule with a 0-day lead fires only on the due date itself.
        tasks = db.query(models.Task).filter(models.Task.board_id == rule.board_id).all()

        for task in tasks:
            due = _parse_due_date(task.due_date)
            if due is None:
                continue
            if due < today or due > today + timedelta(days=lead):
                continue
            if condition and (task.status or "").strip().lower() != condition:
                continue

            already = _parse_json(getattr(task, "automation_notifications", "{}"), {}) or {}
            if str(already.get(str(rule.id))) == task.due_date:
                continue  # already reminded for this exact due date

            payload = _parse_json(rule.action_payload, {}) or {}
            action_type = (rule.action_type or "").strip()

            if action_type == "send_email":
                to_email = payload.get("to")
                if not to_email:
                    continue
                subject = payload.get("subject") or f"Due soon: {task.title}"
                html_body = utils.build_professional_email_html(
                    title="Upcoming Deadline",
                    intro=(
                        f"<strong>{task.title}</strong> is due on "
                        f"<strong>{task.due_date}</strong>."
                    ),
                    rows=[
                        ("Task", task.title),
                        ("Due date", task.due_date),
                        ("Status", task.status),
                        ("Days left", (due - today).days),
                    ],
                )
                send_email_safe(to_email, subject, html_body)

            elif action_type == "add_label":
                label = payload.get("label")
                if label:
                    labels = [l.strip() for l in (task.labels or "").split(",") if l.strip()]
                    if label not in labels:
                        labels.append(label)
                        task.labels = ",".join(labels)

            elif action_type == "assign_to":
                assignee = _resolve_assignee(db, payload)
                if assignee and task.assigned_to != assignee:
                    task.assigned_to = assignee

            # move_board is deliberately not supported here: relocating a task
            # needs the destination board's membership to be validated, which
            # the event path does and this scan must not fake.

            already[str(rule.id)] = task.due_date
            task.automation_notifications = json.dumps(already)
            sent += 1

    if sent:
        db.commit()
    return sent
