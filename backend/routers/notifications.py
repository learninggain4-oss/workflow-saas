"""Notification routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core import get_current_user, get_db, models


router = APIRouter()

@router.get("/api/notifications")
def get_notifications(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Notification).filter(models.Notification.user_id == current_user.id).order_by(models.Notification.id.desc()).limit(50).all()


@router.put("/api/notifications/{notif_id}/read")
def mark_read(notif_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.user_id == current_user.id).first()
    if n: 
        n.is_read = True
        db.commit()
    return {"ok": True}


@router.put("/api/notifications/read-all")
def mark_all_read(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.Notification).filter(models.Notification.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.delete("/api/notifications/{notif_id}")
def delete_notif(notif_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.user_id == current_user.id).first()
    if n: 
        db.delete(n)
        db.commit()
    return {"ok": True}
