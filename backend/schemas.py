from pydantic import BaseModel
from typing import Optional

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class BoardCreate(BaseModel):
    name: str

class InviteRequest(BaseModel):
    email: str
    role: str = "member"

class TaskCreate(BaseModel):
    title: str
    status: str = "todo"
    priority: str = "medium"
    description: str = ""
    start_date: str = ""
    due_date: str = ""
    time_estimated: int = 0
    time_spent: int = 0
    board_id: Optional[int] = None
    assigned_to: str = ""
    assigned_to_name: str = ""
    attachment_url: str = ""
    labels: str = ""

class CommentCreate(BaseModel):
    text: str

class SubtaskCreate(BaseModel):
    title: str

#(Pydantic Data Validation Models)