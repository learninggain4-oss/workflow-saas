from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models
from pydantic import BaseModel

# DB table create cheyyum
Base.metadata.create_all(bind=engine)

app = FastAPI()

# React-il ninnu request block aakaruth
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB session edukkan
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Frontend-il ninnu varunna data-nte model
class Task(BaseModel):
    id: int
    title: str
    status: str
    priority: str = "medium"

# 1. Home Route - 404 varanda irikkan
@app.get("/")
def home():
    return {
        "message": "WorkFlow Backend Live 🚀",
        "docs": "Go to /docs for API docs",
        "api": "/api/tasks"
    }

# 2. Ellam tasks edukkum
@app.get("/api/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return db.query(models.TaskDB).all()

# 3. Puthiya task add cheyyum
@app.post("/api/tasks")
def create_task(task: Task, db: Session = Depends(get_db)):
    db_task = models.TaskDB(
        id=task.id,
        title=task.title,
        status=task.status,
        priority=task.priority
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

# 4. Status maatum - todo -> doing -> done
@app.put("/api/tasks/{task_id}")
def update_task(task_id: int, status: str, db: Session = Depends(get_db)):
    task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id).first()
    if task:
        task.status = status
        db.commit()
        db.refresh(task)
        return task
    return {"error": "Task not found"}

# 5. Task delete cheyyum
@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
        return {"success": True}
    return {"error": "Task not found"}

# 6. AI Suggest - optional
@app.post("/api/ai/suggest")
def ai_suggest(title: str):
    if "urgent" in title.lower() or "bug" in title.lower():
        return {"priority": "high"}
    return {"priority": "medium"}