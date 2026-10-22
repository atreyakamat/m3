"""Database-mode configuration tests (M3_DATABASE_MODE: postgres|sqlite|none).

Mode switching happens at import time (engines are process-wide objects), so
every test runs the app in a fresh interpreter subprocess with a fully
controlled environment. Where the requirement is to PROVE absence of database
activity (none mode) the subprocess instruments ``sqlalchemy.create_engine``
before importing the application and installs tripwires around
``Base.metadata.create_all`` and ``seed()`` — a passing run is therefore proof
that no engine was created, no connection was opened, no table was created and
no seed data was installed, not merely that a startup message was printed.

All probe URLs point at unreachable loopback or never-used temp paths; the
shared database and its volumes are never touched. See docs/DATABASE_MODES.md.
"""
import os
import pathlib
import subprocess
import sys

import pytest

API_DIR = pathlib.Path(__file__).resolve().parents[1]

SYS_VARS_TO_STRIP = ("M3_DATABASE_MODE", "M3_TEST_DATABASE_URL", "DATABASE_URL", "KAFKA_ENABLED")

TEST_JWT = "mode-test-jwt-secret-not-for-deployment"


def _run_probe(code: str, extra_env: dict[str, str], timeout: int = 180) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if k not in SYS_VARS_TO_STRIP}
    env.update(extra_env)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.setdefault("KAFKA_ENABLED", "false")  # keep probes DB/queue-isolated
    proc = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True,
                          env=env, cwd=str(API_DIR), timeout=timeout)
    return proc


def _env(mode: str | None, url: str | None) -> dict[str, str]:
    e = {"JWT_SECRET": TEST_JWT, "BOOTSTRAP_SECRET": "mode-test-bootstrap"}
    if mode is not None:
        e["M3_DATABASE_MODE"] = mode
    if url is not None:
        e["DATABASE_URL"] = url
    return e


def _assert_ok(proc: subprocess.CompletedProcess, marker: str) -> None:
    assert proc.returncode == 0, f"probe failed:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    assert marker in proc.stdout, f"marker {marker!r} missing:\n{proc.stdout}\n{proc.stderr}"


def _assert_config_error(proc: subprocess.CompletedProcess, needle: str) -> None:
    assert proc.returncode != 0, proc.stdout
    assert needle in proc.stdout + proc.stderr, f"missing {needle!r}:\n{proc.stdout}\n{proc.stderr}"


