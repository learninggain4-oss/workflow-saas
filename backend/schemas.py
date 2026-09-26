from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# ==========================================
#               AUTH SCHEMAS
# ==========================================

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: Optional[str] = None


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
    description: str = ""


class InviteRequest(BaseModel):
    email: str
    role: str = "admin"
    password: Optional[str] = None
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
    dependencies: List[str] = []
    recurring: Optional[dict] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    time_estimated: Optional[int] = None
    time_spent: Optional[int] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    attachment_url: Optional[str] = None
    labels: Optional[str] = None
    dependencies: Optional[List[str]] = None
    recurring: Optional[dict] = None


class SubtaskCreate(BaseModel):
    title: str


class CommentCreate(BaseModel):
    text: str


class RecurringConfig(BaseModel):
    frequency: str
    interval: int
    endDate: Optional[str] = None


# ==========================================
#            AUTOMATION SCHEMAS
# ==========================================

class AutomationCreate(BaseModel):
    board_id: int
    trigger: str
    condition: str = ""
    action: str
    target: str = ""
    is_active: bool = True


class AutomationUpdate(BaseModel):
    trigger: Optional[str] = None
    condition: Optional[str] = None
    action: Optional[str] = None
    target: Optional[str] = None
    is_active: Optional[bool] = None


# ==========================================
#           BOARD MESSAGE SCHEMAS
# ==========================================

class BoardMessageCreate(BaseModel):
    board_id: int
    text: str

# 67 - 126