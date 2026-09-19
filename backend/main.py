from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, date
from pydantic import BaseModel
from typing import Optional, Dict, List
import models
from database import SessionLocal, engine
import traceback, os, base64

try:
    import cloudinary, cloudinary.uploader
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET")
    )
    CLOUDINARY_ENABLED = bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
except:
    CLOUDINARY_ENABLED = False

models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(Exception)
async def global_handler(request, exc):
    print("GLOBAL ERROR:", exc); traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": str(exc)}, headers={"Access-Control-Allow-Origin": "*"})

@app.on_event("startup")
def fix_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id INTEGER"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT ''"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_name VARCHAR"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_at VARCHAR"))
            conn.execute(text("CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER, board_id INTEGER, task_id INTEGER, message VARCHAR, type VARCHAR DEFAULT 'info', is_read BOOLEAN DEFAULT FALSE, created_at VARCHAR)"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INTEGER"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS board_id INTEGER"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id INTEGER"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message VARCHAR"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'info'"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at VARCHAR"))
            conn.commit()
            print("fix ok")
    except Exception as e:
        print("fix err", e); traceback.print_exc()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
    async def connect(self, websocket: WebSocket, board_id: int):
        await websocket.accept()
        if board_id not in self.active_connections: self.active_connections[board_id] = []
        self.active_connections[board_id].append(websocket)
    def disconnect(self, websocket: WebSocket, board_id: int):
        if board_id in self.active_connections and websocket in self.active_connections[board_id]:
            self.active_connections[board_id].remove(websocket)
    async def broadcast(self, board_id: int, message: dict):
        if board_id in self.active_connections:
            for conn in list(self.active_connections[board_id]):
                try: await conn.send_json(message)
                except: pass

manager = ConnectionManager()

SECRET_KEY="workflow-saas-secret-2024"; ALGORITHM="HS256"
pwd_context=CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme=OAuth2PasswordBearer(tokenUrl="/api/login")

class RegisterRequest(BaseModel): email:str; password:str; name:str
class BoardCreate(BaseModel): name:str
class InviteRequest(BaseModel): email:str
class TaskCreate(BaseModel): title:str; status:str="todo"; priority:str="medium"; description:str=""; due_date:str=""; board_id:Optional[int]=None; assigned_to:Optional[str]=""; assigned_to_name:Optional[str]=""; attachment_url:Optional[str]=""

class CommentCreate(BaseModel): text:str

def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()

def create_token(data:dict):
    to_encode=data.copy(); to_encode.update({"exp": datetime.utcnow()+timedelta(days=1)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token:str=Depends(oauth2_scheme), db:Session=Depends(get_db)):
    try:
        payload=jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user=db.query(models.User).filter(models.User.email==payload.get("sub")).first()
        if not user: raise HTTPException(401)
        return user
    except: raise HTTPException(401)

def get_user_boards(user, db):
    try: owned=db.query(models.Board).filter(models.Board.owner_id==user.id).all()
    except: owned=[]
    try:
        m_ids=[m.board_id for m in db.query(models.BoardMember).filter(models.BoardMember.user_id==user.id).all()]
        m_boards=db.query(models.Board).filter(models.Board.id.in_(m_ids)).all() if m_ids else []
    except: m_boards=[]
    merged={b.id:b for b in owned+m_boards}
    return list(merged.values())

def log_activity(board_id, user_name, action, db):
    try:
        a=models.Activity(board_id=board_id, user_name=user_name, action=action, created_at=datetime.now().strftime("%m/%d %H:%M"))
        db.add(a); db.commit()
    except: pass

def create_notification(db, user_id, board_id, task_id, message, n_type="info"):
    try:
        n=models.Notification(user_id=user_id, board_id=board_id, task_id=task_id, message=message, type=n_type, is_read=False, created_at=datetime.now().strftime("%m/%d %H:%M"))
        db.add(n); db.commit()
    except Exception as e: print("notif err", e)

@app.get("/")
def root(): return {"ok":True}

@app.post("/api/register")
def register(req:RegisterRequest, db:Session=Depends(get_db)):
    if db.query(models.User).filter(models.User.email==req.email).first(): raise HTTPException(400, detail="User exists")
    u=models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password)); db.add(u); db.commit(); db.refresh(u)
    b=models.Board(name="My Workspace", owner_id=u.id); db.add(b); db.commit(); return {"ok":True}

