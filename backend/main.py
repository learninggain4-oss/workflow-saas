from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
import models
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def fix_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id INTEGER DEFAULT 1"))
            conn.commit()
    except Exception as e: print(e)

SECRET_KEY="workflow-saas-secret-2024"; ALGORITHM="HS256"
pwd_context=CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme=OAuth2PasswordBearer(tokenUrl="/api/login")

class RegisterRequest(BaseModel): email:str; password:str; name:str
class TaskCreate(BaseModel): title:str; status:str="todo"; priority:str="medium"; description:str=""; due_date:str=""; board_id:int=1
class InviteRequest(BaseModel): email:str
class BoardCreate(BaseModel): name:str

def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()

def create_token(data:dict):
    to_encode=data.copy(); to_encode.update({"exp": datetime.utcnow()+timedelta(days=1)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token:str=Depends(oauth2_scheme), db:Session=Depends(get_db)):
    try:
        payload=jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]); email=payload.get("sub")
        user=db.query(models.User).filter(models.User.email==email).first()
        if not user: raise HTTPException(401); return user
    except JWTError: raise HTTPException(401)

def get_user_boards(current_user, db):
    owned = db.query(models.Board).filter(models.Board.owner_id==current_user.id).all()
    member_board_ids = [m.board_id for m in db.query(models.BoardMember).filter(models.BoardMember.user_id==current_user.id).all()]
    member_boards = db.query(models.Board).filter(models.Board.id.in_(member_board_ids)).all() if member_board_ids else []
    return owned + member_boards

@app.post("/api/register")
def register(req:RegisterRequest, db:Session=Depends(get_db)):
    if db.query(models.User).filter(models.User.email==req.email).first(): raise HTTPException(400, "Exists")
    u=models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password)); db.add(u); db.commit(); db.refresh(u)
    # auto create first board
    b=models.Board(name="My Workspace", owner_id=u.id); db.add(b); db.commit()
    return {"ok":True}

@app.post("/api/login")
def login(form_data:OAuth2PasswordRequestForm=Depends(), db:Session=Depends(get_db)):
    user=db.query(models.User).filter(models.User.email==form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash): raise HTTPException(401, "Wrong password")
    return {"access_token": create_token({"sub":user.email}), "token_type":"bearer"}

@app.get("/api/boards")
def list_boards(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    boards = get_user_boards(current_user, db)
    # first time users ku board illa enkil create
    if not boards:
        b=models.Board(name="My Workspace", owner_id=current_user.id); db.add(b); db.commit(); db.refresh(b); boards=[b]
    return boards

@app.post("/api/boards")
def create_board(payload:BoardCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    b=models.Board(name=payload.name, owner_id=current_user.id); db.add(b); db.commit(); db.refresh(b); return b

@app.post("/api/boards/{board_id}/invite")
def invite(board_id:int, payload:InviteRequest, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    board=db.query(models.Board).filter(models.Board.id==board_id, models.Board.owner_id==current_user.id).first()
    if not board: raise HTTPException(403, "Only owner can invite")
    target=db.query(models.User).filter(models.User.email==payload.email).first()
    if not target: raise HTTPException(404, "User not registered - ask them to register first")
    exists=db.query(models.BoardMember).filter(models.BoardMember.board_id==board_id, models.BoardMember.user_id==target.id).first()
    if not exists:
        db.add(models.BoardMember(board_id=board_id, user_id=target.id)); db.commit()
    return {"ok":True, "invited": payload.email}

@app.get("/api/tasks")
def list_tasks(board_id:int=1, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    # check access
    boards = get_user_boards(current_user, db)
    if board_id not in [b.id for b in boards]: raise HTTPException(403, "No access to board")
    return db.query(models.Task).filter(models.Task.board_id==board_id).all()

@app.post("/api/tasks")
def create_task(payload:TaskCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    t=models.Task(title=payload.title, status=payload.status, priority=payload.priority, description=payload.description, due_date=payload.due_date, user_id=current_user.id, board_id=payload.board_id)
    db.add(t); db.commit(); db.refresh(t); return t

@app.put("/api/tasks/{task_id}")
def update_task(task_id:int, payload:dict, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    t=db.query(models.Task).filter(models.Task.id==task_id).first()
    if not t: raise HTTPException(404)
    for k,v in payload.items():
        if hasattr(t,k): setattr(t,k,v)
    db.commit(); db.refresh(t); return t

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    db.query(models.Task).filter(models.Task.id==task_id).delete(); db.commit(); return {"ok":True}