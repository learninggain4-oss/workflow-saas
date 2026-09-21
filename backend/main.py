import os
import io
import re
import csv
import json
import base64
import traceback
import threading
from datetime import date, timedelta

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

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


# --- DATABASE INITIALIZATION ---
def ensure_database_migrations():
    if "sqlite" not in str(engine.url).lower():
        return

    migrations = [
        ("users", "role", "VARCHAR DEFAULT 'admin'"),
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
        ("comments", "user_name", "VARCHAR DEFAULT ''"),
        ("comments", "created_at", "VARCHAR DEFAULT ''"),
        ("board_members", "role", "VARCHAR DEFAULT 'member'"),
        ("board_members", "permissions", "TEXT DEFAULT '{}'"),
    ]
    try:
        with engine.connect() as conn:
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
            conn.commit()
    except Exception:
        pass


ensure_database_migrations()
models.Base.metadata.create_all(bind=engine)

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


# --- FASTAPI APP SETUP ---
app = FastAPI(
    title="WorkFlow SaaS",
    version="0.1.0",
    description="Professional API documentation for WorkFlow SaaS",
    docs_url=None,
    redoc_url=None,
)

app.swagger_ui_parameters = {
    "persistAuthorization": True,
    "deepLinking": True,
    "filter": True,
    "showExtensions": True,
    "layout": "BaseLayout",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(status_code=400, detail="User exists")
    
    u = models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password), role="admin")
    db.add(u)
    db.commit()
    db.refresh(u)
    
    b = models.Board(name="My Workspace", owner_id=u.id)
    db.add(b)
    db.commit()
    
    return {"ok": True}


@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong password")
    
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
        "role": utils.normalize_role(getattr(current_user, "role", "admin")),
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
    if utils.normalize_role(getattr(current_user, "role", "admin")) != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    users = []
    for user in db.query(models.User).order_by(models.User.id.asc()).all():
        users.append({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": utils.normalize_role(getattr(user, "role", "admin")),
        })
    return users


@app.put("/api/admin/users/{user_id}")
def update_registered_user_role(user_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if utils.normalize_role(getattr(current_user, "role", "admin")) != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot change own role here")

    role = utils.normalize_role(payload.get("role", "admin") or "admin")
    if role not in {"owner", "admin", "member", "contributor", "viewer"}:
        raise HTTPException(status_code=400, detail="Role must be owner, admin, member, contributor, or viewer")

    target.role = role
    db.commit()
    return {"ok": True, "id": target.id, "email": target.email, "role": role}


@app.delete("/api/admin/users/{user_id}")
def delete_registered_user(user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if utils.normalize_role(getattr(current_user, "role", "admin")) != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot delete self")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(models.BoardMember).filter(models.BoardMember.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Comment).filter(models.Comment.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Subtask).filter(models.Subtask.task_id.in_([
        s.id for s in db.query(models.Task).filter(models.Task.user_id == user_id).all()
    ])).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete(synchronize_session=False)
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


