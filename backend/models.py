from database import Base
from sqlalchemy import Column, Integer, String

class TaskDB(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    status = Column(String)
    priority = Column(String)