# ---------------------------------------------------------------------------
# Instrumented none-mode probe. The URL is intentionally a *stale* value —
# postgresql at an unreachable port — proving item: a stale DATABASE_URL cannot
# make none mode connect to anything (no engine is built at all).
# ---------------------------------------------------------------------------
NONE_PROBE = r'''
import json
import os
import sqlalchemy

_calls = []
_real = sqlalchemy.create_engine
def _spy(*args, **kwargs):
    _calls.append(str(args[0]) if args else str(kwargs.get("url", "?")))
    return _real(*args, **kwargs)
sqlalchemy.create_engine = _spy

from fastapi.testclient import TestClient
from app.main import app
from app import database, models
import app.seed as seed_module

assert database.DATABASE_MODE == "none"
assert database.engine is None, "engine must not exist in none mode"
assert database.SessionLocal is None, "SessionLocal must not exist in none mode"
assert _calls == [], f"create_engine was called in none mode: {_calls}"

# Tripwires: startup must not create tables, migrate, or seed.
def _no_create_all(*a, **k): raise AssertionError("create_all ran in none mode")
def _no_seed(*a, **k): raise AssertionError("seed() ran in none mode")
models.Base.metadata.create_all = _no_create_all
seed_module.seed = _no_seed

with TestClient(app) as client:
    # 1) DB-independent health works and reports the mode without secrets.
    h = client.get("/api/v1/health")
    assert h.status_code == 200, h.text
    b = h.json()
    assert b["database_mode"] == "none"
    assert b["validation_only"] is True and b["database"] == "disabled"
    blob = json.dumps(b).lower()
    assert "://" not in blob and "password" not in blob, b  # no URLs/credentials

    # Root alias is DB-independent too.
    assert client.get("/health").status_code == 200

    # 2) Request/schema validation is available without a database.
    ok_shape = client.get("/openapi.json")
    assert ok_shape.status_code == 200
    v = client.post("/api/v1/validate-questionnaire", json={
        "client_request_id": "probe1234_none_mode",
        "data": {"personal": {"full_name": "Validation Probe"}}})
    assert v.status_code == 200, v.text
    vb = v.json()
    assert vb["valid"] is False and vb["persisted"] is False
    assert vb["database_mode"] == "none" and vb["errors"], vb
    vbad = client.post("/api/v1/validate-questionnaire", json={"client_request_id": "bad"})
    assert vbad.status_code == 422, vbad.text  # pydantic body validation intact

    # 3) Database-dependent reads and writes return the intentional 503.
    probes = [
        ("get", "/ready", None),
        ("get", "/api/v1/diagnostics", None),
        ("get", "/api/v1/facilities", None),
        ("get", "/api/v1/workers", None),
        ("post", "/api/v1/auth/login", {"phone": "+919000000001", "pin": "2468"}),
        ("post", "/api/v1/workers", {"display_name": "Fabricated", "mobile": "9000000000"}),
        ("post", "/api/v1/assessments", {"patient_id": "patient-1"}),
        ("post", "/api/v1/samples", {"patient_id": "patient-1", "method": "rdt", "result_status": "positive"}),
    ]
    for method, url, payload in probes:
        if payload is None:
            r = getattr(client, method)(url)
        else:
            r = getattr(client, method)(url, json=payload)
        assert r.status_code == 503, f"{method} {url} -> {r.status_code} {r.text}"
        detail = r.json()["detail"]
        assert detail["error"] == "database_disabled", detail   # no fabricated success for any write
        assert detail["database_mode"] == "none" and detail["message"]
        assert "://" not in json.dumps(detail), detail         # no connection strings leaked

assert _calls == [], "create_engine must stay uncalled after requests in none mode"
assert not os.environ.get("DATABASE_URL") or os.environ["DATABASE_URL"].startswith("postgresql"), "setup env"
print("NONE_MODE_OK engine_calls=0")
'''


def test_none_mode_no_engine_no_connection_no_migrations_no_seed_and_503s():
    """Items 1,2,3,4,5,9: instrumented proof for validation-only mode."""
    proc = _run_probe(NONE_PROBE, _env("none", "postgresql://stale:secret@127.0.0.1:1/unused_db"))
    _assert_ok(proc, "NONE_MODE_OK engine_calls=0")


def test_none_mode_stale_sqlite_url_never_creates_the_file():
    """Item 9 (second variant): a stale sqlite DATABASE_URL must not materialize."""
    import uuid
    url = f"sqlite:////tmp/none_mode_must_not_exist_{uuid.uuid4().hex}.db"
    code = r'''
from fastapi.testclient import TestClient
from app.main import app
from app import database
assert database.DATABASE_MODE == "none" and database.engine is None
with TestClient(app) as client:
    assert client.get("/api/v1/health").status_code == 200
    assert client.post("/api/v1/workers", json={"display_name": "X", "mobile": "9000000000"}).status_code == 503
print("FILE_PROBE_DONE")
'''
    proc = _run_probe(code, _env("none", url))
    _assert_ok(proc, "FILE_PROBE_DONE")
    assert not os.path.exists("/tmp/" + url.rsplit("/", 1)[-1]), "sqlite file must not be created in none mode"


def test_missing_mode_fails_safely():
    """Item 6a: absent mode must fail with a clear error, never a default DB."""
    proc = _run_probe("import app.database", _env(None, "sqlite:////tmp/m3_missing_mode.db"))
    _assert_config_error(proc, "M3_DATABASE_MODE is not set")


