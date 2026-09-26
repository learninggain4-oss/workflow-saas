import os
import re
import json
import traceback
import models
import schemas
import utils
import templates_catalog
import core
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_swagger_ui_oauth2_redirect_html
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import text
from jose import jwt
from database import SessionLocal, engine, get_db
from utils import create_token, get_current_user, get_smtp_config, manager, pwd_context
from routers import auth, automations, boards, chat, notifications, subtasks, tasks


# --- DATABASE INITIALIZATION ---
# True on a hosted service. Render sets RENDER, Railway sets RAILWAY_ENVIRONMENT;
# ENVIRONMENT=production is the manual override. Used to turn silently-broken
# configuration into a loud startup failure.
DEPLOY_ENV = (
    os.getenv("RENDER", "").strip().lower() in ("1", "true", "yes")
    or bool(os.getenv("RAILWAY_ENVIRONMENT", "").strip())
    or os.getenv("ENVIRONMENT", "").strip().lower() in ("production", "prod")
)


def ensure_database_migrations():
    """Bring an existing database up to the current model schema.

    This replaces two behaviours that had silently corrupted the database:

    1. It used to create stub tables as "(id SERIAL PRIMARY KEY)" *before*
       calling create_all(). create_all() only creates *missing* tables, so a
       stub made it skip the real table - and the app then ran against tables
       with no title, status, priority or foreign keys.
    2. It used to keep a hand-written list of columns. That list drifted from
       models.py and missed original columns (users.email, tasks.title, ...).
       It is now derived from the models, so it cannot drift again.
    """
    from sqlalchemy import inspect
    from sqlalchemy.schema import CreateColumn

    # 1. Create any missing tables with their full model schema.
    models.Base.metadata.create_all(bind=engine)

    # 2. Tables that are not part of Base.metadata.
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE IF NOT EXISTS subtasks (id SERIAL PRIMARY KEY, task_id INTEGER, title VARCHAR NOT NULL, is_completed BOOLEAN DEFAULT FALSE)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER, board_id INTEGER, task_id INTEGER, message VARCHAR DEFAULT '', notif_type VARCHAR DEFAULT 'info', type VARCHAR DEFAULT 'info', is_read BOOLEAN DEFAULT FALSE, created_at VARCHAR DEFAULT '')"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS automations (id SERIAL PRIMARY KEY, board_id INTEGER, trigger_type VARCHAR DEFAULT '', trigger_condition VARCHAR DEFAULT '', action_type VARCHAR DEFAULT '', action_payload TEXT DEFAULT '{}', is_active BOOLEAN DEFAULT TRUE)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS board_messages (id SERIAL PRIMARY KEY, board_id INTEGER, user_id INTEGER, user_name VARCHAR DEFAULT '', text TEXT DEFAULT '', created_at VARCHAR DEFAULT '')"))

    # 3. Add any column the models declare that the live table lacks.
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    # "ADD COLUMN IF NOT EXISTS" is Postgres-only; SQLite has no such clause, so
    # rely on the explicit presence check below instead of emitting it.
    if_not_exists = "" if str(engine.url).lower().startswith("sqlite") else "IF NOT EXISTS "
    added = []
    with engine.begin() as conn:
        for model in models.Base.__subclasses__():
            table = getattr(model, "__table__", None)
            if table is None or table.name not in existing_tables:
                continue
            present = {c["name"] for c in inspector.get_columns(table.name)}
            for col in table.columns:
                if col.name in present:
                    continue
                # Strip NOT NULL / UNIQUE: these tables already have rows, and
                # Postgres will not add a NOT NULL column that has no default.
                ddl = str(CreateColumn(col).compile(dialect=engine.dialect))
                ddl = ddl.replace(" NOT NULL", "").replace(" UNIQUE", "")
                conn.execute(text('ALTER TABLE "%s" ADD COLUMN %s%s' % (table.name, if_not_exists, ddl)))
                added.append("%s.%s" % (table.name, col.name))

    if added:
        print("[schema] added %d missing column(s): %s" % (len(added), ", ".join(added)))
    else:
        print("[schema] no missing columns to add")




def verify_schema_matches_models():
    """Assert the live database has every column the models declare.

    `create_all()` only creates missing tables; it never adds columns to an
    existing one, and the hand-written migration list is easy to get out of sync
    with the models. A mismatch here means the service boots but 500s on the
    first query, so catch it at startup and name the exact columns."""
    from sqlalchemy import inspect

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    missing = {}

    for model in models.Base.__subclasses__():
        table = getattr(model, "__table__", None)
        if table is None or table.name not in existing_tables:
            continue
        present = {c["name"] for c in inspector.get_columns(table.name)}
        gaps = sorted(c.name for c in table.columns if c.name not in present)
        if gaps:
            missing[table.name] = gaps

    if not missing:
        print("[schema] verified: database matches model definitions")
        return

    detail = "\n".join(f"      {t}: missing {', '.join(cols)}" for t, cols in sorted(missing.items()))
    message = (
        "[schema] The database is missing columns the application requires. "
        "The service would start and then fail on every request.\n"
        f"   {detail}\n"
        "   Columns are derived from models.py, so a gap here means a table was "
        "created outside this process. Re-run the deploy, or drop and recreate "
        "the affected tables if they hold no data worth keeping."
    )
    if DEPLOY_ENV:
        raise RuntimeError(message)
    print(message)


ensure_database_migrations()
verify_schema_matches_models()


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








# Columns that may be written through the task endpoints. `id`, `user_id` and
# `board_id` are deliberately excluded: `board_id` would let a caller move a task
# onto a board they have no access to, since ensure_board_access only validates
# the task's original board.
TASK_WRITABLE_FIELDS = {
    "title", "description", "status", "priority", "start_date", "due_date",
    "time_estimated", "time_spent", "assigned_to", "assigned_to_name",
    "attachment_url", "labels", "dependencies", "recurring",
}








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
    "https://workflow-saas-production.up.railway.app",
    "https://workflow-saas-sjrk.onrender.com"
]

cors_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", ",".join(default_allowed_origins)).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$|^https://.*\.(netlify\.app|onrender\.com)$",
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

# ==========================================
#                ROUTERS
# ==========================================

app.include_router(auth.router)
app.include_router(boards.router)
app.include_router(notifications.router)
app.include_router(automations.router)
app.include_router(tasks.router)
app.include_router(subtasks.router)
app.include_router(chat.router)

# Re-exported for callers that still import these off the app module
# (the test suite does). Canonical homes are core.py and models.py.
Automation = core.Automation
BoardMessage = core.BoardMessage
AutomationCreatePayload = core.AutomationCreatePayload
BoardMessageCreate = core.BoardMessageCreate
_board_response = core._board_response
_task_response = core._task_response
apply_automations = core.apply_automations
_parse_json = core._parse_json
_dump_json = core._dump_json
_to_int = core._to_int
