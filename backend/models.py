from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean
from database import Base

# ==========================================
#               USER MODEL
# ==========================================

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    password_hash = Column(String, nullable=False)
    subscription_tier = Column(String, default="free")
    avatar_url = Column(String, default="")
    email_verified = Column(Boolean, default=True)
    two_factor_enabled = Column(Boolean, default=False)
    profile_preferences = Column(Text, default="{}")
    workspace_defaults = Column(Text, default="{}")
    connected_apps = Column(Text, default="[]")


# ==========================================
#              BOARD MODELS
# ==========================================

class Board(Base):
    __tablename__ = "boards"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="My Workspace")
    owner_id = Column(Integer, ForeignKey("users.id"))


class BoardMember(Base):
    __tablename__ = "board_members"
    
    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="admin")
    permissions = Column(String, default="{}")


# ==========================================
#               TASK MODELS
# ==========================================

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(String, default="todo")
    priority = Column(String, default="medium")
    description = Column(Text, default="")
    start_date = Column(String, default="")
    due_date = Column(String, default="")
    time_estimated = Column(Integer, default=0)
    time_spent = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"))
    board_id = Column(Integer, nullable=True)
    assigned_to = Column(String, default="")
    assigned_to_name = Column(String, default="")
    attachment_url = Column(Text, default="")
    labels = Column(String, default="")


class Subtask(Base):
    __tablename__ = "subtasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    title = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False)


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    user_name = Column(String, default="")
    created_at = Column(String, default="")


# ==========================================
#         ACTIVITY & NOTIFICATIONS
# ==========================================

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    user_name = Column(String, default="")
    action = Column(String, default="")
    created_at = Column(String, default="")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    board_id = Column(Integer, nullable=True)
    task_id = Column(Integer, nullable=True)
    message = Column(String, default="")
    notif_type = Column(String, default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(String, default="")