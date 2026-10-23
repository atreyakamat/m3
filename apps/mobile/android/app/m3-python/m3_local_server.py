"""
m3_local_server — in-process bootstrap of the REAL M3 FastAPI backend.

This module is packaged into the Android APK by Chaquopy (source dir
`apps/mobile/android/m3-python`) and driven from LocalServerModule.kt:

  start(data_dir, port)   spawn a thread that migrates + serves on 127.0.0.1
  status()                JSON: {status: idle|starting|ready|failed|stopped, detail}
  stop()                  stop uvicorn (keeps committed data on disk)
  reset(data_dir, root)   delete the standalone SQLite database (server must
                          NOT be running); explicit confirmation happens in
                          the mobile UI, per docs/STANDALONE_LOCAL_SERVER.md

DESIGN CONSTRAINTS
- Loopback only: uvicorn binds 127.0.0.1, never 0.0.0.0.
- No external services: kafka disabled, psycopg/PostgreSQL NEVER used — the
  engine is M3_DATABASE_MODE=sqlite against the app-private data dir.
- Real backend logic: `from app.main import app` — no reimplementation.
- Migrations: alembic upgrade head using the alembic/ tree that
  LocalServerModule.kt extracted from APK assets into data_dir/migration/.
- Failure reporting is explicit: any init/migration/import error moves the
  state to "failed" with a short traceback — it is never converted into a
  fabricated success.
"""

import json
import logging
import os
import threading
import traceback

_state: dict = {"status": "idle", "detail": ""}
_server = None            # uvicorn.Server
_thread: threading.Thread | None = None
_port = 8741
_data_dir = ""

logger = logging.getLogger("m3_local_server")


def status() -> str:
    return json.dumps({"status": _state["status"], "detail": _state["detail"][:600]})


def start(data_dir: str, port: int) -> str:
    global _thread, _port, _data_dir
    if _state["status"] in ("starting", "ready"):
        return status()
    _port = int(port)
    _data_dir = data_dir
    import uuid
    os.environ["M3_DATABASE_MODE"] = "sqlite"
    os.environ["DATABASE_URL"] = f"sqlite:///{data_dir}/m3-local.db"
    # Per-boot local secret: /bootstrap/users exists in the real backend, but in
    # standalone mode it deliberately stays non-discoverable (account creation
    # goes through the real signup endpoint, which is documented separately).
    if not os.environ.get("BOOTSTRAP_SECRET"):
        os.environ["BOOTSTRAP_SECRET"] = uuid.uuid4().hex
    os.environ["KAFKA_ENABLED"] = "false"
    os.environ["KAFKA_BOOTSTRAP_SERVERS"] = ""
    os.environ.setdefault("M3_TEST_DATABASE_URL", "")
    # Privacy: keep default uvicorn logs quiet; no request bodies logged.
    os.environ.setdefault("API_CORS_ORIGINS", "")
    _state["status"] = "starting"
    _state["detail"] = ""
    _thread = threading.Thread(target=_run, daemon=True, name="m3-local-server")
    _thread.start()
    return status()


def _migrate() -> None:
    """Run the REAL alembic migrations against the standalone SQLite DB.

    alembic.ini + alembic/ live in `<data_dir>/migration`, extracted from APK
    assets by LocalServerModule.kt on first boot. env.py imports the real app
    models and reads DATABASE_URL from the environment (set by start()).
    """
    from alembic import command
    from alembic.config import Config

    root = os.path.join(_data_dir, "migration")
    ini = os.path.join(root, "alembic.ini")
    if not os.path.isfile(ini):
        raise RuntimeError(f"migrations not extracted: {ini} missing")
    cfg = Config(ini)
    cfg.set_main_option("script_location", os.path.join(root, "alembic"))
    cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(cfg, "head")


def _run() -> None:
    try:
        _migrate()
        os.environ["M3_LOCAL_SERVER_PORT"] = str(_port)
        import uvicorn
        from app.main import app  # the REAL backend application

        config = uvicorn.Config(app, host="127.0.0.1", port=_port, log_level="info", access_log=False, lifespan="on")
        global _server
        _server = uvicorn.Server(config)
        _state["status"] = "ready"
        _server.run()
        _state["status"] = "stopped"
    except Exception:
        _state["status"] = "failed"
        _state["detail"] = traceback.format_exc(limit=6)
        logger.exception("local server failed")


def stop() -> str:
    """Terminate the embedded server thread (data stays committed on disk)."""
    if _server is not None:
        _server.should_exit = True
    _state["status"] = "stopped"
    return status()


def reset(data_dir: str, port_unused: int = 0) -> int:
    """Delete the standalone database (+wal/shm).

    Only valid when the server is NOT running (the mobile UI enforces the
    confirmation dialog and refuses while a session is active). Committed real
    data is DELETED — that is the documented purpose of this action.
    """
    if _state["status"] in ("starting", "ready"):
        raise RuntimeError("server running — stop it before resetting")
    removed = 0
    for name in ("m3-local.db", "m3-local.db-wal", "m3-local.db-shm"):
        p = os.path.join(data_dir, name)
        if os.path.exists(p):
            os.unlink(p)
            removed += 1
    return removed
