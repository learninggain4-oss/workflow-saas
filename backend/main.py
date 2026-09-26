import os
import io
import re
import csv
import json
import base64
import traceback
import threading
from datetime import date, timedelta

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_swagger_ui_oauth2_redirect_html
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, Column, Integer, String, Boolean, Text
from pydantic import BaseModel
from jose import jwt, JWTError

import models
import schemas
import utils
from database import SessionLocal, engine, get_db
from utils import (
    manager, pwd_context, create_token, get_current_user, get_user_boards,
    log_activity_safe, create_notification_safe, get_smtp_config, send_email_safe, now_str
)

# --- CLOUDINARY CONFIGURATION ---
try:
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "").strip(),
        api_key=os.getenv("CLOUDINARY_API_KEY", "").strip(),
        api_secret=os.getenv("CLOUDINARY_API_SECRET", "").strip()
    )
    CLOUDINARY_ENABLED = bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
except Exception:
    CLOUDINARY_ENABLED = False


# --- AUTOMATION MODEL & SCHEMA ---
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

# --- BOARD CHAT MODEL & SCHEMA ---
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


# --- DATABASE INITIALIZATION ---
def validate_startup_config():
    """Refuse to start a production deploy that is silently misconfigured.

    Every check here corresponds to a failure mode that looks healthy from the
    outside: the process starts, the health check passes, and the app then
    misbehaves or is insecure. Failing at boot turns an hours-long mystery into
    an immediate, readable error in the deploy log.

    Dev is lenient (warn only) so a fresh clone still runs with no setup."""
    problems = []
    warnings = []

    # 1. SECRET_KEY must not be missing or a known-compromised value. With one of
    #    those, anyone can forge a JWT for any user and become owner.
    if utils.SECRET_KEY_IS_DEFAULT:
        problems.append(
            "SECRET_KEY is unset or still set to a known-compromised default. "
            "Generate a strong random key: python -c \"import secrets; print(secrets.token_urlsafe(48))\". "
            "Until then anyone can forge a login token for any account."
        )

    # 2. SQLite on a deployed service. The filesystem is ephemeral and the file
    #    is wiped on every deploy, so all data is lost each time.
    if DEPLOY_ENV and str(engine.url).startswith("sqlite"):
        problems.append(
            "DATABASE_URL is sqlite on a deployed service. The database file lives on "
            "an ephemeral filesystem and is destroyed on every deploy. Point it at Postgres."
        )

    # 3. Billing / integration secrets. These do not stop startup, but they make
    #    specific features fail with a 503 much later, which is hard to trace.
    if not (os.getenv("INTEGRATION_ENCRYPTION_KEY") or "").strip():
        warnings.append("INTEGRATION_ENCRYPTION_KEY is not set - connecting an integration will return 503.")
    if not utils.paddle_checkout_enabled():
        warnings.append("PADDLE_API_KEY / PADDLE_PRICE_ID are not set - 'Upgrade plan' will return 503.")

    for w in warnings:
        print(f"[config] WARNING: {w}")

    if not problems:
        return

    message = "[config] Refusing to start:\n" + "\n".join(f"  - {p}" for p in problems)
    if DEPLOY_ENV:
        raise RuntimeError(message)
    print(message)
    print("[config] Continuing because ENVIRONMENT does not look like a deployment. "
          "Set ENVIRONMENT=production to make these fatal.")


DEPLOY_ENV = (
    os.getenv("RENDER", "").strip().lower() in ("1", "true", "yes")
    or bool(os.getenv("RAILWAY_ENVIRONMENT", "").strip())
    or os.getenv("ENVIRONMENT", "").strip().lower() in ("production", "prod")
)


def ensure_database_migrations():
    try:
        with engine.connect() as conn:
            url_name = str(engine.url).lower()
            if "sqlite" in url_name:
                migrations = [
                    ("users", "role", "VARCHAR DEFAULT 'administrator'"),
                    ("users", "subscription_tier", "VARCHAR DEFAULT 'free'"),
                    ("users", "avatar_url", "VARCHAR DEFAULT ''"),
                    ("users", "email_verified", "BOOLEAN DEFAULT TRUE"),
                    ("users", "two_factor_enabled", "BOOLEAN DEFAULT FALSE"),
                    ("users", "profile_preferences", "TEXT DEFAULT '{}'"),
                    ("users", "workspace_defaults", "TEXT DEFAULT '{}'"),
                    ("users", "connected_apps", "TEXT DEFAULT '[]'"),
                    ("tasks", "description", "TEXT DEFAULT ''"),
                    ("tasks", "due_date", "VARCHAR DEFAULT ''"),
                    ("tasks", "start_date", "VARCHAR DEFAULT ''"),
                    ("tasks", "time_estimated", "INTEGER DEFAULT 0"),
                    ("tasks", "time_spent", "INTEGER DEFAULT 0"),
                    ("tasks", "board_id", "INTEGER"),
                    ("tasks", "assigned_to", "VARCHAR DEFAULT ''"),
                    ("tasks", "assigned_to_name", "VARCHAR DEFAULT ''"),
                    ("tasks", "attachment_url", "TEXT DEFAULT ''"),
                    ("tasks", "labels", "VARCHAR DEFAULT ''"),
                    ("tasks", "dependencies", "TEXT DEFAULT '[]'"),
                    ("tasks", "recurring", "TEXT DEFAULT '{}'"),
                    ("tasks", "created_at", "VARCHAR DEFAULT ''"),
                    ("tasks", "updated_at", "VARCHAR DEFAULT ''"),
                    ("comments", "user_name", "VARCHAR DEFAULT ''"),
                    ("comments", "created_at", "VARCHAR DEFAULT ''"),
                    ("board_members", "role", "VARCHAR DEFAULT 'editor'"),
                    ("board_members", "permissions", "TEXT DEFAULT '{}'"),
                    ("boards", "description", "TEXT DEFAULT ''"),
                    ("integrations", "status", "VARCHAR DEFAULT 'disconnected'"),
                    ("integrations", "config_enc", "TEXT DEFAULT ''"),
                    ("integrations", "external_account", "VARCHAR DEFAULT ''"),
                    ("integrations", "last_synced_at", "VARCHAR DEFAULT ''"),
                    ("integrations", "last_error", "TEXT DEFAULT ''"),
                    ("integrations", "created_by", "INTEGER"),
                    ("integrations", "created_at", "VARCHAR DEFAULT ''"),
                    ("integrations", "updated_at", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "paddle_subscription_id", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "paddle_customer_id", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "status", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "price_id", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "current_period_end", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "canceled_at", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "created_at", "VARCHAR DEFAULT ''"),
                    ("subscriptions", "updated_at", "VARCHAR DEFAULT ''"),
                    ("invoices", "paddle_transaction_id", "VARCHAR DEFAULT ''"),
                    ("invoices", "paddle_invoice_id", "VARCHAR DEFAULT ''"),
                    ("invoices", "invoice_number", "VARCHAR DEFAULT ''"),
                    ("invoices", "status", "VARCHAR DEFAULT ''"),
                    ("invoices", "currency_code", "VARCHAR DEFAULT 'USD'"),
                    ("invoices", "total", "TEXT DEFAULT ''"),
                    ("invoices", "billed_at", "VARCHAR DEFAULT ''"),
                    ("invoices", "created_at", "VARCHAR DEFAULT ''"),
                    ("activities", "task_id", "INTEGER"),
                ]
                tables = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
                for table_name, column_name, column_def in migrations:
                    if table_name not in tables:
                        continue
                    columns = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                    existing_columns = {row[1] for row in columns}
                    if column_name not in existing_columns:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"))
                conn.execute(text("CREATE TABLE IF NOT EXISTS subtasks (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER, title VARCHAR NOT NULL, is_completed BOOLEAN DEFAULT FALSE)"))
                conn.execute(text("CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, board_id INTEGER, task_id INTEGER, message VARCHAR DEFAULT '', notif_type VARCHAR DEFAULT 'info', type VARCHAR DEFAULT 'info', is_read BOOLEAN DEFAULT FALSE, created_at VARCHAR DEFAULT '')"))
                conn.execute(text("CREATE TABLE IF NOT EXISTS automations (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER, trigger_type VARCHAR DEFAULT '', trigger_condition VARCHAR DEFAULT '', action_type VARCHAR DEFAULT '', action_payload TEXT DEFAULT '{}', is_active BOOLEAN DEFAULT 1)"))
                conn.execute(text("CREATE TABLE IF NOT EXISTS board_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER, user_id INTEGER, user_name VARCHAR DEFAULT '', text TEXT DEFAULT '', created_at VARCHAR DEFAULT '')"))
                conn.commit()
                return

            required_columns = {
                "users": [
                    ("role", "VARCHAR DEFAULT 'administrator'"),
                    ("subscription_tier", "VARCHAR DEFAULT 'free'"),
                    ("avatar_url", "VARCHAR DEFAULT ''"),
                    ("email_verified", "BOOLEAN DEFAULT TRUE"),
                    ("two_factor_enabled", "BOOLEAN DEFAULT FALSE"),
                    ("profile_preferences", "TEXT DEFAULT '{}'"),
                    ("workspace_defaults", "TEXT DEFAULT '{}'"),
                    ("connected_apps", "TEXT DEFAULT '[]'"),
                ],
                "tasks": [
                    ("description", "TEXT DEFAULT ''"),
                    ("due_date", "VARCHAR DEFAULT ''"),
                    ("start_date", "VARCHAR DEFAULT ''"),
                    ("time_estimated", "INTEGER DEFAULT 0"),
                    ("time_spent", "INTEGER DEFAULT 0"),
                    ("board_id", "INTEGER"),
                    ("assigned_to", "VARCHAR DEFAULT ''"),
                    ("assigned_to_name", "VARCHAR DEFAULT ''"),
                    ("attachment_url", "TEXT DEFAULT ''"),
                    ("labels", "VARCHAR DEFAULT ''"),
                    ("dependencies", "TEXT DEFAULT '[]'"),
                    ("recurring", "TEXT DEFAULT '{}'"),
                    ("created_at", "VARCHAR DEFAULT ''"),
                    ("updated_at", "VARCHAR DEFAULT ''"),
                ],
                "comments": [
                    ("user_name", "VARCHAR DEFAULT ''"),
                    ("created_at", "VARCHAR DEFAULT ''"),
                ],
                "board_members": [
                    ("role", "VARCHAR DEFAULT 'editor'"),
                    ("permissions", "TEXT DEFAULT '{}'"),
                ],
                "boards": [
                    ("description", "TEXT DEFAULT ''"),
                ],
                "integrations": [
                    ("status", "VARCHAR DEFAULT 'disconnected'"),
                    ("config_enc", "TEXT DEFAULT ''"),
                    ("external_account", "VARCHAR DEFAULT ''"),
                    ("last_synced_at", "VARCHAR DEFAULT ''"),
                    ("last_error", "TEXT DEFAULT ''"),
                    ("created_by", "INTEGER"),
                    ("created_at", "VARCHAR DEFAULT ''"),
                    ("updated_at", "VARCHAR DEFAULT ''"),
                ],
                "subscriptions": [
                    ("paddle_subscription_id", "VARCHAR DEFAULT ''"),
                    ("paddle_customer_id", "VARCHAR DEFAULT ''"),
                    ("status", "VARCHAR DEFAULT ''"),
                    ("price_id", "VARCHAR DEFAULT ''"),
                    ("current_period_end", "VARCHAR DEFAULT ''"),
                    ("canceled_at", "VARCHAR DEFAULT ''"),
                    ("created_at", "VARCHAR DEFAULT ''"),
                    ("updated_at", "VARCHAR DEFAULT ''"),
                ],
                "invoices": [
                    ("paddle_transaction_id", "VARCHAR DEFAULT ''"),
                    ("paddle_invoice_id", "VARCHAR DEFAULT ''"),
                    ("invoice_number", "VARCHAR DEFAULT ''"),
                    ("status", "VARCHAR DEFAULT ''"),
                    ("currency_code", "VARCHAR DEFAULT 'USD'"),
                    ("total", "TEXT DEFAULT ''"),
                    ("billed_at", "VARCHAR DEFAULT ''"),
                    ("created_at", "VARCHAR DEFAULT ''"),
                ],
                "activities": [
                    ("task_id", "INTEGER"),
                ]
            }

            tables = {
                row[0]
                for row in conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()"))
            }
            for table_name, columns in required_columns.items():
                if table_name not in tables:
                    conn.execute(text(f"CREATE TABLE IF NOT EXISTS {table_name} (id SERIAL PRIMARY KEY)"))
                    conn.commit()
                existing = {
                    row[0]
                    for row in conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '{table_name}'"))
                }
                for column_name, column_def in columns:
                    if column_name not in existing:
                        conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{column_name}" {column_def}'))

            conn.execute(text("CREATE TABLE IF NOT EXISTS subtasks (id SERIAL PRIMARY KEY, task_id INTEGER, title VARCHAR NOT NULL, is_completed BOOLEAN DEFAULT FALSE)"))
            conn.execute(text("CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER, board_id INTEGER, task_id INTEGER, message VARCHAR DEFAULT '', notif_type VARCHAR DEFAULT 'info', type VARCHAR DEFAULT 'info', is_read BOOLEAN DEFAULT FALSE, created_at VARCHAR DEFAULT '')"))
            conn.execute(text("CREATE TABLE IF NOT EXISTS automations (id SERIAL PRIMARY KEY, board_id INTEGER, trigger_type VARCHAR DEFAULT '', trigger_condition VARCHAR DEFAULT '', action_type VARCHAR DEFAULT '', action_payload TEXT DEFAULT '{}', is_active BOOLEAN DEFAULT TRUE)"))
            conn.execute(text("CREATE TABLE IF NOT EXISTS board_messages (id SERIAL PRIMARY KEY, board_id INTEGER, user_id INTEGER, user_name VARCHAR DEFAULT '', text TEXT DEFAULT '', created_at VARCHAR DEFAULT '')"))
            conn.commit()
    except Exception:
        # A failed migration used to be printed and swallowed, so the process
        # started, passed the health check, and then 500'd on the first query
        # that needed a missing column. In a deploy, fail loudly instead.
        if DEPLOY_ENV:
            raise
        traceback.print_exc()


