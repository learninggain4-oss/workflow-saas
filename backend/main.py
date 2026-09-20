from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta, date
from pydantic import BaseModel
from typing import Optional, Dict, List
import models
from database import SessionLocal, engine
import traceback, os, base64, smtplib, ssl, threading, re, io, csv
from email.message import EmailMessage

# Cloudinary optional
try:
    import cloudinary, cloudinary.uploader
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME","").strip(),
        api_key=os.getenv("CLOUDINARY_API_KEY","").strip(),
        api_secret=os.getenv("CLOUDINARY_API_SECRET","").strip()
    )
    CLOUDINARY_ENABLED = bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
except:
    CLOUDINARY_ENABLED = False

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WorkFlow SaaS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_handler(request, exc):
    print("GLOBAL ERROR:", exc)
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": str(exc)})

def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_smtp_config():
    return {
        "host": (os.getenv("SMTP_HOST") or "smtp-relay.brevo.com").strip(),
        "port": int((os.getenv("SMTP_PORT") or "2525").strip()),
        "user": (os.getenv("SMTP_USER") or "").strip(),
        "pass": (os.getenv("SMTP_PASS") or "").strip(),
        "from": (os.getenv("FROM_EMAIL") or os.getenv("SMTP_USER") or "").strip(),
        "brevo_key": (os.getenv("BREVO_API_KEY") or os.getenv("SMTP_PASS") or "").strip()
    }

def send_email_via_brevo_api(to_email: str, subject: str, html_body: str) -> bool:
    cfg = get_smtp_config()
    api_key = cfg["brevo_key"]
    if not api_key.startswith("xkeysib-"):
        return False
    if not cfg["from"]:
        print("Brevo API: FROM_EMAIL missing")
        return False
    try:
        import requests
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {"accept":"application/json", "api-key": api_key, "content-type":"application/json"}
        payload = {
            "sender": {"email": cfg["from"], "name": "WorkFlow SaaS"},
            "to": [{"email": to_email.strip()}],
            "subject": subject,
            "htmlContent": f"<html><body>{html_body}</body></html>"
        }
        print(f"Trying Brevo API to {to_email} from {cfg['from']}")
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        print(f"Brevo API response {resp.status_code}: {resp.text[:1000]}")
        return resp.status_code in [200,201,202]
    except Exception as e:
        print(f"Brevo API fail: {e}")
        traceback.print_exc()
        return False

def try_smtp_once(host, port, user, pwd, from_email, to_email, subject, html_body, use_ssl=False):
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        msg.set_content(html_body, subtype='html')
        ctx = ssl.create_default_context()
        if use_ssl:
            print(f"Trying SMTP SSL {host}:{port}")
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as server:
                server.login(user, pwd)
                server.send_message(msg)
        else:
            print(f"Trying SMTP {host}:{port} STARTTLS")
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()
                server.login(user, pwd)
                server.send_message(msg)
        print(f"✅ EMAIL SENT via {host}:{port}")
        return True
    except Exception as e:
        print(f"❌ SMTP {host}:{port} failed: {e}")
        return False

def send_email_safe(to_email: str, subject: str, html_body: str) -> bool:
    cfg = get_smtp_config()
    if cfg["brevo_key"].startswith("xkeysib-"):
        if send_email_via_brevo_api(to_email, subject, html_body):
            return True
    if not cfg["host"] or not cfg["user"] or not cfg["pass"] or not cfg["from"]:
        print(f"SMTP CONFIG MISSING host:{cfg['host']} user:{cfg['user']} from:{cfg['from']}")
        return False
    for p in [2525, 587, 465]:
        use_ssl = (p == 465)
        if try_smtp_once(cfg["host"], p, cfg["user"], cfg["pass"], cfg["from"], to_email, subject, html_body, use_ssl=use_ssl):
            return True
    print("❌ ALL EMAIL METHODS FAILED")
    return False

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
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notif_type VARCHAR DEFAULT 'info'"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'info'"))
            conn.commit()
            cfg=get_smtp_config()
            print(f"fix_db ok - host:{cfg['host']} from:{cfg['from']} has_brevo:{cfg['brevo_key'][:10]}... cloud:{CLOUDINARY_ENABLED}")
    except Exception as e:
        print("fix_db err", e)

