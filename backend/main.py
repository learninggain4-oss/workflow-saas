import os
import io
import re
import csv
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
models.Base.metadata.create_all(bind=engine)


# --- FASTAPI APP SETUP ---
app = FastAPI(
    title="WorkFlow SaaS",
    version="0.1.0",
    description="Professional API documentation for WorkFlow SaaS",
    docs_url="/docs",
    redoc_url="/redoc",
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
                <button class="wf-btn wf-btn-secondary">Docs</button>
                <button class="wf-btn wf-btn-primary">Authorize</button>
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
            --wf-bg: #0a1020;
            --wf-bg-2: #111827;
            --wf-panel: rgba(15, 23, 42, 0.82);
            --wf-panel-strong: rgba(17, 24, 39, 0.95);
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
        }

        * { box-sizing: border-box; }

        body {
            background:
                radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%),
                radial-gradient(circle at top right, rgba(168,85,247,0.15), transparent 32%),
                linear-gradient(180deg, #050b16 0%, #0b1220 100%);
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
            background: rgba(9, 14, 24, 0.4);
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
            box-shadow: 0 12px 24px rgba(59, 130, 246, 0.35);
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
            color: #93c5fd;
            font-weight: 800;
        }

        .wf-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .wf-btn {
            border: 1px solid rgba(148, 163, 184, 0.26);
            border-radius: 10px;
            padding: 10px 18px;
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
            transition: 0.2s ease;
        }

        .wf-btn-primary {
            background: linear-gradient(135deg, #2563eb, #3b82f6);
            color: #fff;
            border-color: transparent;
            box-shadow: 0 10px 20px rgba(37, 99, 235, 0.28);
        }

        .wf-btn-secondary {
            background: rgba(15, 23, 42, 0.8);
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
            background: rgba(96, 165, 250, 0.12);
            color: #bfdbfe;
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
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--wf-border);
            box-shadow: 0 18px 35px rgba(15, 23, 42, 0.24);
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
            background: rgba(52, 211, 153, 0.12);
            color: #a7f3d0;
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
            background: rgba(15, 23, 42, 0.76);
            border: 1px solid var(--wf-border);
            border-radius: 18px;
            padding: 28px 30px;
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
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
            background: rgba(15, 23, 42, 0.82);
            border: 1px solid var(--wf-border);
            border-radius: 16px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
            padding: 18px 20px;
            margin-bottom: 20px;
        }

        .swagger-ui .opblock {
            border-radius: 14px !important;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
            border: 1px solid var(--wf-border) !important;
            background: rgba(15, 23, 42, 0.9);
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
            background: linear-gradient(135deg, #2563eb, #3b82f6);
            border: none;
            box-shadow: 0 10px 18px rgba(37, 99, 235, 0.22);
            color: white;
        }

        .swagger-ui .authorization__btn {
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid var(--wf-border);
            color: var(--wf-primary);
            box-shadow: none;
        }

        .swagger-ui section.models {
            border: 1px solid var(--wf-border);
            border-radius: 16px;
            overflow: hidden;
            background: rgba(15, 23, 42, 0.8);
        }

        .swagger-ui .model-box {
            border-radius: 10px;
            border: 1px solid var(--wf-border);
            background: rgba(15, 23, 42, 0.75);
        }

        .swagger-ui textarea,
        .swagger-ui input,
        .swagger-ui select {
            border-radius: 10px;
            border: 1px solid var(--wf-border);
            background: rgba(15, 23, 42, 0.8);
            color: var(--wf-text);
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
    return HTMLResponse(content=html)


# --- EXCEPTION HANDLING ---
@app.exception_handler(Exception)
async def global_handler(request, exc):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# --- STARTUP EVENTS ---
@app.on_event("startup")
def fix_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR DEFAULT 'free'"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_estimated INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id INTEGER"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_name VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_at VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE board_members ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'member'"))
            conn.execute(text("CREATE TABLE IF NOT EXISTS subtasks (id SERIAL PRIMARY KEY, task_id INTEGER, title VARCHAR NOT NULL, is_completed BOOLEAN DEFAULT FALSE)"))
            conn.execute(text("CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER, board_id INTEGER, task_id INTEGER, message VARCHAR DEFAULT '', notif_type VARCHAR DEFAULT 'info', type VARCHAR DEFAULT 'info', is_read BOOLEAN DEFAULT FALSE, created_at VARCHAR DEFAULT '')"))
            conn.commit()
    except Exception:
        pass


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
    
    u = models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password))
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
        "subscription_tier": current_user.subscription_tier
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
    b = db.query(models.Board).filter(models.Board.id == board_id, models.Board.owner_id == current_user.id).first()
    if not b: 
        raise HTTPException(status_code=403, detail="Not owner")
        
    b.name = payload.name
    db.commit()
    db.refresh(b)
    return b


