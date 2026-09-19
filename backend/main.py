from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional, Dict, List
import models
from database import SessionLocal, engine
import traceback

models.Base.metadata.create_all(bind=engine)

app = FastAPI()
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
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

@app.on_event("startup")
def fix_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id INTEGER"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_name VARCHAR"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_at VARCHAR"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS text TEXT"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS task_id INTEGER"))
            conn.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_id INTEGER"))
            conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS board_id INTEGER"))
            conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_name VARCHAR"))
            conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS action VARCHAR"))
            conn.execute(text("ALTER TABLE activities ADD COLUMN IF NOT EXISTS created_at VARCHAR"))
            conn.commit()
            print("fix columns ok")
    except Exception as e:
        print("fix columns err", e)
        traceback.print_exc()
    try:
        db = SessionLocal()
        for u in db.query(models.User).all():
            if not db.query(models.Board).filter(models.Board.owner_id == u.id).first():
                b = models.Board(name="My Workspace", owner_id=u.id)
                db.add(b); db.commit(); db.refresh(b)
                db.query(models.Task).filter(models.Task.user_id == u.id).filter(models.Task.board_id == None).update({models.Task.board_id: b.id})
                db.commit()
        db.close()
        print("fix boards ok")
    except Exception as e:
        print("fix boards err", e)
        traceback.print_exc()

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
    async def connect(self, websocket: WebSocket, board_id: int):
        await websocket.accept()
        if board_id not in self.active_connections:
            self.active_connections[board_id] = []
        self.active_connections[board_id].append(websocket)
    def disconnect(self, websocket: WebSocket, board_id: int):
        if board_id in self.active_connections and websocket in self.active_connections[board_id]:
            self.active_connections[board_id].remove(websocket)
    async def broadcast(self, board_id: int, message: dict):
        if board_id in self.active_connections:
            for conn in list(self.active_connections[board_id]):
                try:
                    await conn.send_json(message)
                except:
                    pass

manager = ConnectionManager()

SECRET_KEY = "workflow-saas-secret-2024"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class BoardCreate(BaseModel):
    name: str

class InviteRequest(BaseModel):
    email: str

class TaskCreate(BaseModel):
    title: str
    status: str = "todo"
    priority: str = "medium"
    description: str = ""
    due_date: str = ""
    board_id: Optional[int] = None

class CommentCreate(BaseModel):
    text: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(days=1)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_user_boards(user, db):
    try:
        owned = db.query(models.Board).filter(models.Board.owner_id == user.id).all()
    except:
        owned = []
    try:
        m_ids = [m.board_id for m in db.query(models.BoardMember).filter(models.BoardMember.user_id == user.id).all()]
        m_boards = db.query(models.Board).filter(models.Board.id.in_(m_ids)).all() if m_ids else []
    except:
        m_boards = []
    merged = {b.id: b for b in owned + m_boards}
    return list(merged.values())

def log_activity(board_id, user_name, action, db):
    try:
        a = models.Activity(
            board_id=board_id,
            user_name=user_name,
            action=action,
            created_at=datetime.now().strftime("%m/%d %H:%M")
        )
        db.add(a)
        db.commit()
    except Exception as e:
        print("activity log err", e)

@app.get("/")
def root():
    return {"ok": True, "message": "Workflow SaaS API running"}

@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(status_code=400, detail="User exists")
    u = models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password))
    db.add(u); db.commit(); db.refresh(u)
    b = models.Board(name="My Workspace", owner_id=u.id)
    db.add(b); db.commit()
    return {"ok": True}

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"access_token": create_token({"sub": user.email}), "token_type": "bearer"}

