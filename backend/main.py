from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
import models
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SECRET_KEY = "workflow-saas-secret-2024"
ALGORITHM = "HS256"
# FIX: bcrypt ozhivakki pbkdf2 aakki
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def create_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(days=1)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user: raise HTTPException(status_code=401)
        return user
    except JWTError:
        raise HTTPException(status_code=401)

@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email==req.email).first():
        raise HTTPException(400, "User already exists")
    user = models.User(email=req.email, name=req.name, password_hash=pwd_context.hash(req.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"msg": "ok"}

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email==form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(401, "Wrong email/password")
    token = create_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/tasks")
def list_tasks(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Task).filter(models.Task.user_id==current_user.id).all()

@app.post("/api/tasks")
def create_task(id: int, title: str, status: str, priority: str, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    t = models.Task(id=id, title=title, status=status, priority=priority, user_id=current_user.id)
    db.add(t); db.commit(); return t

@app.put("/api/tasks/{task_id}")
def update_task(task_id: int, status: str, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id==task_id, models.Task.user_id==current_user.id).first()
    if t: t.status=status; db.commit()
    return t

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.Task).filter(models.Task.id==task_id, models.Task.user_id==current_user.id).delete()
    db.commit()
    return {"ok": True}