@app.delete("/api/boards/{board_id}")
async def delete_board(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(models.Board).filter(models.Board.id == board_id, models.Board.owner_id == current_user.id).first()
    if not b: 
        raise HTTPException(status_code=403)
        
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
    board = db.query(models.Board).filter(models.Board.id == board_id, models.Board.owner_id == current_user.id).first()
    if not board: 
        raise HTTPException(status_code=403)
        
    target = db.query(models.User).filter(models.User.email == payload.email).first()
    
    if target:
        bm = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == target.id).first()
        if not bm:
            db.add(models.BoardMember(board_id=board_id, user_id=target.id, role=payload.role))
            db.commit()
            log_activity_safe(board_id, current_user.name, f"invited {payload.email} as {payload.role}")
            create_notification_safe(target.id, board_id, None, f"You were invited to board '{board.name}'", "invite", f"Invited to {board.name}")
        else:
            bm.role = payload.role
            db.commit()
    else:
        subject = f"Join {board.name}"
        html_body = f"<p>{current_user.name} invited you to {board.name} as {payload.role}. Please register.</p>"
        threading.Thread(target=send_email_safe, args=(payload.email, subject, html_body)).start()
        log_activity_safe(board_id, current_user.name, f"sent email invite to {payload.email}")
        
    return {"ok": True, "message": "Invite sent successfully"}


@app.get("/api/boards/{board_id}/members")
def get_board_members(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    members = []
    if board:
        owner = db.query(models.User).filter(models.User.id == board.owner_id).first()
        if owner: 
            members.append({"email": owner.email, "name": owner.name, "role": "admin", "id": owner.id})
            
        for m in db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id).all():
            u = db.query(models.User).filter(models.User.id == m.user_id).first()
            if u: 
                members.append({"email": u.email, "name": u.name, "role": m.role, "id": u.id})
                
    return members


@app.get("/api/boards/{board_id}/activities")
def get_activities(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
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
    return db.query(models.Task).filter(models.Task.board_id == board_id).all()


@app.post("/api/tasks")
async def create_task(payload: schemas.TaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.board_id:
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
async def update_task(task_id: int, payload: dict, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t: 
        raise HTTPException(status_code=404)
        
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
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t: 
        raise HTTPException(status_code=404)
        
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
def get_subtasks(task_id: int, db: Session = Depends(get_db)):
    return db.query(models.Subtask).filter(models.Subtask.task_id == task_id).order_by(models.Subtask.id.asc()).all()


@app.post("/api/tasks/{task_id}/subtasks")
async def add_subtask(task_id: int, payload: schemas.SubtaskCreate, db: Session = Depends(get_db)):
    s = models.Subtask(title=payload.title, task_id=task_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if t and t.board_id: 
        await manager.broadcast(t.board_id, {"type": "update"})
        
    return s


@app.put("/api/subtasks/{sub_id}")
async def update_subtask(sub_id: int, payload: dict, db: Session = Depends(get_db)):
    s = db.query(models.Subtask).filter(models.Subtask.id == sub_id).first()
    if s:
        s.is_completed = payload.get("is_completed", s.is_completed)
        db.commit()
        db.refresh(s)
        
        t = db.query(models.Task).filter(models.Task.id == s.task_id).first()
        if t and t.board_id: 
            await manager.broadcast(t.board_id, {"type": "update"})
            
    return s


@app.delete("/api/subtasks/{sub_id}")
async def delete_subtask(sub_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Subtask).filter(models.Subtask.id == sub_id).first()
    if s:
        tid = s.task_id
        t = db.query(models.Task).filter(models.Task.id == tid).first()
        db.delete(s)
        db.commit()
        
        if t and t.board_id: 
            await manager.broadcast(t.board_id, {"type": "update"})
            
    return {"ok": True}


@app.get("/api/tasks/{task_id}/comments")
def get_comments(task_id: int, db: Session = Depends(get_db)):
    return db.query(models.Comment).filter(models.Comment.task_id == task_id).order_by(models.Comment.id.asc()).all()


@app.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id: int, payload: schemas.CommentCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
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
    
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
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