ensure_database_migrations()
models.Base.metadata.create_all(bind=engine)
validate_startup_config()


def ensure_task_timestamps():
    """Backfill tasks.created_at for rows written before the column existed.

    Task-scoped activity rows do not exist yet, so correlating on
    activities.task_id resolves to NULL for every task. Fall back to the
    earliest activity on the same board, which at least places the task on the
    timeline near real activity instead of "now"."""
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                UPDATE tasks
                SET created_at = COALESCE((
                    SELECT a.created_at FROM activities a
                    WHERE a.board_id = tasks.board_id AND a.created_at <> ''
                    ORDER BY a.id ASC LIMIT 1
                ), created_at, '')
                WHERE created_at IS NULL OR created_at = ''
            """))
            conn.commit()
    except Exception:
        traceback.print_exc()

ensure_task_timestamps()


def normalize_existing_users_to_owner():
    """FIXED: Don't make everyone owner, only ensure at least one owner exists"""
    try:
        db = SessionLocal()
        users = db.query(models.User).order_by(models.User.id.asc()).all()
        if not users:
            db.close()
            return
        has_owner = any(utils.normalize_role(getattr(u, "role", "administrator")) == "owner" for u in users)
        if not has_owner:
            # Make first user owner if no owner exists
            first = users[0]
            first.role = "owner"
            db.commit()
        db.close()
    except Exception:
        traceback.print_exc()


normalize_existing_users_to_owner()


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


# Columns that may be written through the task endpoints. `id`, `user_id` and
# `board_id` are deliberately excluded: `board_id` would let a caller move a task
# onto a board they have no access to, since ensure_board_access only validates
# the task's original board.
TASK_WRITABLE_FIELDS = {
    "title", "description", "status", "priority", "start_date", "due_date",
    "time_estimated", "time_spent", "assigned_to", "assigned_to_name",
    "attachment_url", "labels", "dependencies", "recurring",
}


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


# --- FASTAPI APP SETUP ---
app = FastAPI(
    title="WorkFlow SaaS",
    version="0.1.0",
    description="Professional API documentation for WorkFlow SaaS",
    docs_url=None,
    redoc_url=None,
)
app.swagger_ui_oauth2_redirect_url = "/docs/oauth2-redirect"

app.swagger_ui_parameters = {
    "persistAuthorization": True,
    "deepLinking": True,
    "filter": True,
    "showExtensions": True,
    "layout": "BaseLayout",
}

default_allowed_origins = [
    "http://localhost:4173",
    "http://localhost:5173",
    "https://localhost:4173",
    "https://localhost:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://workflow-saas.netlify.app",
    "https://workflow-saas-cof-z.onrender.com",
    "https://workflow-saas-production.up.railway.app"
]

cors_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", ",".join(default_allowed_origins)).split(",")
    if origin.strip()
]

# Local development patterns only. The previous regex also contained
#   ^https://.*\.(netlify\.app|onrender\.com)$
# which matched *any* host on those platforms, not just ours. With
# allow_credentials=True that let any other app hosted there send credentialed
# cross-origin requests to this API. Real deployments are covered by the
# explicit ALLOWED_ORIGINS list above; the platform wildcard is now opt-in.
DEV_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$"

_cors_regex = DEV_ORIGIN_REGEX
if os.getenv("CORS_ALLOW_PLATFORM_WILDCARDS", "").strip().lower() in ("1", "true", "yes"):
    _cors_regex = (
        DEV_ORIGIN_REGEX
        + r"|^https://.*\.(netlify\.app|onrender\.com)$"
    )
    print("[cors] CORS_ALLOW_PLATFORM_WILDCARDS is enabled - any *.netlify.app or "
          "*.onrender.com origin will be accepted. Disable unless you understand the risk.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/docs", include_in_schema=False)