@app.post("/api/upgrade")
def upgrade_to_pro(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.subscription_tier = "pro"
    db.commit()
    return {"ok": True, "message": "Upgraded to Pro successfully!"}


@app.post("/api/test-email")
def test_email(current_user=Depends(get_current_user)):
    html_body = f"<h2>Hi {current_user.name}!</h2><p>Your email config works!</p>"
    threading.Thread(
        target=send_email_safe, 
        args=(current_user.email, "✅ WorkFlow SaaS - Email Test", html_body)
    ).start()
    return {"sent": True, "to": current_user.email}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    contents = await file.read()
    if CLOUDINARY_ENABLED:
        try:
            result = cloudinary.uploader.upload(contents, folder="workflow-saas", resource_type="auto")
            return {"url": result.get("secure_url")}
        except Exception:
            pass
            
    base64_encoded = base64.b64encode(contents).decode('utf-8')
    return {"url": f"data:{file.content_type};base64,{base64_encoded}"}


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
    return boards


@app.post("/api/boards")
def create_board(payload: schemas.BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.subscription_tier == "free":
        board_count = db.query(models.Board).filter(models.Board.owner_id == current_user.id).count()
        if board_count >= 3:
            raise HTTPException(status_code=402, detail="Free plan limit reached (Max 3 boards).")
            
    b = models.Board(name=payload.name, owner_id=current_user.id)
    db.add(b)
    db.commit()
    db.refresh(b)
    
    log_activity_safe(b.id, current_user.name, f"created board {b.name}")
    return b


@app.put("/api/boards/{board_id}")
def rename_board(board_id: int, payload: schemas.BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = utils.ensure_board_access(board_id, current_user, db, required_role="admin", action="Board rename", required_permission="manageBoard")
    b.name = payload.name
    db.commit()
    db.refresh(b)
    return b


@app.delete("/api/boards/{board_id}")
async def delete_board(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = utils.ensure_board_access(board_id, current_user, db, required_role="admin", action="Board delete", required_permission="manageBoard")
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
    board = utils.ensure_board_access(board_id, current_user, db, required_role="admin", action="Board invite", required_permission="manageMembers")
    target = db.query(models.User).filter(models.User.email == payload.email).first()
    role = utils.normalize_role(payload.role or "member")
    permissions = utils.normalize_permissions(role, getattr(payload, "permissions", None))
    
    if target:
        bm = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == target.id).first()
        if not bm:
            db.add(models.BoardMember(board_id=board_id, user_id=target.id, role=role, permissions=json.dumps(permissions, ensure_ascii=False)))
            db.commit()
            log_activity_safe(board_id, current_user.name, f"invited {payload.email} as {role}")
            create_notification_safe(target.id, board_id, None, f"You were invited to board '{board.name}'", "invite", f"Invited to {board.name}")
        else:
            bm.role = role
            bm.permissions = json.dumps(permissions, ensure_ascii=False)
            db.commit()
    else:
        subject = f"Join {board.name}"
        html_body = f"<p>{current_user.name} invited you to {board.name} as {payload.role}. Please register.</p>"
        threading.Thread(target=send_email_safe, args=(payload.email, subject, html_body)).start()
        log_activity_safe(board_id, current_user.name, f"sent email invite to {payload.email}")
        
    return {"ok": True, "message": "Invite sent successfully"}


@app.get("/api/boards/{board_id}/members")
def get_board_members(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board members")
    members = []
    if board:
        owner = db.query(models.User).filter(models.User.id == board.owner_id).first()
        if owner: 
            members.append({"email": owner.email, "name": owner.name, "role": "owner", "id": owner.id, "permissions": utils.default_permissions_for_role("owner")})
            
        for m in db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id).all():
            u = db.query(models.User).filter(models.User.id == m.user_id).first()
            if u: 
                normalized_role = utils.normalize_role((m.role or "member").strip())
                permissions = utils.normalize_permissions(normalized_role, _parse_json(m.permissions, {}))
                members.append({"email": u.email, "name": u.name, "role": normalized_role, "id": u.id, "permissions": permissions})
                
    return members


@app.put("/api/boards/{board_id}/members/{user_id}")
def update_board_member_role(board_id: int, user_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="admin", action="Member role update", required_permission="manageMembers")

    if user_id == db.query(models.Board).filter(models.Board.id == board_id).first().owner_id:
        raise HTTPException(status_code=400, detail="Owner access cannot be changed here")

    role = utils.normalize_role(payload.get("role", "member") or "member")
    if role not in {"owner", "admin", "member", "contributor", "viewer"}:
        raise HTTPException(status_code=400, detail="Role must be owner, admin, member, contributor, or viewer")

    permissions_payload = payload.get("permissions") or {}
    permissions = utils.normalize_permissions(role, permissions_payload)

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
    board = utils.ensure_board_access(board_id, current_user, db, required_role="admin", action="Member removal", required_permission="manageMembers")

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
#                   TASKS
# ==========================================

@app.get("/api/tasks")
def list_tasks(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Task list")
    return db.query(models.Task).filter(models.Task.board_id == board_id).all()


@app.post("/api/tasks")
async def create_task(payload: schemas.TaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.board_id:
        utils.ensure_board_access(payload.board_id, current_user, db, required_role="member", action="Task creation", required_permission="createTasks")
        board_owner = db.query(models.Board).filter(models.Board.id == payload.board_id).first()
        if board_owner:
            owner_u = db.query(models.User).filter(models.User.id == board_owner.owner_id).first()
            task_count = db.query(models.Task).filter(models.Task.board_id == payload.board_id).count()
            if owner_u and owner_u.subscription_tier == "free" and task_count >= 20:
                raise HTTPException(status_code=402, detail="Board limit reached (20 tasks for Free plan).")
    
    t = models.Task(**payload.dict(), user_id=current_user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    
    if payload.board_id:
        log_activity_safe(payload.board_id, current_user.name, f"created task '{payload.title}'")
        await manager.broadcast(payload.board_id, {"type": "update"})
        
    return t


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404)
    utils.ensure_board_access(t.board_id, current_user, db, required_role="member", action="Task update", required_permission="editTasks")

    old_status, old_assign = t.status, t.assigned_to
    for k, v in payload.items():
        if hasattr(t, k): 
            setattr(t, k, v)
            
    db.commit()
    db.refresh(t)
    
    if t.board_id:
        if old_status != t.status:
            log_activity_safe(t.board_id, "Someone", f"moved '{t.title}' {old_status}->{t.status}")
        if old_assign != t.assigned_to and t.assigned_to:
            au = db.query(models.User).filter(models.User.email == t.assigned_to).first()
            if au: 
                create_notification_safe(au.id, t.board_id, t.id, f"You were assigned to '{t.title}'", "assign", f"Assigned: {t.title}")
        
        await manager.broadcast(t.board_id, {"type": "update"})
        
    return t


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404)
    utils.ensure_board_access(t.board_id, current_user, db, required_role="member", action="Task deletion", required_permission="deleteTasks")

    bid = t.board_id
    db.query(models.Comment).filter(models.Comment.task_id == task_id).delete(synchronize_session=False)
    db.query(models.Subtask).filter(models.Subtask.task_id == task_id).delete(synchronize_session=False)
    
    db.delete(t)
    db.commit()
    
    if bid: 
        await manager.broadcast(bid, {"type": "update"})
        
    return {"ok": True}


# ==========================================
#           SUBTASKS & COMMENTS
# ==========================================

@app.get("/api/tasks/{task_id}/subtasks")
def get_subtasks(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="viewer", action="Subtask view")
    return db.query(models.Subtask).filter(models.Subtask.task_id == task_id).order_by(models.Subtask.id.asc()).all()


@app.post("/api/tasks/{task_id}/subtasks")
async def add_subtask(task_id: int, payload: schemas.SubtaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    utils.ensure_board_access(task.board_id, current_user, db, required_role="member", action="Subtask creation", required_permission="createTasks")

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
        utils.ensure_board_access(task.board_id, current_user, db, required_role="member", action="Subtask update", required_permission="editTasks")
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
        utils.ensure_board_access(task.board_id, current_user, db, required_role="member", action="Subtask deletion", required_permission="deleteTasks")
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
        utils.ensure_board_access(task.board_id, current_user, db, required_role="viewer", action="Comment view")
    return db.query(models.Comment).filter(models.Comment.task_id == task_id).order_by(models.Comment.id.asc()).all()


@app.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id: int, payload: schemas.CommentCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="member", action="Comment creation", required_permission="createTasks")

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
#               WEBSOCKETS
# ==========================================

@app.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: int):
    await manager.connect(websocket, board_id)
    try:
        while True: 
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)