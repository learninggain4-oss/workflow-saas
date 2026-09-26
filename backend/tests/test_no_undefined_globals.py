"""Static check: no route may reference a global that does not exist.

Two separate 500s shipped from the same refactor. When the routes were moved out
of main.py into routers/, some module-level definitions were left behind in
main.py, so the moved code referenced a name that only existed in the old
module. Nothing failed at import time: `TASK_WRITABLE_FIELDS` and
`CLOUDINARY_ENABLED` only blow up when the function actually runs.

Neither the OpenAPI surface diff nor the test suite caught it, because no test
called POST /api/tasks or GET /.

LOAD_GLOBAL is only emitted for genuine global-name lookups (attribute access is
LOAD_ATTR), so walking the bytecode is exact and needs no reimplementation of
Python's name resolution. A function's own __globals__ is the authority: it is
correct for the routers, for main, and for FastAPI's own built-in routes.
"""
import builtins
import dis
import inspect

import pytest

import core
import main

BUILTIN_NAMES = set(dir(builtins))


def _undefined_globals(fn):
    module_globals = getattr(fn, "__globals__", {})
    missing = set()
    for instr in dis.get_instructions(fn):
        if instr.opname not in ("LOAD_GLOBAL", "LOAD_NAME"):
            continue
        name = instr.argval
        if name in BUILTIN_NAMES or name in module_globals:
            continue
        missing.add(name)
    return missing


def _app_endpoints():
    """This app's route callables, walking the lazy router wrappers.

    app.routes holds _IncludedRouter objects in this FastAPI version, so a
    plain iteration never reaches the real APIRoute entries.
    """
    found = {}

    def walk(routes):
        for route in routes:
            nested = getattr(route, "routes", None)
            if nested:
                walk(nested)
                continue
            # This FastAPI version stores include_router() results as a lazy
            # _IncludedRouter that only exposes `original_router`.
            original = getattr(route, "original_router", None)
            if original is not None:
                walk(getattr(original, "routes", []) or [])
                continue
            endpoint = getattr(route, "endpoint", None)
            if endpoint is not None:
                found[f"{getattr(route, 'path', '?')}"] = endpoint

    walk(main.app.routes)
    return found


def _startup_functions():
    found = {}
    for module in (main, core):
        for name in (
            "fix_db", "start_automation_scheduler", "_automation_scheduler_loop",
            "ensure_database_migrations", "verify_schema_matches_models",
            "ensure_task_timestamps", "normalize_existing_users_to_owner",
            "run_due_date_automations", "apply_automations", "_task_response",
            "_board_response", "websocket_endpoint",
        ):
            fn = getattr(module, name, None)
            if fn is not None:
                found[f"{module.__name__}.{name}"] = fn
    return found


def test_the_app_actually_has_routes():
    """Guards the checks below against silently testing nothing."""
    paths = main.app.openapi()["paths"]
    endpoints = _app_endpoints()
    assert len(paths) > 30, f"only {len(paths)} documented paths"
    for expected in ("/", "/api/templates", "/api/boards/from-template", "/api/tasks"):
        assert expected in paths, f"{expected} missing"
    # Every documented path must resolve to a real endpoint, otherwise the guard
    # below is not covering the whole app.
    assert len(endpoints) >= len(paths) - 2, f"only {len(endpoints)} endpoints resolved"
    assert "/api/boards/from-template" in endpoints


def test_no_endpoint_references_an_undefined_global():
    targets = dict(_app_endpoints())
    targets.update(_startup_functions())

    problems = []
    for label, fn in targets.items():
        code_fn = fn
        if inspect.iscoroutinefunction(fn) and hasattr(fn, "__code__"):
            code_fn = fn
        try:
            missing = _undefined_globals(code_fn)
        except TypeError:
            continue  # builtin or C-level callable
        if missing:
            problems.append(f"{label}: {sorted(missing)}")

    assert not problems, "undefined globals in route/startup code:\n" + "\n".join(problems)


@pytest.mark.parametrize("path", ["/", "/api/templates", "/api/boards", "/api/tasks"])
def test_known_regression_routes_respond(path):
    """The two routes that used to 500, called directly with no auth."""
    from fastapi.testclient import TestClient

    client = TestClient(main.app, raise_server_exceptions=False)
    resp = client.get(path)
    # 401 is a correct outcome; a NameError surfaces as 500.
    assert resp.status_code != 500, f"GET {path} -> {resp.status_code}: {resp.text[:200]}"