@app.post("/api/login")
def login(form_data:OAuth2PasswordRequestForm=Depends(), db:Session=Depends(get_db)):
    user=db.query(models.User).filter(models.User.email==form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash): raise HTTPException(401, detail="Wrong password")
    return {"access_token": create_token({"sub":user.email}), "token_type":"bearer"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    try:
        contents = await file.read()
        if CLOUDINARY_ENABLED:
            try:
                result = cloudinary.uploader.upload(contents, folder="workflow-saas", resource_type="auto")
                return {"url": result.get("secure_url")}
            except Exception as e: print("cloudinary err", e)
        b64 = base64.b64encode(contents).decode("utf-8")
        data_url = f"data:{file.content_type};base64,{b64}"
        if len(data_url) > 1500000: raise HTTPException(400, detail="File too big for base64, add Cloudinary keys")
        return {"url": data_url}
    except HTTPException: raise
    except Exception as e:
        print("upload err", e); traceback.print_exc(); raise HTTPException(500, detail=str(e))

# Boards
@app.get("/api/boards")
def list_boards(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db)
    if not boards:
        b=models.Board(name="My Workspace", owner_id=current_user.id); db.add(b); db.commit(); db.refresh(b); boards=[b]
    return boards

@app.post("/api/boards")
def create_board(payload:BoardCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    b=models.Board(name=payload.name, owner_id=current_user.id); db.add(b); db.commit(); db.refresh(b)
    log_activity(b.id, current_user.name, f"created board {b.name}", db); return b

@app.put("/api/boards/{board_id}")
def rename_board(board_id:int, payload:BoardCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    b=db.query(models.Board).filter(models.Board.id==board_id, models.Board.owner_id==current_user.id).first()
    if not b: raise HTTPException(403)
    b.name=payload.name; db.commit(); db.refresh(b)
    log_activity(board_id, current_user.name, f"renamed board to {payload.name}", db); return b

@app.delete("/api/boards/{board_id}")
async def delete_board(board_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    b=db.query(models.Board).filter(models.Board.id==board_id, models.Board.owner_id==current_user.id).first()
    if not b: raise HTTPException(403)
    task_ids=[t.id for t in db.query(models.Task).filter(models.Task.board_id==board_id).all()]
    if task_ids: db.query(models.Comment).filter(models.Comment.task_id.in_(task_ids)).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.board_id==board_id).delete(synchronize_session=False)
    db.query(models.BoardMember).filter(models.BoardMember.board_id==board_id).delete(synchronize_session=False)
    db.query(models.Activity).filter(models.Activity.board_id==board_id).delete(synchronize_session=False)
    db.delete(b); db.commit(); return {"ok":True}

@app.post("/api/boards/{board_id}/invite")
def invite(board_id:int, payload:InviteRequest, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    if not board_id or str(board_id)=="null": raise HTTPException(422, detail="Select board first")
    board=db.query(models.Board).filter(models.Board.id==board_id, models.Board.owner_id==current_user.id).first()
    if not board: raise HTTPException(403)
    target=db.query(models.User).filter(models.User.email==payload.email).first()
    if not target: raise HTTPException(404, detail="User not found - register first")
    if not db.query(models.BoardMember).filter(models.BoardMember.board_id==board_id, models.BoardMember.user_id==target.id).first():
        db.add(models.BoardMember(board_id=board_id, user_id=target.id)); db.commit()
        log_activity(board_id, current_user.name, f"invited {payload.email}", db)
        create_notification(db, target.id, board_id, None, f"You were invited to board '{board.name}' by {current_user.name}", "invite")
    return {"ok":True}

@app.get("/api/boards/{board_id}/members")
def get_board_members(board_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db)
    if board_id not in [b.id for b in boards]: raise HTTPException(403)
    board=db.query(models.Board).filter(models.Board.id==board_id).first()
    members=[]
    if board:
        owner=db.query(models.User).filter(models.User.id==board.owner_id).first()
        if owner: members.append({"email":owner.email, "name":owner.name})
        for uid in [m.user_id for m in db.query(models.BoardMember).filter(models.BoardMember.board_id==board_id).all()]:
            u=db.query(models.User).filter(models.User.id==uid).first()
            if u: members.append({"email":u.email, "name":u.name})
    return members

@app.get("/api/boards/{board_id}/activities")
def get_activities(board_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    return db.query(models.Activity).filter(models.Activity.board_id==board_id).order_by(models.Activity.id.desc()).limit(20).all()

# Notifications APIs
@app.get("/api/notifications")
def get_notifications(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    # auto due check
    try:
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        due_tasks = db.query(models.Task).filter(models.Task.assigned_to==current_user.email, models.Task.due_date==tomorrow).all()
        for t in due_tasks:
            exists = db.query(models.Notification).filter(models.Notification.user_id==current_user.id, models.Notification.task_id==t.id, models.Notification.type=="due").first()
            if not exists:
                create_notification(db, current_user.id, t.board_id, t.id, f"⚠️ Due tomorrow: '{t.title}'", "due")
    except Exception as e: print("due check err", e)
    return db.query(models.Notification).filter(models.Notification.user_id==current_user.id).order_by(models.Notification.id.desc()).limit(50).all()

@app.put("/api/notifications/{notif_id}/read")
def mark_read(notif_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    n=db.query(models.Notification).filter(models.Notification.id==notif_id, models.Notification.user_id==current_user.id).first()
    if n: n.is_read=True; db.commit()
    return {"ok":True}

@app.put("/api/notifications/read-all")
def mark_all_read(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    db.query(models.Notification).filter(models.Notification.user_id==current_user.id).update({"is_read": True})
    db.commit(); return {"ok":True}

@app.delete("/api/notifications/{notif_id}")
def delete_notif(notif_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    n=db.query(models.Notification).filter(models.Notification.id==notif_id, models.Notification.user_id==current_user.id).first()
    if n: db.delete(n); db.commit()
    return {"ok":True}

# Tasks
@app.get("/api/tasks")
def list_tasks(board_id:Optional[int]=None, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db)
    if not boards: return []
    if board_id is None: board_id=boards[0].id
    if board_id not in [b.id for b in boards]: return []
    return db.query(models.Task).filter(models.Task.board_id==board_id).all()

@app.post("/api/tasks")
async def create_task(payload:TaskCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards=get_user_boards(current_user, db); bid=payload.board_id or (boards[0].id if boards else None)
    t=models.Task(title=payload.title, status=payload.status, priority=payload.priority, description=payload.description, due_date=payload.due_date, user_id=current_user.id, board_id=bid, assigned_to=payload.assigned_to or "", assigned_to_name=payload.assigned_to_name or "", attachment_url=payload.attachment_url or "")
    db.add(t); db.commit(); db.refresh(t)
    if bid:
        log_activity(bid, current_user.name, f"created task '{payload.title}'", db)
        await manager.broadcast(bid, {"type":"update"})
    return t

@app.put("/api/tasks/{task_id}")
async def update_task(task_id:int, payload:dict, db:Session=Depends(get_db)):
    t=db.query(models.Task).filter(models.Task.id==task_id).first()
    if not t: raise HTTPException(404)
    old=t.status; old_assign=t.assigned_to
    for k,v in payload.items():
        if hasattr(t,k): setattr(t,k,v)
    db.commit(); db.refresh(t)
    if t.board_id:
        if old!=t.status:
            try: log_activity(t.board_id, "Someone", f"moved '{t.title}' {old}->{t.status}", db)
            except: pass
        if old_assign!=t.assigned_to and t.assigned_to:
            try:
                log_activity(t.board_id, "Someone", f"assigned '{t.title}' to {t.assigned_to}", db)
                assigned_user = db.query(models.User).filter(models.User.email==t.assigned_to).first()
                if assigned_user:
                    create_notification(db, assigned_user.id, t.board_id, t.id, f"👤 You were assigned to '{t.title}'", "assign")
            except: pass
        await manager.broadcast(t.board_id, {"type":"update"})
    return t

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id:int, db:Session=Depends(get_db)):
    t=db.query(models.Task).filter(models.Task.id==task_id).first()
    if not t: raise HTTPException(404)
    bid=t.board_id
    db.query(models.Comment).filter(models.Comment.task_id==task_id).delete(synchronize_session=False)
    db.delete(t); db.commit()
    if bid: await manager.broadcast(bid, {"type":"update"})
    return {"ok":True}

@app.get("/api/tasks/{task_id}/comments")
def get_comments(task_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    return db.query(models.Comment).filter(models.Comment.task_id==task_id).order_by(models.Comment.id.asc()).all()

@app.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id:int, payload:CommentCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    time_now=datetime.now().strftime("%m/%d %H:%M")
    c=models.Comment(text=payload.text, task_id=task_id, user_id=current_user.id, user_name=current_user.name, created_at=time_now)
    db.add(c); db.commit(); db.refresh(c)
    task=db.query(models.Task).filter(models.Task.id==task_id).first()
    if task and task.board_id:
        log_activity(task.board_id, current_user.name, f"commented on '{task.title}'", db)
        # notify assigned user if not self
        if task.assigned_to and task.assigned_to!= current_user.email:
            assigned_user = db.query(models.User).filter(models.User.email==task.assigned_to).first()
            if assigned_user:
                create_notification(db, assigned_user.id, task.board_id, task.id, f"💬 {current_user.name} commented on '{task.title}'", "comment")
        await manager.broadcast(task.board_id, {"type":"update"})
    return c

@app.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: int):
    await manager.connect(websocket, board_id)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)