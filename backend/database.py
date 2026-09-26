import os

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- DATABASE CONFIGURATION ---
# The one Postgres driver this app ships is psycopg2 (see requirements.txt).
# SQLAlchemy must be told that explicitly, because the default depends on the
# installed SQLAlchemy version:
#   - 2.0.x: a bare "postgresql://" URL resolves to the psycopg2 dialect
#   - 2.1.x: the same bare URL resolves to the psycopg (v3) dialect
# On 2.1.x that made create_engine() run `import psycopg` and abort startup with
#   ModuleNotFoundError: No module named 'psycopg'
# requirements.txt pins 2.0.54 and the driver is pinned here, so the two are
# independent: a future SQLAlchemy bump cannot silently change it.
PREFERRED_PG_DRIVER = "psycopg2"


def _normalize_database_url(raw_url: str) -> str:
    url = (raw_url or "").strip()

    # Legacy prefix used by older hosted Postgres providers.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    if not url.startswith("postgresql"):
        return url

    parsed = make_url(url)
    if parsed.drivername in ("postgresql", f"postgresql+{PREFERRED_PG_DRIVER}"):
        return parsed.set(drivername=f"postgresql+{PREFERRED_PG_DRIVER}").render_as_string(hide_password=False)

    # An explicit psycopg (v3) URL. psycopg v3 is not a declared dependency, so
    # honour the installed driver rather than failing on a missing import.
    print(
        f"[database] DATABASE_URL requested driver '{parsed.drivername}'; "
        f"rewriting to 'postgresql+{PREFERRED_PG_DRIVER}' to match the installed driver."
    )
    return parsed.set(drivername=f"postgresql+{PREFERRED_PG_DRIVER}").render_as_string(hide_password=False)


DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./workflow.db"))

# --- DATABASE ENGINE INITIALIZATION ---
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    print(f"[database] engine ready: {engine.dialect.name}+{engine.dialect.driver}")

# --- SESSION & MODEL BASE SETUP ---
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

Base = declarative_base()


# --- DATABASE SESSION DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()