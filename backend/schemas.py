from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# ==========================================
#               AUTH SCHEMAS
# ==========================================

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class UserProfileUpdate(BaseModel):
    name: str = ""
    email: str = ""
    password: str = ""
    avatar_url: str = ""
    email_verified: Optional[bool] = None
    two_factor_enabled: Optional[bool] = None
    profile_preferences: Optional[dict] = None
    workspace_defaults: Optional[dict] = None
    connected_apps: Optional[List[dict]] = None
    security_settings: Optional[dict] = None


# ==========================================
#              BOARD SCHEMAS
# ==========================================

class BoardCreate(BaseModel):
    name: str


class InviteRequest(BaseModel):
    email: str
    role: str = "admin"
    permissions: Optional[dict] = None


# ==========================================
#               TASK SCHEMAS
# ==========================================

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


class SubtaskCreate(BaseModel):
    title: str


class CommentCreate(BaseModel):
    text: str