@app.get("/api/boards")
def list_boards(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        boards = get_user_boards(current_user, db)
        if not boards:
            b = models.Board(name="My Workspace", owner_id=current_user.id)
            db.add(b); db.commit(); db.refresh(b)
            boards = [b]
        return boards
    except Exception as e:
        print("boards list err", e)
        traceback.print_exc()
        return []

@app.post("/api/boards")
def create_board(payload: BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        b = models.Board(name=payload.name, owner_id=current_user.id)
        db.add(b); db.commit(); db.refresh(b)
        log_activity(b.id, current_user.name, f"created board {b.name}", db)
        return b
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/boards/{board_id}")
def rename_board(board_id: int, payload: BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(models.Board).filter(models.Board.id == board_id, models.Board.owner_id == current_user.id).first()
    if not b:
        raise HTTPException(status_code=403, detail="Only owner can rename")
    b.name = payload.name
    db.commit(); db.refresh(b)
    log_activity(board_id, current_user.name, f"renamed board to {payload.name}", db)
    return b

@app.delete("/api/boards/{board_id}")
def delete_board(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(models.Board).filter(models.Board.id == board_id, models.Board.owner_id == current_user.id).first()
    if not b:
        raise HTTPException(status_code=403, detail="Only owner can delete")
    db.query(models.Task).filter(models.Task.board_id == board_id).delete()
    db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id).delete()
    db.query(models.Comment).filter(models.Comment.task_id.in_([t.id for t in db.query(models.Task).filter(models.Task.board_id==board_id).all()])).delete(synchronize_session=False)
    db.query(models.Activity).filter(models.Activity.board_id == board_id).delete()
    db.delete(b); db.commit()
    return {"ok": True}

@app.post("/api/boards/{board_id}/invite")
def invite(board_id: int, payload: InviteRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not board_id or str(board_id) == "null":
        raise HTTPException(status_code=422, detail="Select a board first")
    board = db.query(models.Board).filter(models.Board.id == board_id, models.Board.owner_id == current_user.id).first()
    if not board:
        raise HTTPException(status_code=403, detail="Only owner can invite")
    target = db.query(models.User).filter(models.User.email == payload.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found - ask them to register first")
    exists = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == target.id).first()
    if not exists:
        db.add(models.BoardMember(board_id=board_id, user_id=target.id))
        db.commit()
        log_activity(board_id, current_user.name, f"invited {payload.email}", db)
    return {"ok": True}

@app.get("/api/boards/{board_id}/activities")
def get_activities(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return db.query(models.Activity).filter(models.Activity.board_id == board_id).order_by(models.Activity.id.desc()).limit(20).all()
    except Exception as e:
        print("activities err", e)
        return []

@app.get("/api/tasks")
def list_tasks(board_id: Optional[int] = None, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        boards = get_user_boards(current_user, db)
        if not boards:
            return []
        if board_id is None:
            board_id = boards[0].id
        if board_id not in [b.id for b in boards]:
            return []
        return db.query(models.Task).filter(models.Task.board_id == board_id).all()
    except Exception as e:
        print("tasks err", e)
        return []

@app.post("/api/tasks")
async def create_task(payload: TaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        boards = get_user_boards(current_user, db)
        bid = payload.board_id or (boards[0].id if boards else None)
        t = models.Task(title=payload.title, status=payload.status, priority=payload.priority, description=payload.description, due_date=payload.due_date, user_id=current_user.id, board_id=bid)
        db.add(t); db.commit(); db.refresh(t)
        if bid:
            log_activity(bid, current_user.name, f"created task '{payload.title}'", db)
            await manager.broadcast(bid, {"type": "update"})
        return t
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: int, payload: dict, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = t.status
    for k, v in payload.items():
        if hasattr(t, k):
            setattr(t, k, v)
    db.commit(); db.refresh(t)
    if t.board_id:
        if old_status!= t.status:
            # log move
            db2 = SessionLocal()
            user = db2.query(models.User).filter(models.User.id == t.user_id).first()
            name = user.name if user else "Someone"
            log_activity(t.board_id, name, f"moved '{t.title}' {old_status} -> {t.status}", db2)
            db2.close()
        await manager.broadcast(t.board_id, {"type": "update"})
    return t

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    bid = t.board_id if t else None
    title = t.title if t else ""
    db.query(models.Task).filter(models.Task.id == task_id).delete()
    db.commit()
    if bid:
        db2 = SessionLocal()
        log_activity(bid, "Someone", f"deleted task '{title}'", db2)
        db2.close()
        await manager.broadcast(bid, {"type": "update"})
    return {"ok": True}

@app.get("/api/tasks/{task_id}/comments")
def get_comments(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return db.query(models.Comment).filter(models.Comment.task_id == task_id).order_by(models.Comment.id.asc()).all()
    except Exception as e:
        print("get comments err", e)
        traceback.print_exc()
        return []

@app.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id: int, payload: CommentCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        time_now = datetime.now().strftime("%Y-%m-%d %H:%M")
        c = models.Comment(text=payload.text, task_id=task_id, user_id=current_user.id, user_name=current_user.name, created_at=time_now)
        db.add(c); db.commit(); db.refresh(c)
        task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if task and task.board_id:
            log_activity(task.board_id, current_user.name, f"commented on '{task.title}'", db)
            await manager.broadcast(task.board_id, {"type": "update"})
        return c
    except Exception as e:
        print("add comment err", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: int):
    await manager.connect(websocket, board_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)