class ConnectionManager:
    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}
    async def connect(self, ws: WebSocket, board_id: int):
        await ws.accept()
        if board_id not in self.active:
            self.active[board_id]=[]
        self.active[board_id].append(ws)
    def disconnect(self, ws: WebSocket, board_id: int):
        if board_id in self.active and ws in self.active[board_id]:
            self.active[board_id].remove(ws)
    async def broadcast(self, board_id: int, msg: dict):
        if board_id in self.active:
            for c in list(self.active[board_id]):
                try:
                    await c.send_json(msg)
                except:
                    pass

manager = ConnectionManager()

SECRET_KEY = os.getenv("SECRET_KEY", "workflow-saas-secret-2024")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

class RegisterRequest(BaseModel):
    email:str; password:str; name:str
class BoardCreate(BaseModel):
    name:str
class InviteRequest(BaseModel):
    email:str; role:str="member"
class TaskCreate(BaseModel):
    title:str; status:str="todo"; priority:str="medium"; description:str=""; start_date:str=""; due_date:str=""; time_estimated:int=0; time_spent:int=0; board_id:Optional[int]=None; assigned_to:str=""; assigned_to_name:str=""; attachment_url:str=""; labels:str=""
class CommentCreate(BaseModel):
    text:str
class SubtaskCreate(BaseModel):
    title:str

