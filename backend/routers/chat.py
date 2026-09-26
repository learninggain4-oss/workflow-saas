"""Per-board chat routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core import BoardMessage, BoardMessageCreate, SessionLocal, get_current_user, get_db, manager, now_str, utils


router = APIRouter()

async def _publish_board_message(board_id: int, user_id: int, user_name: str, text: str):
    """Single write path for board chat so the HTTP route and the WebSocket route
    cannot drift apart in authorization or shape. Caller has already authorized."""
    db = SessionLocal()
    try:
        msg = BoardMessage(
            board_id=board_id,
            user_id=user_id,
            user_name=user_name,
            text=text,
            created_at=now_str(),
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        msg_data = {
            "id": msg.id,
            "board_id": msg.board_id,
            "user_id": msg.user_id,
            "user_name": msg.user_name,
            "text": msg.text,
            "created_at": msg.created_at,
        }
    finally:
        db.close()

    await manager.broadcast(board_id, {"type": "chat", "message": msg_data})
    return msg_data


@router.get("/api/boards/{board_id}/messages")
def get_board_messages(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="View messages")
    messages = db.query(BoardMessage).filter(BoardMessage.board_id == board_id).order_by(BoardMessage.id.asc()).limit(200).all()
    return [
        {
            "id": m.id,
            "board_id": m.board_id,
            "user_id": m.user_id,
            "user_name": m.user_name,
            "text": m.text,
            "created_at": m.created_at
        } for m in messages
    ]


@router.post("/api/boards/{board_id}/messages")
async def create_board_message(board_id: int, payload: BoardMessageCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required")
    # Posting is a write, so it needs createTasks rather than the read-only
    # viewBoard permission the WebSocket path authorises against.
    utils.ensure_board_access(board_id, current_user, db, required_permission="createTasks", action="Post message")
    return await _publish_board_message(board_id, current_user.id, current_user.name, text)
