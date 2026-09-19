from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    password_hash = Column(String, nullable=False)

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

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(String, default="todo")
    priority = Column(String, default="medium")
    description = Column(Text, default="")
    due_date = Column(String, default="")
    user_id = Column(Integer, ForeignKey("users.id"))
    board_id = Column(Integer, nullable=True)
    assigned_to = Column(String, default="")
    assigned_to_name = Column(String, default="")
    attachment_url = Column(Text, default="")
    labels = Column(String, default="")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    user_name = Column(String, default="")
    created_at = Column(String, default="")

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