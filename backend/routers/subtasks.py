"""Subtask and comment routes."""
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core import create_notification_safe, get_current_user, get_db, log_activity_safe, manager, models, now_str, schemas, utils


router = APIRouter()

@router.get("/api/tasks/{task_id}/subtasks")
def get_subtasks(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="subscriber", action="Subtask view")
    return db.query(models.Subtask).filter(models.Subtask.task_id == task_id).order_by(models.Subtask.id.asc()).all()


@router.post("/api/tasks/{task_id}/subtasks")
async def add_subtask(task_id: int, payload: schemas.SubtaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Subtask creation", required_permission="createTasks")

    s = models.Subtask(title=payload.title, task_id=task_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    
    if task.board_id: 
        await manager.broadcast(task.board_id, {"type": "update"})
        
    return s


@router.put("/api/subtasks/{sub_id}")
async def update_subtask(sub_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(models.Subtask).filter(models.Subtask.id == sub_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subtask not found")
    task = db.query(models.Task).filter(models.Task.id == s.task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Subtask update", required_permission="editTasks")
    if s:
        s.is_completed = payload.get("is_completed", s.is_completed)
        db.commit()
        db.refresh(s)
        
        if task and task.board_id: 
            await manager.broadcast(task.board_id, {"type": "update"})
            
    return s


@router.delete("/api/subtasks/{sub_id}")
async def delete_subtask(sub_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(models.Subtask).filter(models.Subtask.id == sub_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subtask not found")
    task = db.query(models.Task).filter(models.Task.id == s.task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Subtask deletion", required_permission="deleteTasks")
    tid = s.task_id
    t = db.query(models.Task).filter(models.Task.id == tid).first()
    db.delete(s)
    db.commit()
    
    if t and t.board_id: 
        await manager.broadcast(t.board_id, {"type": "update"})
            
    return {"ok": True}


@router.get("/api/tasks/{task_id}/comments")
def get_comments(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task and task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="subscriber", action="Comment view")
    return db.query(models.Comment).filter(models.Comment.task_id == task_id).order_by(models.Comment.id.asc()).all()


@router.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id: int, payload: schemas.CommentCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="editor", action="Comment creation", required_permission="createTasks")

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
