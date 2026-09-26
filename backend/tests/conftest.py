"""Test-wide environment setup.

pytest loads conftest.py before any test module, so these run before a test
module does `import main` and sets its own DATABASE_URL. That ordering is the
only reason AUTOMATION_SCHEDULER=off actually lands: the scheduler starts on the
FastAPI startup event and would otherwise run its scan loop against the
throwaway SQLite file mid-test.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_workflow.db")
os.environ.setdefault("AUTOMATION_SCHEDULER", "off")