def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_token(data:dict):
    to_encode=data.copy()
    to_encode.update({"exp": datetime.utcnow()+timedelta(days=30)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token:str=Depends(oauth2_scheme), db:Session=Depends(get_db)):
    try:
        payload=jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email=payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token no sub")
        user=db.query(models.User).filter(models.User.email==email).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise HTTPException(status_code=401, detail=f"Token invalid: {e}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")

def get_user_boards(user, db):
    owned=db.query(models.Board).filter(models.Board.owner_id==user.id).all()
    mids=[m.board_id for m in db.query(models.BoardMember).filter(models.BoardMember.user_id==user.id).all()]
    mboards=db.query(models.Board).filter(models.Board.id.in_(mids)).all() if mids else []
    return list({b.id:b for b in owned+mboards}.values())

def log_activity_safe(board_id, user_name, action):
    try:
        db2=SessionLocal()
        db2.add(models.Activity(board_id=board_id, user_name=user_name, action=action, created_at=now_str()))
        db2.commit()
        db2.close()
    except:
        pass

def create_notification_safe(user_id, board_id, task_id, message, n_type="info", email_subject=None):
    try:
        db2=SessionLocal()
        u=db2.query(models.User).filter(models.User.id==user_id).first()
        user_email=u.email if u else None
        n=models.Notification(user_id=user_id, board_id=board_id, task_id=task_id, message=message, notif_type=n_type, is_read=False, created_at=now_str())
        db2.add(n)
        db2.commit()
        db2.close()
        
        if user_email and email_subject:
            html_body = f"<div style='font-family:Arial'><h3>{email_subject}</h3><p>{message}</p><p>Open WorkFlow SaaS dashboard.</p></div>"
            threading.Thread(target=send_email_safe, args=(user_email, email_subject, html_body)).start()
    except Exception as e:
        print("notif err", e)

@app.get("/")
def root():
    cfg=get_smtp_config()
    return {"ok":True, "email_host":cfg["host"], "from":cfg["from"], "has_brevo_key": cfg["brevo_key"].startswith("xkeysib-"), "cloudinary":CLOUDINARY_ENABLED}

# NEW: Current user profile route
@app.get("/api/users/me")
def get_user_profile(current_user=Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "subscription_tier": current_user.subscription_tier
    }

# NEW: Mock upgrade to PRO
@app.post("/api/upgrade")
def upgrade_to_pro(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    current_user.subscription_tier = "pro"
    db.commit()
    return {"ok": True, "message": "Upgraded to Pro successfully!"}

@app.post("/api/test-email")
def test_email(current_user=Depends(get_current_user)):
    cfg=get_smtp_config()
    html_body = f"<h2>Hi {current_user.name}!</h2><p>Your email config works!</p><p>Host:{cfg['host']} From:{cfg['from']} HasBrevo:{cfg['brevo_key'].startswith('xkeysib-')}</p>"
    threading.Thread(target=send_email_safe, args=(current_user.email, "✅ WorkFlow SaaS - Email Test", html_body)).start()
    return {"sent":True, "to":current_user.email, "config": {"host":cfg["host"], "port":cfg["port"], "user":cfg["user"], "from":cfg["from"], "has_brevo_key": cfg["brevo_key"].startswith("xkeysib-")}, "hint": "Check your inbox in 1 minute."}

@app.post("/api/register")
def register(req:RegisterRequest, db:Session=Depends(get_db)):
    if db.query(models.User).filter(models.User.email==req.email).first():
        raise HTTPException(status_code=400, detail="User exists")
    u=models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    b=models.Board(name="My Workspace", owner_id=u.id)
    db.add(b)
    db.commit()
    return {"ok":True}

@app.post("/api/login")
def login(form_data:OAuth2PasswordRequestForm=Depends(), db:Session=Depends(get_db)):
    user=db.query(models.User).filter(models.User.email==form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"access_token": create_token({"sub":user.email}), "token_type":"bearer", "id":user.id}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    contents=await file.read()
    if CLOUDINARY_ENABLED:
        try:
            import cloudinary.uploader
            result=cloudinary.uploader.upload(contents, folder="workflow-saas", resource_type="auto")
            return {"url": result.get("secure_url")}
        except Exception as e:
            print("cloudinary err", e)
    b64=base64.b64encode(contents).decode("utf-8")
    return {"url": f"data:{file.content_type};base64,{b64}"}

@app.get("/api/boards")
def list_boards(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db)
    if not boards:
        b=models.Board(name="My Workspace", owner_id=current_user.id)
        db.add(b)
        db.commit()
        db.refresh(b)
        boards=[b]
    return boards

@app.post("/api/boards")
def create_board(payload:BoardCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    # SaaS Limit Check: Free users can only create 3 boards max
    if current_user.subscription_tier == "free":
        owned_count = db.query(models.Board).filter(models.Board.owner_id == current_user.id).count()
        if owned_count >= 3:
            raise HTTPException(status_code=402, detail="Free plan limit reached (Max 3 boards). Please upgrade to Pro.")

    b=models.Board(name=payload.name, owner_id=current_user.id)
    db.add(b)
    db.commit()
    db.refresh(b)
    log_activity_safe(b.id, current_user.name, f"created board {b.name}")
    return b

@app.put("/api/boards/{board_id}")
def rename_board(board_id:int, payload:BoardCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    b=db.query(models.Board).filter(models.Board.id==board_id, models.Board.owner_id==current_user.id).first()
    if not b:
        raise HTTPException(status_code=403, detail="Not owner")
    b.name=payload.name
    db.commit()
    db.refresh(b)
    return b

@app.delete("/api/boards/{board_id}")
async def delete_board(board_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    b=db.query(models.Board).filter(models.Board.id==board_id, models.Board.owner_id==current_user.id).first()
    if not b:
        raise HTTPException(status_code=403, detail="Not owner")
    tids=[t.id for t in db.query(models.Task).filter(models.Task.board_id==board_id).all()]
    if tids:
        db.query(models.Comment).filter(models.Comment.task_id.in_(tids)).delete(synchronize_session=False)
        db.query(models.Subtask).filter(models.Subtask.task_id.in_(tids)).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.board_id==board_id).delete(synchronize_session=False)
    db.query(models.BoardMember).filter(models.BoardMember.board_id==board_id).delete(synchronize_session=False)
    db.query(models.Activity).filter(models.Activity.board_id==board_id).delete(synchronize_session=False)
    db.delete(b)
    db.commit()
    return {"ok":True}

# NEW: Export board data to CSV
@app.get("/api/boards/{board_id}/export")
def export_board_csv(board_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards = get_user_boards(current_user, db)
    if board_id not in [b.id for b in boards]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    tasks = db.query(models.Task).filter(models.Task.board_id == board_id).all()
    
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["ID", "Title", "Status", "Priority", "Assigned To", "Start Date", "Due Date", "Time Est", "Time Spent", "Labels"])
    
    for t in tasks:
        writer.writerow([t.id, t.title, t.status, t.priority, t.assigned_to_name or t.assigned_to, t.start_date, t.due_date, t.time_estimated, t.time_spent, t.labels])
    
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=board_{board_id}_export.csv"
    return response

@app.post("/api/boards/{board_id}/invite")
def invite(board_id:int, payload:InviteRequest, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    board=db.query(models.Board).filter(models.Board.id==board_id, models.Board.owner_id==current_user.id).first()
    if not board:
        raise HTTPException(status_code=403, detail="Not owner")
        
    target=db.query(models.User).filter(models.User.email==payload.email).first()
    
    if target:
        bm = db.query(models.BoardMember).filter(models.BoardMember.board_id==board_id, models.BoardMember.user_id==target.id).first()
        if not bm:
            db.add(models.BoardMember(board_id=board_id, user_id=target.id, role=payload.role))
            db.commit()
            log_activity_safe(board_id, current_user.name, f"invited {payload.email} as {payload.role}")
            create_notification_safe(target.id, board_id, None, f"You were invited to board '{board.name}' by {current_user.name} as {payload.role}", "invite", f"Invited to {board.name}")
        else:
            bm.role = payload.role
            db.commit()
    else:
        subject = f"Invitation to join WorkFlow SaaS - {board.name}"
        html_body = f"<h2>Hi there!</h2><p><b>{current_user.name}</b> has invited you to join their board <b>{board.name}</b> as a {payload.role}.</p><p>Please register on WorkFlow SaaS using this email address ({payload.email}) to collaborate!</p>"
        threading.Thread(target=send_email_safe, args=(payload.email, subject, html_body)).start()
        log_activity_safe(board_id, current_user.name, f"sent email invite to new user {payload.email}")
        
    return {"ok":True, "message": "Invite sent successfully"}

@app.get("/api/boards/{board_id}/members")
def get_board_members(board_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db)
    if board_id not in [b.id for b in boards]:
        raise HTTPException(status_code=403)
    board=db.query(models.Board).filter(models.Board.id==board_id).first()
    members=[]
    if board:
        owner=db.query(models.User).filter(models.User.id==board.owner_id).first()
        if owner:
            members.append({"email":owner.email, "name":owner.name, "role":"admin", "id":owner.id})
        for m in db.query(models.BoardMember).filter(models.BoardMember.board_id==board_id).all():
            u=db.query(models.User).filter(models.User.id==m.user_id).first()
            if u:
                members.append({"email":u.email, "name":u.name, "role":m.role, "id":u.id})
    return members

@app.get("/api/boards/{board_id}/activities")
def get_activities(board_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    return db.query(models.Activity).filter(models.Activity.board_id==board_id).order_by(models.Activity.id.desc()).limit(30).all()

@app.get("/api/notifications")
def get_notifications(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    try:
        tomorrow=(date.today()+timedelta(days=1)).isoformat()
        due_tasks=db.query(models.Task).filter(models.Task.assigned_to==current_user.email, models.Task.due_date==tomorrow).all()
        for t in due_tasks:
            exists=db.query(models.Notification).filter(models.Notification.user_id==current_user.id, models.Notification.task_id==t.id, models.Notification.notif_type=="due").first()
            if not exists:
                create_notification_safe(current_user.id, t.board_id, t.id, f"Due tomorrow: {t.title}", "due", f"Due tomorrow: {t.title}")
    except:
        pass
    return db.query(models.Notification).filter(models.Notification.user_id==current_user.id).order_by(models.Notification.id.desc()).limit(50).all()

@app.put("/api/notifications/{notif_id}/read")
def mark_read(notif_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    n=db.query(models.Notification).filter(models.Notification.id==notif_id, models.Notification.user_id==current_user.id).first()
    if n:
        n.is_read=True
        db.commit()
    return {"ok":True}

@app.put("/api/notifications/read-all")
def mark_all_read(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    db.query(models.Notification).filter(models.Notification.user_id==current_user.id).update({"is_read": True})
    db.commit()
    return {"ok":True}

@app.delete("/api/notifications/{notif_id}")
def delete_notif(notif_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    n=db.query(models.Notification).filter(models.Notification.id==notif_id, models.Notification.user_id==current_user.id).first()
    if n:
        db.delete(n)
        db.commit()
    return {"ok":True}

@app.get("/api/tasks")
def list_tasks(board_id:Optional[int]=None, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db)
    if not boards:
        return []
    if board_id is None:
        board_id=boards[0].id
    if board_id not in [b.id for b in boards]:
        return []
    return db.query(models.Task).filter(models.Task.board_id==board_id).all()

@app.post("/api/tasks")
async def create_task(payload:TaskCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db)
    bid=payload.board_id or (boards[0].id if boards else None)
    
    if bid:
        # SaaS Limit Check: Free users limited to 20 tasks per board
        board_owner = db.query(models.Board).filter(models.Board.id == bid).first()
        if board_owner:
            owner_u = db.query(models.User).filter(models.User.id == board_owner.owner_id).first()
            if owner_u and owner_u.subscription_tier == "free":
                task_count = db.query(models.Task).filter(models.Task.board_id == bid).count()
                if task_count >= 20:
                    raise HTTPException(status_code=402, detail="Board limit reached (20 tasks for Free plan). Board owner must upgrade to Pro.")

    t=models.Task(
        title=payload.title, status=payload.status, priority=payload.priority,
        description=payload.description, start_date=payload.start_date, due_date=payload.due_date,
        time_estimated=payload.time_estimated, time_spent=payload.time_spent,
        user_id=current_user.id, board_id=bid,
        assigned_to=payload.assigned_to or "", assigned_to_name=payload.assigned_to_name or "",
        attachment_url=payload.attachment_url or "", labels=payload.labels or ""
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    if bid:
        log_activity_safe(bid, current_user.name, f"created task '{payload.title}'")
        await manager.broadcast(bid, {"type":"update"})
    return t

@app.put("/api/tasks/{task_id}")
async def update_task(task_id:int, payload:dict, db:Session=Depends(get_db)):
    t=db.query(models.Task).filter(models.Task.id==task_id).first()
    if not t:
        raise HTTPException(status_code=404)
    old_status=t.status
    old_assign=t.assigned_to
    for k,v in payload.items():
        if hasattr(t,k):
            setattr(t,k,v)
    db.commit()
    db.refresh(t)
    if t.board_id:
        if old_status!=t.status:
            log_activity_safe(t.board_id, "Someone", f"moved '{t.title}' {old_status}->{t.status}")
        if old_assign!=t.assigned_to and t.assigned_to:
            db2=SessionLocal()
            au=db2.query(models.User).filter(models.User.email==t.assigned_to).first()
            db2.close()
            if au:
                create_notification_safe(au.id, t.board_id, t.id, f"You were assigned to '{t.title}'", "assign", f"Assigned: {t.title}")
        await manager.broadcast(t.board_id, {"type":"update"})
    return t

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id:int, db:Session=Depends(get_db)):
    t=db.query(models.Task).filter(models.Task.id==task_id).first()
    if not t:
        raise HTTPException(status_code=404)
    bid=t.board_id
    db.query(models.Comment).filter(models.Comment.task_id==task_id).delete(synchronize_session=False)
    db.query(models.Subtask).filter(models.Subtask.task_id==task_id).delete(synchronize_session=False)
    db.delete(t)
    db.commit()
    if bid:
        await manager.broadcast(bid, {"type":"update"})
    return {"ok":True}

# Subtasks API
@app.get("/api/tasks/{task_id}/subtasks")
def get_subtasks(task_id:int, db:Session=Depends(get_db)):
    return db.query(models.Subtask).filter(models.Subtask.task_id==task_id).order_by(models.Subtask.id.asc()).all()

@app.post("/api/tasks/{task_id}/subtasks")
async def add_subtask(task_id:int, payload:SubtaskCreate, db:Session=Depends(get_db)):
    s=models.Subtask(title=payload.title, task_id=task_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    t=db.query(models.Task).filter(models.Task.id==task_id).first()
    if t and t.board_id: await manager.broadcast(t.board_id, {"type":"update"})
    return s

@app.put("/api/subtasks/{sub_id}")
async def update_subtask(sub_id:int, payload:dict, db:Session=Depends(get_db)):
    s=db.query(models.Subtask).filter(models.Subtask.id==sub_id).first()
    if s:
        s.is_completed = payload.get("is_completed", s.is_completed)
        db.commit()
        db.refresh(s)
        t=db.query(models.Task).filter(models.Task.id==s.task_id).first()
        if t and t.board_id: await manager.broadcast(t.board_id, {"type":"update"})
    return s

@app.delete("/api/subtasks/{sub_id}")
async def delete_subtask(sub_id:int, db:Session=Depends(get_db)):
    s=db.query(models.Subtask).filter(models.Subtask.id==sub_id).first()
    if s:
        tid, bid = s.task_id, None
        t=db.query(models.Task).filter(models.Task.id==tid).first()
        if t: bid=t.board_id
        db.delete(s)
        db.commit()
        if bid: await manager.broadcast(bid, {"type":"update"})
    return {"ok":True}

@app.get("/api/tasks/{task_id}/comments")
def get_comments(task_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    return db.query(models.Comment).filter(models.Comment.task_id==task_id).order_by(models.Comment.id.asc()).all()

@app.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id:int, payload:CommentCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    try:
        c=models.Comment(text=payload.text, task_id=task_id, user_id=current_user.id, user_name=current_user.name, created_at=now_str())
        db.add(c)
        db.commit()
        db.refresh(c)
        task=db.query(models.Task).filter(models.Task.id==task_id).first()
        if task and task.board_id:
            log_activity_safe(task.board_id, current_user.name, f"commented on '{task.title}'")
            
            # Mentions Logic (find emails like @user@gmail.com)
            mentions = re.findall(r'@([\w\.-]+@[\w\.-]+)', payload.text)
            db2=SessionLocal()
            for m_email in set(mentions):
                au=db2.query(models.User).filter(models.User.email==m_email).first()
                if au and au.id != current_user.id:
                    create_notification_safe(au.id, task.board_id, task_id, f"{current_user.name} mentioned you in '{task.title}'", "mention", f"You were mentioned in {task.title}")
            
            # Normal assign notification
            if task.assigned_to and task.assigned_to!=current_user.email and task.assigned_to not in mentions:
                au=db2.query(models.User).filter(models.User.email==task.assigned_to).first()
                if au:
                    create_notification_safe(au.id, task.board_id, task_id, f"{current_user.name} commented on '{task.title}'", "comment", f"New comment on {task.title}")
            db2.close()
            
            await manager.broadcast(task.board_id, {"type":"update"})
        return c
    except Exception as e:
        print("comment err", e)
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: int):
    await manager.connect(websocket, board_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)