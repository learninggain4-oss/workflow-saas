from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean
from database import Base

# 1. Users Table - login/register
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    password_hash = Column(String, nullable=False)

# 2. Boards Table - workspace / project boards
class Board(Base):
    __tablename__ = "boards"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="My Workspace")
    description = Column(Text, default="") # NEW: Board description
    owner_id = Column(Integer, ForeignKey("users.id"))

# 3. Board Members - invite cheytha users + Role permissions
class BoardMember(Base):
    __tablename__ = "board_members"
    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="member") # admin, member, viewer

# 4. Tasks Table - main task with all features + Time Tracking + Gantt dates
class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(String, default="todo")  # todo / doing / done
    priority = Column(String, default="medium")  # high / medium
    description = Column(Text, default="")  # task details
    start_date = Column(String, default="") # YYYY-MM-DD for Gantt Timeline
    due_date = Column(String, default="")  # YYYY-MM-DD for calendar/Gantt
    time_estimated = Column(Integer, default=0) # in minutes or hours
    time_spent = Column(Integer, default=0) # in minutes or hours
    position = Column(Integer, default=0) # NEW: For drag and drop order
    user_id = Column(Integer, ForeignKey("users.id"))  # creator
    board_id = Column(Integer, nullable=True)  # which board
    assigned_to = Column(String, default="")  # email of assigned user
    assigned_to_name = Column(String, default="")  # name of assigned
    attachment_url = Column(Text, default="")  # cloudinary / base64 url
    labels = Column(String, default="")  # Bug,Feature,Design comma separated

# NEW: 4.5 Subtasks / Checklist Table
class Subtask(Base):
    __tablename__ = "subtasks"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    title = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False)

# 5. Comments Table - task comments + email notify + @Mentions
class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    user_name = Column(String, default="")  # denormalized for fast display
    created_at = Column(String, default="")  # YYYY-MM-DD HH:MM:SS

# 6. Activities Table - board activity feed
class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    user_name = Column(String, default="")
    action = Column(String, default="")  # ex: created task 'X' / invited Y
    created_at = Column(String, default="")

# 7. Notifications Table - bell + email
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))  # receiver
    board_id = Column(Integer, nullable=True)
    task_id = Column(Integer, nullable=True)
    message = Column(String, default="")
    notif_type = Column(String, default="info")  # invite / assign / comment / due / info / mention
    is_read = Column(Boolean, default=False)
    created_at = Column(String, default="")