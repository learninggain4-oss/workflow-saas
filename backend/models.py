from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    password_hash = Column(String)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    status = Column(String) # todo, doing, done
    priority = Column(String)
    description = Column(Text, nullable=True, default="")
    due_date = Column(String, nullable=True, default="") # YYYY-MM-DD
    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User")