async def custom_docs():
    swagger = get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - API Docs",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
    )
    html = swagger.body.decode("utf-8")
    custom_header = """
    <div class="wf-docs-shell">
        <header class="wf-topbar">
            <div class="wf-brand">
                <div class="wf-logo">W</div>
                <div class="wf-brand-text">
                    <span>WorkFlow</span>
                    <strong>SaaS</strong>
                </div>
            </div>
            <div class="wf-actions">
                <button class="wf-btn wf-btn-secondary" type="button">Docs</button>
                <button class="wf-btn wf-btn-primary" type="button">Authorize</button>
                <button class="wf-btn wf-btn-toggle" id="wfThemeToggle" type="button">Dark</button>
            </div>
        </header>

        <section class="wf-hero">
            <div class="wf-hero-copy">
                <span class="wf-pill">API v0.1.0</span>
                <h1>Developer Portal</h1>
                <p>Authentication, board management, project workflows, and collaboration endpoints for WorkFlow SaaS.</p>
            </div>
            <div class="wf-hero-card">
                <div>
                    <span class="wf-card-label">Status</span>
                    <strong>Production Ready</strong>
                </div>
                <div class="wf-card-mini">
                    <span>12 endpoints</span>
                    <span>Realtime APIs</span>
                </div>
            </div>
        </section>
    """
    html = html.replace("<body>", f"<body>{custom_header}")
    html = html.replace("</body>", "</div></body>")

    css = """
    <style>
        :root {
            --wf-bg: #f5f7fb;
            --wf-bg-2: #eef2ff;
            --wf-panel: rgba(255, 255, 255, 0.82);
            --wf-panel-strong: rgba(255, 255, 255, 0.96);
            --wf-border: rgba(148, 163, 184, 0.28);
            --wf-primary: #0f172a;
            --wf-accent: #2563eb;
            --wf-accent-2: #3b82f6;
            --wf-accent-soft: rgba(37, 99, 235, 0.12);
            --wf-success: #10b981;
            --wf-warning: #f59e0b;
            --wf-danger: #ef4444;
            --wf-text: #1f2937;
            --wf-muted: #64748b;
            --wf-btn-dark: rgba(15, 23, 42, 0.9);
            --wf-btn-light: rgba(255, 255, 255, 0.8);
            --wf-card-dark: rgba(15, 23, 42, 0.9);
            --wf-card-light: rgba(255, 255, 255, 0.8);
            --wf-body-bg: linear-gradient(180deg, #f5f7fb 0%, #eef2ff 100%);
            --wf-body-shade-a: rgba(59,130,246,0.10);
            --wf-body-shade-b: rgba(168,85,247,0.08);
            --wf-topbar-bg: rgba(255, 255, 255, 0.12);
            --wf-card-bg: rgba(255, 255, 255, 0.8);
            --wf-input-bg: rgba(255, 255, 255, 0.8);
        }

        body[data-theme="dark"] {
            --wf-bg: #0a1020;
            --wf-bg-2: #0b1220;
            --wf-panel: rgba(15, 23, 42, 0.82);
            --wf-panel-strong: rgba(17, 24, 39, 0.96);
            --wf-border: rgba(148, 163, 184, 0.22);
            --wf-primary: #f8fafc;
            --wf-accent: #60a5fa;
            --wf-accent-2: #3b82f6;
            --wf-accent-soft: rgba(96, 165, 250, 0.14);
            --wf-success: #34d399;
            --wf-warning: #fbbf24;
            --wf-danger: #f87171;
            --wf-text: #e5e7eb;
            --wf-muted: #94a3b8;
            --wf-btn-dark: rgba(15, 23, 42, 0.9);
            --wf-btn-light: rgba(15, 23, 42, 0.8);
            --wf-card-dark: rgba(15, 23, 42, 0.9);
            --wf-card-light: rgba(15, 23, 42, 0.8);
            --wf-body-bg: linear-gradient(180deg, #050b16 0%, #0b1220 100%);
            --wf-body-shade-a: rgba(59,130,246,0.18);
            --wf-body-shade-b: rgba(168,85,247,0.15);
            --wf-topbar-bg: rgba(9, 14, 24, 0.4);
            --wf-card-bg: rgba(15, 23, 42, 0.8);
            --wf-input-bg: rgba(15, 23, 42, 0.8);
        }

        body {
            background:
                radial-gradient(circle at top left, var(--wf-body-shade-a), transparent 30%),
                radial-gradient(circle at top right, var(--wf-body-shade-b), transparent 30%),
                var(--wf-body-bg);
            font-family: Inter, "Segoe UI", sans-serif;
            color: var(--wf-text);
            margin: 0;
        }

        .wf-docs-shell {
            width: 100%;
            min-height: 100vh;
            background: transparent;
        }

        .wf-topbar {
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px 24px 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            border-bottom: 1px solid var(--wf-border);
            background: var(--wf-topbar-bg);
            backdrop-filter: blur(8px);
        }

        .wf-brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .wf-logo {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 800;
            font-size: 1.15rem;
            box-shadow: 0 12px 24px rgba(59, 130, 246, 0.22);
        }

        .wf-brand-text {
            display: flex;
            align-items: end;
            gap: 8px;
            font-size: 2.2rem;
            line-height: 1;
            letter-spacing: -0.06em;
            font-weight: 800;
            color: var(--wf-primary);
        }

        .wf-brand-text strong {
            color: var(--wf-accent);
            font-weight: 800;
        }

        .wf-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .wf-btn {
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 10px;
            padding: 10px 18px;
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
            transition: 0.2s ease;
        }

        .wf-btn-primary {
            background: linear-gradient(135deg, var(--wf-accent), var(--wf-accent-2));
            color: #fff;
            border-color: transparent;
            box-shadow: 0 10px 20px rgba(37, 99, 235, 0.22);
        }

        .wf-btn-secondary {
            background: var(--wf-btn-light);
            color: var(--wf-primary);
            border-color: var(--wf-border);
        }

        .wf-btn-toggle {
            background: var(--wf-btn-dark);
            color: var(--wf-text);
            border-color: var(--wf-border);
        }

        .wf-btn:hover {
            transform: translateY(-1px);
        }

        .wf-hero {
            max-width: 1200px;
            margin: 0 auto;
            padding: 34px 24px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 28px;
        }

        .wf-hero-copy {
            max-width: 700px;
        }

        .wf-pill {
            display: inline-block;
            padding: 7px 12px;
            border-radius: 999px;
            background: var(--wf-accent-soft);
            color: var(--wf-accent);
            font-weight: 700;
            font-size: 0.75rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        .wf-hero-copy h1 {
            margin: 0 0 8px;
            font-size: clamp(2.1rem, 4vw, 3.2rem);
            line-height: 1.06;
            letter-spacing: -0.06em;
            color: var(--wf-primary);
        }

        .wf-hero-copy p {
            margin: 0;
            color: var(--wf-muted);
            font-size: 1rem;
            line-height: 1.7;
        }

        .wf-hero-card {
            min-width: 280px;
            padding: 22px 20px;
            border-radius: 18px;
            background: var(--wf-card-bg);
            border: 1px solid var(--wf-border);
            box-shadow: 0 18px 35px rgba(15, 23, 42, 0.06);
            display: flex;
            flex-direction: column;
            gap: 18px;
        }

        .wf-card-label {
            display: block;
            font-size: 0.74rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--wf-muted);
            margin-bottom: 8px;
        }

        .wf-hero-card strong {
            font-size: 1.3rem;
            color: var(--wf-primary);
        }

        .wf-card-mini {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .wf-card-mini span {
            display: inline-block;
            border-radius: 999px;
            padding: 8px 10px;
            background: rgba(16, 185, 129, 0.09);
            color: #047857;
            font-size: 0.8rem;
            font-weight: 700;
        }

        .swagger-ui {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 24px 48px;
        }

        .swagger-ui .topbar {
            display: none !important;
        }

        .swagger-ui .info {
            background: var(--wf-panel);
            border: 1px solid var(--wf-border);
            border-radius: 18px;
            padding: 28px 30px;
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
            margin: 0 0 20px;
        }

        .swagger-ui .info .title {
            font-size: 2.15rem;
            color: var(--wf-primary);
            font-weight: 800;
            letter-spacing: -0.04em;
        }

        .swagger-ui .info .description {
            color: var(--wf-muted);
            font-size: 1rem;
            line-height: 1.7;
        }

        .swagger-ui .scheme-container {
            background: var(--wf-panel);
            border: 1px solid var(--wf-border);
            border-radius: 16px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
            padding: 18px 20px;
            margin-bottom: 20px;
        }

        .swagger-ui .opblock {
            border-radius: 14px !important;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
            border: 1px solid var(--wf-border) !important;
            background: var(--wf-panel-strong);
            overflow: hidden;
        }

        .swagger-ui .opblock.opblock-get { border-left: 5px solid #60a5fa !important; }
        .swagger-ui .opblock.opblock-post { border-left: 5px solid #34d399 !important; }
        .swagger-ui .opblock.opblock-put { border-left: 5px solid #fbbf24 !important; }
        .swagger-ui .opblock.opblock-delete { border-left: 5px solid #f87171 !important; }

        .swagger-ui .opblock-summary {
            padding: 18px 20px;
        }

        .swagger-ui .opblock .opblock-summary-method {
            min-width: 72px;
            border-radius: 8px;
            font-size: 0.76rem;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }

        .swagger-ui .opblock .opblock-summary-path {
            color: var(--wf-primary);
            font-weight: 600;
        }

        .swagger-ui .opblock .opblock-summary-description {
            color: var(--wf-muted);
        }

        .swagger-ui .btn {
            border-radius: 10px;
            font-weight: 700;
        }

        .swagger-ui .btn.execute {
            background: linear-gradient(135deg, var(--wf-accent), var(--wf-accent-2));
            border: none;
            box-shadow: 0 10px 18px rgba(37, 99, 235, 0.22);
            color: white;
        }

        .swagger-ui .authorization__btn {
            background: var(--wf-btn-light);
            border: 1px solid var(--wf-border);
            color: var(--wf-primary);
            box-shadow: none;
        }

        .swagger-ui section.models {
            border: 1px solid var(--wf-border);
            border-radius: 16px;
            overflow: hidden;
            background: var(--wf-panel);
        }

        .swagger-ui .model-box {
            border-radius: 10px;
            border: 1px solid var(--wf-border);
            background: var(--wf-panel-strong);
        }

        .swagger-ui textarea,
        .swagger-ui input,
        .swagger-ui select {
            border-radius: 10px;
            border: 1px solid var(--wf-border);
            background: var(--wf-input-bg);
            color: var(--wf-primary);
        }

        .swagger-ui .parameter__name,
        .swagger-ui .response-col_status,
        .swagger-ui .tablinks a,
        .swagger-ui .markdown, .swagger-ui .model-title,
        .swagger-ui .opblock-section-header h4,
        .swagger-ui .details p,
        .swagger-ui .parameter__type,
        .swagger-ui .property-row td,
        .swagger-ui .parameter__in {
            color: var(--wf-primary) !important;
        }

        @media (max-width: 768px) {
            .wf-topbar {
                padding-top: 24px;
                flex-direction: column;
                align-items: flex-start;
            }

            .wf-brand-text {
                font-size: 1.6rem;
            }

            .wf-hero {
                flex-direction: column;
                align-items: flex-start;
                padding-top: 18px;
            }

            .wf-hero-card {
                width: 100%;
                min-width: auto;
            }

            .swagger-ui {
                padding-left: 16px;
                padding-right: 16px;
            }
        }
    </style>
    """
    html = html.replace("</head>", css + "</head>")
    html = html.replace("</body>", """
    <script>
        const toggle = document.getElementById('wfThemeToggle');
        const applyTheme = (theme) => {
            document.body.setAttribute('data-theme', theme);
            if (toggle) {
                toggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
            }
        };
        const saved = localStorage.getItem('wf_theme');
        if (saved === 'dark') applyTheme('dark');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                localStorage.setItem('wf_theme', next);
                applyTheme(next);
            });
        }
    </script>
    </body>""")
    return HTMLResponse(content=html)


@app.get("/docs/oauth2-redirect", include_in_schema=False)
async def swagger_oauth2_redirect():
    return get_swagger_ui_oauth2_redirect_html()


# --- EXCEPTION HANDLING ---
@app.exception_handler(Exception)
async def global_handler(request, exc):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# --- STARTUP EVENTS ---
@app.on_event("startup")
def fix_db():
    ensure_database_migrations()


