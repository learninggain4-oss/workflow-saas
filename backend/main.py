from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
import models
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY="workflow-saas-secret-2024"
ALGORITHM="HS256"
pwd_context=CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme=OAuth2PasswordBearer(tokenUrl="/api/login")

class RegisterRequest(BaseModel): email:str; password:str; name:str
class TaskCreate(BaseModel): title:str; status:str="todo"; priority:str="medium"; description:str=""; due_date:str=""
class TaskUpdate(BaseModel): title:Optional[str]=None; status:Optional[str]=None; priority:Optional[str]=None; description:Optional[str]=None; due_date:Optional[str]=None

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
        email=payload.get("sub")
        user=db.query(models.User).filter(models.User.email==email).first()
        if not user: raise HTTPException(401, "Invalid token")
        return user
    except JWTError: raise HTTPException(401, "Invalid token")

@app.post("/api/register")
def register(req:RegisterRequest, db:Session=Depends(get_db)):
    if db.query(models.User).filter(models.User.email==req.email).first(): raise HTTPException(400, "User exists")
    u=models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password))
    db.add(u); db.commit(); return {"ok":True}

@app.post("/api/login")
def login(form_data:OAuth2PasswordRequestForm=Depends(), db:Session=Depends(get_db)):
    user=db.query(models.User).filter(models.User.email==form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash): raise HTTPException(401, "Wrong password")
    return {"access_token": create_token({"sub":user.email}), "token_type":"bearer"}

@app.get("/api/tasks")
def list_tasks(current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    return db.query(models.Task).filter(models.Task.user_id==current_user.id).all()

@app.post("/api/tasks")
def create_task(payload:TaskCreate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    t=models.Task(title=payload.title, status=payload.status, priority=payload.priority, description=payload.description, due_date=payload.due_date, user_id=current_user.id)
    db.add(t); db.commit(); db.refresh(t); return t

@app.put("/api/tasks/{task_id}")
def update_task(task_id:int, payload:TaskUpdate, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    t=db.query(models.Task).filter(models.Task.id==task_id, models.Task.user_id==current_user.id).first()
    if not t: raise HTTPException(404)
    if payload.title is not None: t.title=payload.title
    if payload.status is not None: t.status=payload.status
    if payload.priority is not None: t.priority=payload.priority
    if payload.description is not None: t.description=payload.description
    if payload.due_date is not None: t.due_date=payload.due_date
    db.commit(); db.refresh(t); return t

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id:int, current_user=Depends(get_current_user), db:Session=Depends(get_db)):
    db.query(models.Task).filter(models.Task.id==task_id, models.Task.user_id==current_user.id).delete(); db.commit(); return {"ok":True}