def test_invalid_mode_fails_safely():
    """Item 6b: an invalid mode value must fail with a clear error."""
    proc = _run_probe("import app.database", _env("bogus-mode", "sqlite:////tmp/m3_invalid_mode.db"))
    _assert_config_error(proc, "is invalid. Expected one of")


def test_postgres_mode_uses_only_the_configured_url():
    """Item 7: postgres mode binds ONLY the explicitly configured URL."""
    url = "postgresql+psycopg://m3test:m3test@127.0.0.1:1/m3_mode_probe"
    code = r'''
import sqlalchemy
_calls = []
_real = sqlalchemy.create_engine
def _spy(*a, **k):
    _calls.append(str(a[0]) if a else str(k.get("url", "?")))
    return _real(*a, **k)
sqlalchemy.create_engine = _spy
from app import database
assert database.DATABASE_MODE == "postgres"
assert database.engine is not None and database.SessionLocal is not None
assert _calls == ["postgresql+psycopg://m3test:m3test@127.0.0.1:1/m3_mode_probe"], _calls
# engine.url masks the password with *** — also proving URLs-in-logs stay secret-safe.
assert str(database.engine.url) == "postgresql+psycopg://m3test:***@127.0.0.1:1/m3_mode_probe", database.engine.url
assert "sqlite" not in str(database.engine.url).lower(), database.engine.url
print("PG_BIND_OK", len(_calls))
'''
    proc = _run_probe(code, _env("postgres", url))
    _assert_ok(proc, "PG_BIND_OK 1")
    assert "PG_BIND_OK 1" in proc.stdout, "create_engine must run exactly once, with only the configured URL"


def test_sqlite_mode_uses_only_the_configured_path():
    """Item 8: sqlite mode binds ONLY the explicitly configured test path."""
    url = "sqlite:////tmp/m3_mode_probe_sqlite.db"
    code = r'''
import sqlalchemy
_calls = []
_real = sqlalchemy.create_engine
def _spy(*a, **k):
    _calls.append(str(a[0]) if a else str(k.get("url", "?")))
    return _real(*a, **k)
sqlalchemy.create_engine = _spy
from app import database
assert database.DATABASE_MODE == "sqlite" and database.engine is not None
assert _calls == ["sqlite:////tmp/m3_mode_probe_sqlite.db"], _calls
assert str(database.engine.url) == _calls[0], (str(database.engine.url), _calls[0])
assert "postgresql" not in str(database.engine.url).lower(), database.engine.url
print("SQLITE_BIND_OK")
'''
    proc = _run_probe(code, _env("sqlite", url))
    _assert_ok(proc, "SQLITE_BIND_OK")
    assert "SQLITE_BIND_OK" in proc.stdout


def test_mode_url_scheme_mismatch_fails_safely():
    """Items 6+8: postgres mode must refuse a sqlite URL (and vice versa) — no fallback."""
    proc = _run_probe("import app.database", _env("postgres", "sqlite:////tmp/m3_mismatch.db"))
    _assert_config_error(proc, "requires DATABASE_URL to be a PostgreSQL")
    proc = _run_probe("import app.database", _env("sqlite", "postgresql://u:p@db:5432/m3"))
    _assert_config_error(proc, "requires DATABASE_URL to be a sqlite")


def test_postgres_startup_unreachable_refuses_to_start_with_clear_error():
    """Postgres mode validates connectivity at startup and refuses to start."""
    url = "postgresql+psycopg://m3test:m3test@127.0.0.1:1/m3_unreachable"
    code = r'''
from fastapi.testclient import TestClient
from app.main import app
try:
    with TestClient(app):
        raise AssertionError("startup should have failed before this point")
except RuntimeError as exc:
    assert "could not be reached" in str(exc) and "M3_DATABASE_MODE=postgres" in str(exc)
    print("STARTUP_REFUSED_OK")
'''
    proc = _run_probe(code, _env("postgres", url), timeout=60)
    _assert_ok(proc, "STARTUP_REFUSED_OK")