# --- ROOT ENDPOINT ---
@app.get("/")
def root():
    cfg = get_smtp_config()
    return {
        "ok": True, 
        "email_host": cfg["host"], 
        "from": cfg["from"], 
        "has_brevo_key": cfg["brevo_key"].startswith("xkeysib-"), 
        "cloudinary": CLOUDINARY_ENABLED
    }


# ==========================================
#             AUTH & USERS 
# ==========================================

@app.post("/api/register")
def register(req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    email = (req.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="User exists")

    # The frontend sends a role on signup, but honouring it verbatim would let a
    # crafted request self-assign "owner". Only non-privileged roles are
    # self-serviceable; owner/administrator are granted by an existing owner via
    # PUT /api/admin/users/{user_id}.
    self_service_roles = {"editor", "guest", "subscriber"}
    requested = utils.normalize_role(req.role)
    is_first_user = db.query(models.User).count() == 0
    if is_first_user:
        assigned_role = "owner"
    elif requested in self_service_roles:
        assigned_role = requested
    else:
        assigned_role = "administrator"

    u = models.User(
        email=email,
        name=req.name,
        password_hash=pwd_context.hash(req.password),
        role=assigned_role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    
    b = models.Board(name="My Workspace", owner_id=u.id)
    db.add(b)
    db.commit()
    
    return {"ok": True}


@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # register normalises to lowercase, so match the same way. The frontend
    # lowercases the username too, but older rows may predate that.
    user = db.query(models.User).filter(models.User.email == (form_data.username or "").strip().lower()).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    
    return {
        "access_token": create_token({"sub": user.email}), 
        "token_type": "bearer", 
        "id": user.id
    }


@app.get("/api/users/me")
def get_user_profile(current_user=Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": utils.normalize_role(getattr(current_user, "role", "administrator")),
        "subscription_tier": current_user.subscription_tier,
        "avatar_url": current_user.avatar_url or "",
        "email_verified": bool(current_user.email_verified),
        "two_factor_enabled": bool(current_user.two_factor_enabled),
        "profile_preferences": _parse_json(current_user.profile_preferences, {}),
        "workspace_defaults": _parse_json(current_user.workspace_defaults, {}),
        "connected_apps": _parse_json(current_user.connected_apps, []),
        "security_settings": {
            "emailVerified": bool(current_user.email_verified),
            "twoFactorEnabled": bool(current_user.two_factor_enabled),
            "connectedApps": _parse_json(current_user.connected_apps, []),
        },
    }


@app.get("/api/admin/users")
def list_registered_users(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not utils.is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")

    users = []
    for user in db.query(models.User).order_by(models.User.id.asc()).all():
        users.append({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": utils.normalize_role(getattr(user, "role", "administrator")),
        })
    return users


@app.put("/api/admin/users/{user_id}")
def update_registered_user_role(user_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not utils.is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot change own role here")

    role = utils.normalize_role(payload.get("role", "administrator") or "administrator")
    if role not in {"owner", "administrator", "editor", "guest", "subscriber"}:
        raise HTTPException(status_code=400, detail="Role must be owner, administrator, editor, guest, subscriber")

    target.role = role
    db.commit()
    return {"ok": True, "id": target.id, "email": target.email, "role": role}


@app.delete("/api/admin/users/{user_id}")
def delete_registered_user(user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not utils.is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot delete self")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    owned_board_ids = [board.id for board in db.query(models.Board).filter(models.Board.owner_id == user_id).all()]
    if owned_board_ids:
        owned_task_ids = [task.id for task in db.query(models.Task).filter(models.Task.board_id.in_(owned_board_ids)).all()]
        if owned_task_ids:
            db.query(models.Comment).filter(models.Comment.task_id.in_(owned_task_ids)).delete(synchronize_session=False)
            db.query(models.Subtask).filter(models.Subtask.task_id.in_(owned_task_ids)).delete(synchronize_session=False)
            db.query(models.Notification).filter(models.Notification.task_id.in_(owned_task_ids)).delete(synchronize_session=False)
        db.query(models.Task).filter(models.Task.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.BoardMember).filter(models.BoardMember.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.Activity).filter(models.Activity.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.Board).filter(models.Board.id.in_(owned_board_ids)).delete(synchronize_session=False)

    user_task_ids = [task.id for task in db.query(models.Task).filter(models.Task.user_id == user_id).all()]
    if user_task_ids:
        db.query(models.Comment).filter(models.Comment.task_id.in_(user_task_ids)).delete(synchronize_session=False)
        db.query(models.Subtask).filter(models.Subtask.task_id.in_(user_task_ids)).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.task_id.in_(user_task_ids)).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.user_id == user_id).delete(synchronize_session=False)

    db.query(models.BoardMember).filter(models.BoardMember.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Comment).filter(models.Comment.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete(synchronize_session=False)

    assigned_task_ids = [task.id for task in db.query(models.Task).filter(models.Task.assigned_to == target.email).all()]
    if assigned_task_ids:
        db.query(models.Comment).filter(models.Comment.task_id.in_(assigned_task_ids)).delete(synchronize_session=False)
        db.query(models.Subtask).filter(models.Subtask.task_id.in_(assigned_task_ids)).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.task_id.in_(assigned_task_ids)).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.assigned_to == target.email).delete(synchronize_session=False)

    db.delete(target)
    db.commit()
    return {"ok": True, "deleted": True, "id": user_id}


@app.put("/api/users/me")
def update_user_profile(payload: schemas.UserProfileUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    old_email = current_user.email
    new_name = payload.name.strip() if payload.name else current_user.name
    new_email = payload.email.strip() if payload.email else current_user.email
    new_password = payload.password.strip() if payload.password else None

    if not new_name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not new_email:
        raise HTTPException(status_code=400, detail="Email is required")

    if new_email != old_email:
        existing = db.query(models.User).filter(models.User.email == new_email, models.User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")

    current_user.name = new_name
    current_user.email = new_email
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url or ""
    if payload.email_verified is not None:
        current_user.email_verified = bool(payload.email_verified)
    if payload.two_factor_enabled is not None:
        current_user.two_factor_enabled = bool(payload.two_factor_enabled)
    if payload.profile_preferences is not None:
        current_user.profile_preferences = _dump_json(payload.profile_preferences, {})
    if payload.workspace_defaults is not None:
        current_user.workspace_defaults = _dump_json(payload.workspace_defaults, {})
    if payload.connected_apps is not None:
        current_user.connected_apps = _dump_json(payload.connected_apps, [])
    if payload.security_settings is not None:
        security_settings = payload.security_settings or {}
        if "emailVerified" in security_settings:
            current_user.email_verified = bool(security_settings.get("emailVerified"))
        if "twoFactorEnabled" in security_settings:
            current_user.two_factor_enabled = bool(security_settings.get("twoFactorEnabled"))
        if "connectedApps" in security_settings:
            current_user.connected_apps = _dump_json(security_settings.get("connectedApps"), [])
    if new_password:
        current_user.password_hash = pwd_context.hash(new_password)

    db.commit()
    db.refresh(current_user)

    new_token = create_token({"sub": current_user.email})
    security_payload = {
        "emailVerified": bool(current_user.email_verified),
        "twoFactorEnabled": bool(current_user.two_factor_enabled),
        "connectedApps": _parse_json(current_user.connected_apps, []),
    }
    return {
        "ok": True,
        "message": "Profile updated successfully",
        "access_token": new_token,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "subscription_tier": current_user.subscription_tier,
            "avatar_url": current_user.avatar_url or "",
            "email_verified": bool(current_user.email_verified),
            "two_factor_enabled": bool(current_user.two_factor_enabled),
            "profile_preferences": _parse_json(current_user.profile_preferences, {}),
            "workspace_defaults": _parse_json(current_user.workspace_defaults, {}),
            "connected_apps": _parse_json(current_user.connected_apps, []),
            "security_settings": security_payload,
        }
    }


# ==========================================
#               BILLING (PADDLE)
# ==========================================
# The subscription tier is changed ONLY by the verified Paddle webhook. The
# browser can start a checkout, but it can never assert that a payment
# succeeded. The previous POST /api/upgrade, which set subscription_tier="pro"
# for any authenticated caller, has been removed for that reason.

# Paddle statuses that entitle the user to Pro features.
PADDLE_ENTITLING_STATUSES = {"active", "trialing"}


def _sync_tier_from_subscription(db: Session, user_id: int):
    """Recompute User.subscription_tier from the authoritative Subscription row."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    sub = (
        db.query(models.Subscription)
        .filter(models.Subscription.user_id == user_id)
        .order_by(models.Subscription.id.desc())
        .first()
    )
    entitled = bool(sub and (sub.status or "").lower() in PADDLE_ENTITLING_STATUSES)
    user.subscription_tier = "pro" if entitled else "free"
    db.commit()
    return user


def _subscription_payload(db: Session, user_id: int) -> dict:
    sub = (
        db.query(models.Subscription)
        .filter(models.Subscription.user_id == user_id)
        .order_by(models.Subscription.id.desc())
        .first()
    )
    return {
        "has_subscription": sub is not None,
        "status": (sub.status if sub else ""),
        "entitled": bool(sub and (sub.status or "").lower() in PADDLE_ENTITLING_STATUSES),
        "price_id": (sub.price_id if sub else ""),
        "current_period_end": (sub.current_period_end if sub else ""),
        "canceled_at": (sub.canceled_at if sub else ""),
        "paddle_subscription_id": (sub.paddle_subscription_id if sub else ""),
        "updated_at": (sub.updated_at if sub else ""),
    }


@app.get("/api/billing/subscription")
def get_billing_subscription(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    payload = _subscription_payload(db, current_user.id)
    payload["tier"] = current_user.subscription_tier
    payload["checkout_enabled"] = utils.paddle_checkout_enabled()
    return payload


@app.get("/api/billing/invoices")
def list_invoices(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(models.Invoice)
        .filter(models.Invoice.user_id == current_user.id)
        .order_by(models.Invoice.id.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": r.paddle_transaction_id,
            "invoice_number": r.invoice_number,
            "status": r.status,
            "currency_code": r.currency_code,
            "total": r.total,
            "billed_at": r.billed_at,
        }
        for r in rows
    ]


@app.post("/api/billing/paddle/checkout")
def create_paddle_checkout(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Creates a Paddle transaction server-side and returns a client token.

    The Paddle API key is used here and never sent to the browser: the browser
    only ever receives the short-lived client token that opens the checkout."""
    if not utils.paddle_checkout_enabled():
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured. Set PADDLE_API_KEY and PADDLE_PRICE_ID on the server.",
        )

    api_key = (os.getenv("PADDLE_API_KEY") or "").strip()
    price_id = (os.getenv("PADDLE_PRICE_ID") or "").strip()

    existing = (
        db.query(models.Subscription)
        .filter(models.Subscription.user_id == current_user.id)
        .order_by(models.Subscription.id.desc())
        .first()
    )
    if existing and (existing.status or "").lower() in PADDLE_ENTITLING_STATUSES:
        raise HTTPException(status_code=400, detail="This account already has an active subscription.")

    payload = {
        "items": [{"price_id": price_id, "quantity": 1}],
        "customer": {"email": current_user.email},
        "collection_mode": "automatic",
        # Paddle redirects back to the SPA after a successful purchase.
        "settings": {"allow_fraud_detection": True},
    }
    if existing and existing.paddle_customer_id:
        # Reuse the customer so renewals land on the same subscription.
        payload["customer"] = {"id": existing.paddle_customer_id}

    try:
        resp = requests.post(
            f"{utils.paddle_base_url()}/transactions",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=utils.OUTBOUND_TIMEOUT,
        )
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Paddle did not respond in time. Please try again.")
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=502, detail="Could not reach Paddle to start checkout.")

    if resp.status_code not in (200, 201):
        # Log the upstream detail server-side; do not leak it to the client.
        print(f"[billing] Paddle transaction failed ({resp.status_code}): {resp.text[:400]}")
        raise HTTPException(status_code=502, detail="Paddle rejected the checkout request. Please try again.")

    data = resp.json().get("data") or {}
    client_token = data.get("client_token")
    if not client_token:
        raise HTTPException(status_code=502, detail="Paddle did not return a checkout token.")

    return {"client_token": client_token, "transaction_id": data.get("id", ""), "environment": os.getenv("PADDLE_ENV", "sandbox")}


@app.post("/api/webhooks/paddle")
async def paddle_webhook(request: Request, db: Session = Depends(get_db)):
    """Receives Paddle events.

    This endpoint is intentionally NOT behind JWT auth - Paddle has no user
    token. The HMAC signature over the raw body is the authentication, and it
    is verified before the payload is even parsed."""
    raw_body = await request.body()
    signature = request.headers.get("Paddle-Signature", "")

    if not utils.verify_paddle_signature(raw_body, signature):
        # Deliberately vague to the caller; log the reason for operators.
        print("[billing] rejected Paddle webhook: bad or stale signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Malformed payload.")

    event_type = (event.get("event_type") or "").strip()
    data = event.get("data") or {}

    def as_text(value):
        if value is None:
            return ""
        if isinstance(value, (int, float)):
            return str(value)
        return str(value)

    if event_type in ("subscription.created", "subscription.updated"):
        sub_id = as_text(data.get("id"))
        status = as_text(data.get("status")).lower()

        items = data.get("items") or []
        price_id = ""
        if items:
            first = items[0] or {}
            price = first.get("price") or {}
            price_id = as_text(price.get("id") or first.get("price_id"))

        period = data.get("current_billing_period") or {}
        period_end = as_text(period.get("ends_at"))
        customer = data.get("customer") or {}
        customer_id = as_text(customer.get("id"))
        canceled_at = as_text(data.get("canceled_at") or data.get("ends_at"))

        # Paddle does not send the user's email on subscription events, so match
        # on the stored customer id. An unknown customer is logged and skipped
        # rather than guessed at.
        sub = db.query(models.Subscription).filter(
            models.Subscription.paddle_customer_id == customer_id
        ).first()
        if not sub and customer_id:
            sub = db.query(models.Subscription).filter(
                models.Subscription.paddle_customer_id == customer_id
            ).first()
        if not sub:
            print(f"[billing] {event_type} for unknown Paddle customer {customer_id!r}; nothing to update")
            return {"received": True, "matched": False}

        sub.paddle_customer_id = customer_id
        sub.status = status
        sub.price_id = price_id
        sub.current_period_end = period_end
        sub.canceled_at = canceled_at
        sub.updated_at = utils.now_str()
        db.commit()
        _sync_tier_from_subscription(db, sub.user_id)
        return {"received": True, "matched": True}

    if event_type in ("subscription.canceled", "subscription.paused"):
        sub_id = as_text(data.get("id"))
        sub = db.query(models.Subscription).filter(
            models.Subscription.paddle_subscription_id == sub_id
        ).first()
        if not sub:
            print(f"[billing] {event_type} for unknown subscription {sub_id!r}")
            return {"received": True, "matched": False}
        sub.status = as_text(data.get("status")).lower() or "canceled"
        sub.canceled_at = as_text(data.get("canceled_at")) or utils.now_str()
        sub.updated_at = utils.now_str()
        db.commit()
        _sync_tier_from_subscription(db, sub.user_id)
        return {"received": True, "matched": True}

    if event_type in ("transaction.completed", "transaction.refunded"):
        txn_id = as_text(data.get("id"))
        sub_id = as_text(data.get("subscription_id"))
        details = data.get("details") or {}
        total = as_text(details.get("total") or (data.get("details") or {}).get("totals", {}).get("total"))
        currency = as_text(details.get("currency_code")) or "USD"
        txn_status = as_text(data.get("status")).lower() or ("completed" if event_type.endswith("completed") else "refunded")
        invoice_number = as_text(data.get("invoice_number"))
        paddle_invoice_id = as_text(data.get("invoice_id"))

        # Attach the transaction to a user. Prefer the subscription link; fall
        # back to the customer id recorded at checkout time.
        sub = db.query(models.Subscription).filter(
            models.Subscription.paddle_subscription_id == sub_id
        ).first()
        if not sub:
            customer = data.get("customer") or {}
            sub = db.query(models.Subscription).filter(
                models.Subscription.paddle_customer_id == as_text(customer.get("id"))
            ).first()
        if not sub:
            print(f"[billing] {event_type} for unknown subscription/customer; invoice not recorded")
            return {"received": True, "matched": False}

        existing = db.query(models.Invoice).filter(
            models.Invoice.paddle_transaction_id == txn_id
        ).first()
        if existing:
            # Webhook retries: update in place rather than duplicating.
            existing.status = txn_status
            existing.total = total or existing.total
            existing.currency_code = currency or existing.currency_code
        else:
            existing = models.Invoice(
                user_id=sub.user_id,
                paddle_transaction_id=txn_id,
                paddle_invoice_id=paddle_invoice_id,
                invoice_number=invoice_number,
                status=txn_status,
                currency_code=currency,
                total=total,
                billed_at=utils.now_str(),
                created_at=utils.now_str(),
            )
            db.add(existing)

        db.commit()
        _sync_tier_from_subscription(db, sub.user_id)
        return {"received": True, "matched": True}

    # Acknowledge anything else so Paddle stops retrying.
    return {"received": True, "handled": False, "event_type": event_type}



@app.post("/api/test-email")
def test_email(current_user=Depends(get_current_user)):
    html_body = utils.build_professional_email_html(
        title="WorkFlow SaaS Email Test",
        intro=f"Hi <strong>{current_user.name}</strong>, this is a test email to confirm your email configuration is working correctly.",
        rows=[
            ("Recipient", current_user.email),
            ("Status", "Email configuration verified"),
            ("Message", "Your WorkFlow SaaS email delivery is active."),
        ],
    )
    threading.Thread(
        target=send_email_safe,
        args=(current_user.email, "✅ WorkFlow SaaS - Email Test", html_body)
    ).start()
    return {"sent": True, "to": current_user.email}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    # The 5MB / 2MB limits are enforced only in the browser, so an untrusted
    # client can otherwise push an arbitrary body that gets base64'd and stored
    # on the task. Cap it here too.
    MAX_UPLOAD_BYTES = 5 * 1024 * 1024
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 5MB limit")

    if CLOUDINARY_ENABLED:
        try:
            result = cloudinary.uploader.upload(contents, folder="workflow-saas", resource_type="auto")
            return {"url": result.get("secure_url")}
        except Exception:
            pass

    base64_encoded = base64.b64encode(contents).decode('utf-8')
    return {"url": f"data:{file.content_type or 'application/octet-stream'};base64,{base64_encoded}"}


# ==========================================
#                  BOARDS
# ==========================================

@app.get("/api/boards")
def list_boards(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    boards = get_user_boards(current_user, db)
    if not boards:
        b = models.Board(name="My Workspace", owner_id=current_user.id)
        db.add(b)
        db.commit()
        db.refresh(b)
        boards = [b]
    return [_board_response(board, current_user, db) for board in boards]


@app.post("/api/boards")
def create_board(payload: schemas.BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.subscription_tier == "free":
        board_count = db.query(models.Board).filter(models.Board.owner_id == current_user.id).count()
        if board_count >= 3:
            raise HTTPException(status_code=402, detail="Free plan limit reached (Max 3 boards).")
            
    b = models.Board(name=payload.name, description=payload.description or "", owner_id=current_user.id)
    db.add(b)
    db.commit()
    db.refresh(b)
    
    log_activity_safe(b.id, current_user.name, f"created board {b.name}")
    return _board_response(b, current_user, db)


@app.put("/api/boards/{board_id}")
def rename_board(board_id: int, payload: schemas.BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Board rename", required_permission="manageBoard")
    b.name = payload.name
    db.commit()
    db.refresh(b)
    return b


@app.delete("/api/boards/{board_id}")
async def delete_board(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Board delete", required_permission="manageBoard")
    tids = [t.id for t in db.query(models.Task).filter(models.Task.board_id == board_id).all()]
    if tids:
        db.query(models.Comment).filter(models.Comment.task_id.in_(tids)).delete(synchronize_session=False)
        db.query(models.Subtask).filter(models.Subtask.task_id.in_(tids)).delete(synchronize_session=False)
        
    db.query(models.Task).filter(models.Task.board_id == board_id).delete(synchronize_session=False)
    db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id).delete(synchronize_session=False)
    db.query(models.Activity).filter(models.Activity.board_id == board_id).delete(synchronize_session=False)
    
    db.delete(b)
    db.commit()
    return {"ok": True}


@app.get("/api/boards/{board_id}/export")
def export_board_csv(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board export")
    tasks = db.query(models.Task).filter(models.Task.board_id == board_id).all()
    stream = io.StringIO()
    writer = csv.writer(stream)
    
    writer.writerow(["ID", "Title", "Status", "Priority", "Assigned To", "Start Date", "Due Date", "Time Est", "Time Spent", "Labels"])
    for t in tasks:
        assigned_val = t.assigned_to_name or t.assigned_to
        writer.writerow([t.id, t.title, t.status, t.priority, assigned_val, t.start_date, t.due_date, t.time_estimated, t.time_spent, t.labels])
        
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=board_{board_id}_export.csv"
    return response


@app.post("/api/boards/{board_id}/invite")
def invite(board_id: int, payload: schemas.InviteRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Board invite", required_permission="manageMembers")
    target = db.query(models.User).filter(models.User.email == payload.email).first()
    # FIXED: normalize with admin alias support
    role = utils.normalize_role(payload.role or "editor")
    
    # FIXED: Only owner can invite owner role
    if role == "owner" and utils.normalize_role(getattr(current_user, "role", "")) != "owner":
        if not utils.is_owner_user(current_user, db):
            raise HTTPException(status_code=403, detail="Only owner can invite with owner role")
    
    # FIX APPLIED: Retain viewRoleDistribution permission when saving
    permissions_payload = getattr(payload, "permissions", {}) or {}
    if hasattr(permissions_payload, "dict"):
        permissions_payload = permissions_payload.dict()
        
    permissions = utils.normalize_permissions(role, permissions_payload)
    if isinstance(permissions_payload, dict) and "viewRoleDistribution" in permissions_payload:
        permissions["viewRoleDistribution"] = bool(permissions_payload["viewRoleDistribution"])

    if not target:
        password = (payload.password or "").strip()
        if not password:
            raise HTTPException(status_code=400, detail="Password is required when inviting a new user")

        invited_name = payload.email.split("@", 1)[0].strip() or "New member"
        target = models.User(
            email=payload.email,
            name=invited_name,
            password_hash=pwd_context.hash(password),
            role=role,
        )
        db.add(target)
        db.commit()
        db.refresh(target)

        subject = f"Invitation to join {board.name} on WorkFlow SaaS"
        html_body = utils.build_professional_email_html(
            title="Welcome to WorkFlow SaaS ",
            intro=f"<strong>{current_user.name}</strong> has invited you to join <strong>{board.name}</strong> as <strong>{role}</strong>.",
            rows=[
                ("Board", board.name),
                ("Role", role),
                ("Email", payload.email),
                ("Password", password),
            ],
        )
        threading.Thread(target=send_email_safe, args=(payload.email, subject, html_body)).start()
        log_activity_safe(board_id, current_user.name, f"created account and invited {payload.email} as {role}")

    bm = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == target.id).first()
    if not bm:
        db.add(models.BoardMember(board_id=board_id, user_id=target.id, role=role, permissions=json.dumps(permissions, ensure_ascii=False)))
        db.commit()
        log_activity_safe(board_id, current_user.name, f"invited {payload.email} as {role}")
        create_notification_safe(target.id, board_id, None, f"You were invited to board '{board.name}'", "invite", f"Invited to {board.name}")
    else:
        # FIXED: Preserve correct role position - update with normalized role
        bm.role = role
        bm.permissions = json.dumps(permissions, ensure_ascii=False)
        db.commit()
        log_activity_safe(board_id, current_user.name, f"updated {payload.email} role to {role}")

    return {"ok": True, "message": "Invite sent successfully", "role": role, "user_created": target.id is not None}


@app.get("/api/boards/{board_id}/members")
def get_board_members(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board members")
    members = []
    if board:
        owner = db.query(models.User).filter(models.User.id == board.owner_id).first()
        if owner: 
            members.append({"email": owner.email, "name": owner.name, "role": "owner", "id": owner.id, "board_id": board_id, "is_current_user": owner.id == current_user.id, "permissions": utils.default_permissions_for_role("owner")})
            
        for m in db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id).all():
            # Skip if this member is the board owner (already added)
            if m.user_id == board.owner_id:
                continue
            u = db.query(models.User).filter(models.User.id == m.user_id).first()
            if u: 
                normalized_role = utils.normalize_role((m.role or "editor").strip())
                # FIX APPLIED: Ensure viewRoleDistribution is not stripped out when fetching members
                raw_perms = _parse_json(m.permissions, {})
                permissions = utils.normalize_permissions(normalized_role, raw_perms)
                
                if isinstance(raw_perms, dict) and "viewRoleDistribution" in raw_perms:
                    permissions["viewRoleDistribution"] = bool(raw_perms["viewRoleDistribution"])
                    
                members.append({"email": u.email, "name": u.name, "role": normalized_role, "id": u.id, "board_id": board_id, "is_current_user": u.id == current_user.id, "permissions": permissions})
                
    return members


@app.put("/api/boards/{board_id}/members/{user_id}")
def update_board_member_role(board_id: int, user_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Member role update", required_permission="manageMembers")

    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if user_id == board.owner_id:
        raise HTTPException(status_code=400, detail="Board owner role cannot be changed")

    role = utils.normalize_role(payload.get("role", "editor") or "editor")
    if role not in {"owner", "administrator", "editor", "guest", "subscriber"}:
        raise HTTPException(status_code=400, detail="Role must be owner, administrator, editor, guest, subscriber")

    # FIXED: Only owner can assign owner role
    if role == "owner" and utils.normalize_role(getattr(current_user, "role", "")) != "owner":
        if not utils.is_owner_user(current_user, db):
            raise HTTPException(status_code=403, detail="Only owner can assign owner role")

    # FIX APPLIED: Retain viewRoleDistribution permission when saving
    permissions_payload = payload.get("permissions") or {}
    permissions = utils.normalize_permissions(role, permissions_payload)
    if isinstance(permissions_payload, dict) and "viewRoleDistribution" in permissions_payload:
        permissions["viewRoleDistribution"] = bool(permissions_payload["viewRoleDistribution"])

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    member = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).first()
    if member:
        member.role = role
        member.permissions = json.dumps(permissions, ensure_ascii=False)
    else:
        member = models.BoardMember(board_id=board_id, user_id=user_id, role=role, permissions=json.dumps(permissions, ensure_ascii=False))
        db.add(member)

    db.commit()
    log_activity_safe(board_id, current_user.name, f"updated {target.email} access to {role}")
    return {"ok": True, "message": "Member role updated", "role": role, "permissions": permissions}


@app.delete("/api/boards/{board_id}/members/{user_id}")
def remove_board_member(board_id: int, user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Member removal", required_permission="manageMembers")

    if user_id == board.owner_id:
        raise HTTPException(status_code=400, detail="Board owner cannot be removed")

    member = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    db.delete(member)
    db.commit()
    log_activity_safe(board_id, current_user.name, f"removed {target.email if target else user_id} from board")
    return {"ok": True, "removed": True, "message": "Member removed from board"}


@app.get("/api/boards/{board_id}/activities")
def get_activities(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board activity")
    return db.query(models.Activity).filter(models.Activity.board_id == board_id).order_by(models.Activity.id.desc()).limit(30).all()


# ==========================================
#               NOTIFICATIONS
# ==========================================

@app.get("/api/notifications")
def get_notifications(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Notification).filter(models.Notification.user_id == current_user.id).order_by(models.Notification.id.desc()).limit(50).all()


@app.put("/api/notifications/{notif_id}/read")
def mark_read(notif_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.user_id == current_user.id).first()
    if n: 
        n.is_read = True
        db.commit()
    return {"ok": True}


@app.put("/api/notifications/read-all")
def mark_all_read(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.Notification).filter(models.Notification.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"ok": True}


@app.delete("/api/notifications/{notif_id}")
def delete_notif(notif_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.user_id == current_user.id).first()
    if n: 
        db.delete(n)
        db.commit()
    return {"ok": True}


# ==========================================
#               AUTOMATIONS
# ==========================================

@app.get("/api/boards/{board_id}/automations")
def get_automations(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="View automations", required_permission="viewAutomations")
    return db.query(Automation).filter(Automation.board_id == board_id).all()


@app.post("/api/boards/{board_id}/automations")
def create_automation(board_id: int, payload: AutomationCreatePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Create automation", required_permission="manageAutomations")
    rule = Automation(
        board_id=board_id,
        trigger_type=payload.trigger_type,
        trigger_condition=payload.trigger_condition,
        action_type=payload.action_type,
        action_payload=payload.action_payload,
        is_active=payload.is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@app.put("/api/boards/{board_id}/automations/{rule_id}")
def update_automation(board_id: int, rule_id: int, payload: AutomationCreatePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Update automation", required_permission="manageAutomations")
    rule = db.query(Automation).filter(Automation.id == rule_id, Automation.board_id == board_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    rule.trigger_type = payload.trigger_type
    rule.trigger_condition = payload.trigger_condition
    rule.action_type = payload.action_type
    rule.action_payload = payload.action_payload
    rule.is_active = payload.is_active
    
    db.commit()
    db.refresh(rule)
    return rule


@app.delete("/api/boards/{board_id}/automations/{rule_id}")
def delete_automation(board_id: int, rule_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Delete automation", required_permission="manageAutomations")
    rule = db.query(Automation).filter(Automation.id == rule_id, Automation.board_id == board_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    db.delete(rule)
    db.commit()
    return {"ok": True}


# ==========================================
#                   TASKS
# ==========================================

@app.get("/api/tasks")
def list_tasks(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Task list")
    tasks = db.query(models.Task).filter(models.Task.board_id == board_id).all()

    # Activities are exposed separately via /api/tasks/{task_id}/activities to
    # keep this payload small.
    return [_task_response(t) for t in tasks]


@app.post("/api/tasks")
async def create_task(payload: schemas.TaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.board_id:
        utils.ensure_board_access(payload.board_id, current_user, db, required_role="editor", action="Task creation", required_permission="createTasks")
        board_owner = db.query(models.Board).filter(models.Board.id == payload.board_id).first()
        if board_owner:
            owner_u = db.query(models.User).filter(models.User.id == board_owner.owner_id).first()
            task_count = db.query(models.Task).filter(models.Task.board_id == payload.board_id).count()
            if owner_u and owner_u.subscription_tier == "free" and task_count >= 20:
                raise HTTPException(status_code=402, detail="Board limit reached (20 tasks for Free plan).")

    # dependencies/recurring are TEXT columns; binding the parsed Python objects
    # directly makes the driver reject them ("can't adapt type 'list'" on psycopg2).
    # board_id is set explicitly below: it is excluded from TASK_WRITABLE_FIELDS
    # so that updates can never relocate a task to another board.
    task_kwargs = {
        k: v for k, v in payload.model_dump().items()
        if k in TASK_WRITABLE_FIELDS or k == "board_id"
    }
    task_kwargs["board_id"] = payload.board_id
    task_kwargs["dependencies"] = _dump_json(task_kwargs.get("dependencies") or [], [])
    task_kwargs["recurring"] = _dump_json(task_kwargs.get("recurring"), {}) if task_kwargs.get("recurring") else ""
    stamp = now_str()
    task_kwargs["created_at"] = stamp
    task_kwargs["updated_at"] = stamp

    t = models.Task(**task_kwargs, user_id=current_user.id)
    db.add(t)
    db.commit()
    db.refresh(t)

    if payload.board_id:
        log_activity_safe(payload.board_id, current_user.name, f"created task '{payload.title}'", task_id=t.id)

        if apply_automations(t, payload.board_id, "create", "", db):
            t.updated_at = now_str()
            db.commit()
            db.refresh(t)

        await manager.broadcast(payload.board_id, {"type": "update"})

    return _task_response(t)


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: int, payload: schemas.TaskUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    utils.ensure_board_access(t.board_id, current_user, db, required_role="editor", action="Task update", required_permission="editTasks")

    # TaskUpdate declares no id/user_id/board_id field, so Pydantic drops them.
    # This blocks primary-key and cross-board writes while still accepting the full
    # task object the offline queue replays (App.jsx saveEdit -> saveOfflineAction).
    changes = payload.model_dump(exclude_unset=True)

    old_status, old_assign, old_title = t.status, t.assigned_to, t.title

    # Blocker validation: doing/done requires every dependency to be done.
    new_status = changes.get("status", t.status)
    if new_status in ("doing", "done"):
        raw_deps = changes.get("dependencies", getattr(t, "dependencies", "[]"))
        dep_ids = [d for d in (_to_int(x) for x in (_parse_json(raw_deps, []) or [])) if d is not None]
        if dep_ids:
            for dt in db.query(models.Task).filter(models.Task.id.in_(dep_ids)).all():
                if dt.status != "done":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot change status to '{new_status}' because dependency task '{dt.title}' is not done."
                    )

    for k, v in changes.items():
        if k not in TASK_WRITABLE_FIELDS:
            continue
        if k == "dependencies":
            setattr(t, k, _dump_json([str(d) for d in (_to_int(x) for x in (v or [])) if d is not None], []))
        elif k == "recurring":
            setattr(t, k, _dump_json(v, {}) if v else "")
        else:
            setattr(t, k, v)

    # Rules run against the in-session object and ride the same commit, so they
    # cannot recurse back through this endpoint.
    if t.board_id and "status" in changes and new_status != old_status:
        apply_automations(t, t.board_id, "update", old_status, db)

    t.updated_at = now_str()
    db.commit()
    db.refresh(t)

    if t.board_id:
        actor = current_user.name if current_user.name else "Someone"
        if old_status != t.status:
            log_activity_safe(t.board_id, actor, f"moved '{t.title}' {old_status}->{t.status}", task_id=t.id)
        if old_title != t.title:
            log_activity_safe(t.board_id, actor, f"renamed task to '{t.title}'", task_id=t.id)
        if old_assign != t.assigned_to and t.assigned_to:
            au = db.query(models.User).filter(models.User.email == t.assigned_to).first()
            if au:
                create_notification_safe(au.id, t.board_id, t.id, f"You were assigned to '{t.title}'", "assign", f"Assigned: {t.title}")

        await manager.broadcast(t.board_id, {"type": "update"})

    return _task_response(t)


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404)
    utils.ensure_board_access(t.board_id, current_user, db, required_role="editor", action="Task deletion", required_permission="deleteTasks")

    bid = t.board_id
    db.query(models.Comment).filter(models.Comment.task_id == task_id).delete(synchronize_session=False)
    db.query(models.Subtask).filter(models.Subtask.task_id == task_id).delete(synchronize_session=False)
    db.query(models.Activity).filter(models.Activity.task_id == task_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.task_id == task_id).delete(synchronize_session=False)

    # Drop this task from any blocker list that still references it, otherwise
    # the ids accumulate forever and the blocker check keeps querying dead rows.
    if bid:
        for other in db.query(models.Task).filter(models.Task.board_id == bid).all():
            deps = _parse_json(getattr(other, "dependencies", "[]"), []) or []
            if str(task_id) in [str(d) for d in deps]:
                remaining = [str(d) for d in deps if str(d) != str(task_id)]
                other.dependencies = _dump_json(remaining, [])
                other.updated_at = now_str()

    db.delete(t)
    db.commit()
    
    if bid: 
        await manager.broadcast(bid, {"type": "update"})
        
    return {"ok": True}


@app.get("/api/tasks/{task_id}/activities")
def get_task_activities(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="subscriber", action="Task activity view")

    # No blanket except: silently returning [] here would hide a missing
    # activities.task_id column as a permanently empty log.
    rows = (db.query(models.Activity)
              .filter(models.Activity.task_id == task_id)
              .order_by(models.Activity.id.desc()).limit(50).all())
    return [{"user": r.user_name, "action": r.action, "timestamp": r.created_at} for r in rows]


# ==========================================
#          THIRD-PARTY INTEGRATIONS
# ==========================================

# Each provider declares how it is authenticated and what it needs. The frontend
# mirrors this shape, so adding a provider is a data change in both places.
#   kind: "webhook" -> we store a URL and POST to it (Slack/Discord/Teams/Zapier)
#   kind: "token"   -> user supplies a long-lived credential we validate
#   kind: "oauth"   -> requires a redirect flow; not wired up yet
INTEGRATION_PROVIDERS = {
    "github":     {"label": "GitHub / GitLab", "kind": "token",   "fields": ["repo"]},
    "slack":      {"label": "Slack",           "kind": "webhook", "fields": ["webhook"]},
    "drive":      {"label": "Google Drive",    "kind": "oauth",   "fields": []},
    "jira":       {"label": "Jira Software",   "kind": "token",   "fields": ["url", "token"]},
    "discord":    {"label": "Discord",         "kind": "webhook", "fields": ["webhook"]},
    "teams":      {"label": "Microsoft Teams", "kind": "webhook", "fields": ["webhook"]},
    "zoom":       {"label": "Zoom Meetings",   "kind": "oauth",   "fields": []},
    "toggl":      {"label": "Toggl Track",     "kind": "token",   "fields": ["api_key"]},
    "gcalendar":  {"label": "Google Calendar", "kind": "oauth",   "fields": []},
    "figma":      {"label": "Figma",           "kind": "token",   "fields": ["token"]},
    "notion":     {"label": "Notion",          "kind": "token",   "fields": ["workspace"]},
    "dropbox":    {"label": "Dropbox",         "kind": "oauth",   "fields": []},
    "sentry":     {"label": "Sentry",          "kind": "token",   "fields": ["project_url", "token"]},
    "zapier":     {"label": "Zapier",          "kind": "webhook", "fields": ["webhook"]},
}

# Secrets are never returned to the client at all: `_integration_response` reports
# only *which* fields are configured, never their values. The set of secret field
# names therefore has no server-side use and is not duplicated here.
#
# (An earlier `INTEGRATION_SECRET_FIELDS` set and an `INTEGRATION_PROBE` lambda map
# were left over from a first pass and were never referenced. The GitHub probe is
# the right idea but needs a real `token` field, which the github provider does
# not collect - it only takes `repo`. See test_integration for the current
# behaviour.)


def _integration_response(row: models.Integration) -> dict:
    """Public shape of an integration. Credentials are never included - only
    whether a value is present, so the UI can render 'Configured'."""
    cfg = {}
    try:
        cfg = utils.decrypt_config(row.config_enc)
    except HTTPException:
        # Key missing/rotated. Report the state rather than leaking or 500ing the
        # whole board listing.
        return {
            "id": row.id,
            "board_id": row.board_id,
            "provider": row.provider,
            "status": "error",
            "configured_fields": [],
            "external_account": row.external_account,
            "last_synced_at": row.last_synced_at,
            "last_error": "Stored credentials could not be decrypted. Check INTEGRATION_ENCRYPTION_KEY.",
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
    return {
        "id": row.id,
        "board_id": row.board_id,
        "provider": row.provider,
        "status": row.status,
        "configured_fields": sorted(k for k, v in cfg.items() if v),
        "external_account": row.external_account,
        "last_synced_at": row.last_synced_at,
        "last_error": row.last_error,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@app.get("/api/boards/{board_id}/integrations")
def list_integrations(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="View integrations", required_permission="viewBoard")
    rows = db.query(models.Integration).filter(models.Integration.board_id == board_id).order_by(models.Integration.provider.asc()).all()
    return {
        "providers": INTEGRATION_PROVIDERS,
        "integrations": [_integration_response(r) for r in rows],
    }


@app.post("/api/boards/{board_id}/integrations")
def upsert_integration(board_id: int, payload: schemas.IntegrationUpsert, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Manage integrations", required_permission="manageBoard")

    spec = INTEGRATION_PROVIDERS.get(payload.provider)
    if not spec:
        raise HTTPException(status_code=400, detail=f"Unknown provider '{payload.provider}'.")

    submitted = (payload.config or {})

    if spec["kind"] == "oauth":
        raise HTTPException(
            status_code=501,
            detail=f"{spec['label']} requires an OAuth application registration and is not available yet.",
        )

    merged = {}
    row = db.query(models.Integration).filter(
        models.Integration.board_id == board_id,
        models.Integration.provider == payload.provider,
    ).first()

    if row:
        # Preserve existing secrets when the client sends a blank value, so
        # editing a non-secret field does not wipe the stored credential.
        try:
            merged = utils.decrypt_config(row.config_enc)
        except HTTPException:
            merged = {}
        row.status = "connected"

    allowed = set(spec["fields"])
    unknown = set(submitted) - allowed
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unexpected field(s): {', '.join(sorted(unknown))}.")

    for field in allowed:
        value = submitted.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        value = value.strip() if isinstance(value, str) else value
        if field in ("webhook", "url", "project_url"):
            utils.assert_safe_outbound_url(value)
        merged[field] = value

    missing = [f for f in allowed if not merged.get(f)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required field(s): {', '.join(missing)}.")

    if not row:
        row = models.Integration(
            board_id=board_id,
            provider=payload.provider,
            created_by=current_user.id,
            created_at=utils.now_str(),
        )
        db.add(row)

    row.config_enc = utils.encrypt_config(merged)
    row.status = "connected"
    row.last_error = ""
    row.updated_at = utils.now_str()
    # A descriptive, non-secret label so the UI can show what is connected.
    row.external_account = merged.get("repo") or merged.get("workspace") or merged.get("url") or merged.get("project_url") or ""

    db.commit()
    db.refresh(row)

    log_activity_safe(board_id, current_user.name or "Someone", f"connected integration {spec['label']}")
    return _integration_response(row)


@app.delete("/api/boards/{board_id}/integrations/{provider}")
def delete_integration(board_id: int, provider: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Manage integrations", required_permission="manageBoard")
    spec = INTEGRATION_PROVIDERS.get(provider)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Unknown provider '{provider}'.")

    row = db.query(models.Integration).filter(
        models.Integration.board_id == board_id,
        models.Integration.provider == provider,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="That integration is not connected.")

    # Wipe the encrypted blob rather than leaving a usable credential behind.
    row.config_enc = ""
    row.status = "disconnected"
    row.external_account = ""
    row.last_synced_at = ""
    row.last_error = ""
    row.updated_at = utils.now_str()
    db.commit()

    log_activity_safe(board_id, current_user.name or "Someone", f"disconnected integration {spec['label']}")
    return {"ok": True, "provider": provider, "status": "disconnected"}


@app.post("/api/boards/{board_id}/integrations/{provider}/test")
def test_integration(board_id: int, provider: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Test integrations", required_permission="manageBoard")
    spec = INTEGRATION_PROVIDERS.get(provider)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Unknown provider '{provider}'.")

    row = db.query(models.Integration).filter(
        models.Integration.board_id == board_id,
        models.Integration.provider == provider,
    ).first()
    if not row or row.status != "connected":
        raise HTTPException(status_code=400, detail="Connect this integration before testing it.")

    cfg = utils.decrypt_config(row.config_enc)

    checked_at = utils.timestamp_iso()

    def fail(message):
        row.last_error = message
        row.updated_at = utils.now_str()
        db.commit()
        raise HTTPException(status_code=400, detail=message)

    try:
        if spec["kind"] == "webhook":
            # assert_safe_outbound_url was applied at connect time, but re-check:
            # DNS can change between save and use (DNS rebinding).
            url = utils.assert_safe_outbound_url(cfg.get("webhook", ""))
            resp = requests.post(
                url,
                json={"text": f"WorkFlow SaaS connection test for board {board_id}.", "content": "Connection test."},
                timeout=utils.OUTBOUND_TIMEOUT,
                allow_redirects=False,
            )
            if resp.status_code >= 400:
                fail(f"{spec['label']} rejected the test payload (HTTP {resp.status_code}).")

        elif spec["kind"] == "token":
            if not cfg.get("token") and not cfg.get("api_key"):
                fail(f"{spec['label']} has no API token configured.")
            # Without a provider-specific validator yet, confirm the value is at
            # least well-formed rather than claiming a success we did not verify.
            if provider == "sentry" and not cfg.get("project_url"):
                fail("Sentry requires a project URL.")

        else:
            fail(f"{spec['label']} does not support connection testing yet.")

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        fail(f"{spec['label']} did not respond within {utils.OUTBOUND_TIMEOUT}s.")
    except requests.exceptions.RequestException as e:
        fail(f"Could not reach {spec['label']}: {type(e).__name__}.")

    row.last_synced_at = checked_at
    row.last_error = ""
    row.updated_at = utils.now_str()
    db.commit()
    db.refresh(row)

    return _integration_response(row)


# ==========================================
#           SUBTASKS & COMMENTS
# ==========================================

@app.get("/api/tasks/{task_id}/subtasks")
def get_subtasks(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="subscriber", action="Subtask view")
    return db.query(models.Subtask).filter(models.Subtask.task_id == task_id).order_by(models.Subtask.id.asc()).all()


@app.post("/api/tasks/{task_id}/subtasks")
async def add_subtask(task_id: int, payload: schemas.SubtaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Subtask creation", required_permission="createTasks")

    s = models.Subtask(title=payload.title, task_id=task_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    
    if task.board_id: 
        await manager.broadcast(task.board_id, {"type": "update"})
        
    return s


@app.put("/api/subtasks/{sub_id}")
async def update_subtask(sub_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(models.Subtask).filter(models.Subtask.id == sub_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subtask not found")
    task = db.query(models.Task).filter(models.Task.id == s.task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Subtask update", required_permission="editTasks")
    if s:
        s.is_completed = payload.get("is_completed", s.is_completed)
        db.commit()
        db.refresh(s)
        
        if task and task.board_id: 
            await manager.broadcast(task.board_id, {"type": "update"})
            
    return s


@app.delete("/api/subtasks/{sub_id}")
async def delete_subtask(sub_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(models.Subtask).filter(models.Subtask.id == sub_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subtask not found")
    task = db.query(models.Task).filter(models.Task.id == s.task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Subtask deletion", required_permission="deleteTasks")
    tid = s.task_id
    t = db.query(models.Task).filter(models.Task.id == tid).first()
    db.delete(s)
    db.commit()
    
    if t and t.board_id: 
        await manager.broadcast(t.board_id, {"type": "update"})
            
    return {"ok": True}


@app.get("/api/tasks/{task_id}/comments")
def get_comments(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="subscriber", action="Comment view")
    return db.query(models.Comment).filter(models.Comment.task_id == task_id).order_by(models.Comment.id.asc()).all()


@app.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id: int, payload: schemas.CommentCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Comment creation", required_permission="createTasks")

    c = models.Comment(
        text=payload.text, 
        task_id=task_id, 
        user_id=current_user.id, 
        user_name=current_user.name, 
        created_at=now_str()
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    
    if task and task.board_id:
        log_activity_safe(task.board_id, current_user.name, f"commented on '{task.title}'")
        mentions = re.findall(r'@([\w\.-]+@[\w\.-]+)', payload.text)
        
        for m_email in set(mentions):
            au = db.query(models.User).filter(models.User.email == m_email).first()
            if au and au.id != current_user.id:
                create_notification_safe(au.id, task.board_id, task_id, f"{current_user.name} mentioned you in '{task.title}'", "mention", f"Mentioned in {task.title}")
                
        await manager.broadcast(task.board_id, {"type": "update"})
        
    return c


# ==========================================
#               BOARD CHAT
# ==========================================

async def _publish_board_message(board_id: int, user_id: int, user_name: str, text: str):
    """Single write path for board chat so the HTTP route and the WebSocket route
    cannot drift apart in authorization or shape. Caller has already authorized."""
    db = SessionLocal()
    try:
        msg = BoardMessage(
            board_id=board_id,
            user_id=user_id,
            user_name=user_name,
            text=text,
            created_at=now_str(),
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        msg_data = {
            "id": msg.id,
            "board_id": msg.board_id,
            "user_id": msg.user_id,
            "user_name": msg.user_name,
            "text": msg.text,
            "created_at": msg.created_at,
        }
    finally:
        db.close()

    await manager.broadcast(board_id, {"type": "chat", "message": msg_data})
    return msg_data


@app.get("/api/boards/{board_id}/messages")
def get_board_messages(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="View messages")
    messages = db.query(BoardMessage).filter(BoardMessage.board_id == board_id).order_by(BoardMessage.id.asc()).limit(200).all()
    return [
        {
            "id": m.id,
            "board_id": m.board_id,
            "user_id": m.user_id,
            "user_name": m.user_name,
            "text": m.text,
            "created_at": m.created_at
        } for m in messages
    ]

@app.post("/api/boards/{board_id}/messages")
async def create_board_message(board_id: int, payload: BoardMessageCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required")
    # Posting is a write, so it needs createTasks rather than the read-only
    # viewBoard permission the WebSocket path authorises against.
    utils.ensure_board_access(board_id, current_user, db, required_permission="createTasks", action="Post message")
    return await _publish_board_message(board_id, current_user.id, current_user.name, text)


# ==========================================
#               WEBSOCKETS
# ==========================================

@app.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: int):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        try:
            payload = jwt.decode(token, utils.SECRET_KEY, algorithms=[utils.ALGORITHM])
        except Exception:
            await websocket.close(code=1008)
            return

        email = payload.get("sub")
        user = db.query(models.User).filter(models.User.email == email).first() if email else None
        if not user:
            await websocket.close(code=1008)
            return

        # Without this, any authenticated user could subscribe to any board_id
        # and receive every update and chat broadcast for a board they cannot see.
        try:
            utils.ensure_board_access(board_id, user, db, required_role="viewer", action="Board realtime")
        except HTTPException:
            await websocket.close(code=1008)
            return

        # Copy onto primitives before closing: the session is released per frame
        # so a long-lived socket cannot pin a pooled connection.
        user_id, user_name = user.id, user.name
    finally:
        db.close()

    await manager.connect(websocket, board_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                parsed_data = json.loads(data)
            except json.JSONDecodeError:
                continue
            if parsed_data.get("type") != "chat":
                continue
            text_content = (parsed_data.get("text") or "").strip()
            if not text_content:
                continue
            await _publish_board_message(board_id, user_id, user_name, text_content)
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)
    except Exception:
        manager.disconnect(websocket, board_id)
        raise