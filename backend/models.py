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
    role = Column(String, default="administrator")
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
    # No default name: a board must always be created with a name the user chose.
    # A column default here silently named every nameless board "My Workspace".
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    owner_id = Column(Integer, ForeignKey("users.id"))


class BoardMember(Base):
    __tablename__ = "board_members"
    
    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="editor")
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
    
    # New columns added as requested
    dependencies = Column(Text, default="[]")   # JSON array of task ids
    recurring = Column(Text, default="")        # JSON {frequency, interval, endDate}
    # Which due-date reminders have already fired for this task, as
    # {"<automation_id>": "<due_date it fired for>"}. The due date is stored
    # rather than a boolean so that rescheduling a task re-arms its reminder
    # instead of silently never firing again.
    automation_notifications = Column(Text, default="{}")
    created_at = Column(String, default="")
    updated_at = Column(String, default="")


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
    task_id = Column(Integer, nullable=True, index=True)  # Added task_id for filtering per task with index
    user_name = Column(String, default="")
    action = Column(String, default="")
    created_at = Column(String, default="")


# ==========================================
#            AUDIT EVENTS
# ==========================================
# Deliberately separate from Activity. Activity is the friendly per-board feed
# ("renamed task to X") that the UI renders with `action` free text; an audit
# trail is platform-wide governance evidence that needs a fixed vocabulary, the
# source IP, the outcome, and enough structure to be filtered and exported.
# Extending Activity would have meant a schema change under every read path
# that already selects from it.
#
# actor_email and created_at are stored as strings, matching now_str() and the
# rest of this schema. ISO-8601 sorts lexicographically, which is what the
# ordering and date-range queries rely on.

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)

    # When the event happened. String for consistency with every other
    # timestamp column in this schema; ISO-8601 UTC.
    created_at = Column(String, default="", index=True)

    # Who did it. actor_user_id is null for system-origin events (scheduler,
    # migrations, jobs) so those are not mistaken for a human.
    actor_user_id = Column(Integer, nullable=True, index=True)
    actor_email = Column(String, default="", index=True)
    actor_name = Column(String, default="")

    # Fixed vocabulary, not free text. Dot-namespaced so a prefix filter selects
    # a whole family (e.g. "auth." for every sign-in event).
    event_type = Column(String, default="", index=True)

    # Human-readable rendering of the same fact, for exports and audit reviews.
    action = Column(String, default="")

    # What was acted on. target_id is a string because not every target is a
    # row id (an email address, an integration slug, a settings key).
    target_type = Column(String, default="")
    target_id = Column(String, default="")
    target_label = Column(String, default="")

    # Network origin. Stored as text because a proxy chain or an IPv6 literal
    # will not fit a naive integer, and because this is evidence, not a key.
    ip_address = Column(String, default="", index=True)
    user_agent = Column(String, default="")

    # info | notice | warning | critical - drives alerting, not just colour.
    severity = Column(String, default="info", index=True)
    # success | failure | denied. A denied event is the one that usually matters.
    outcome = Column(String, default="success", index=True)

    # Set when the event is scoped to a project, so board-scoped audit views do
    # not have to parse the target columns.
    board_id = Column(Integer, nullable=True, index=True)

    # Free-form structured detail as JSON. Never the place for the fields above:
    # anything filtered or alerted on belongs in a real column. Named `details`
    # because SQLAlchemy reserves `metadata` on declarative models.
    details = Column(Text, default="{}")


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


# ==========================================
#          AUTOMATIONS & BOARD CHAT
# ==========================================
# NOTE: The `automations` and `board_messages` models are declared in
# main.py (Automation, BoardMessage). Declaring them here as well mapped
# two different column sets onto the same MetaData, which raised
# InvalidRequestError at import time. Keep a single definition.