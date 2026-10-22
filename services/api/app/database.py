import logging

from fastapi import HTTPException, status as http_status
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import get_settings
from .db_mode import resolve_database_mode

_logger = logging.getLogger("m3.api")

def get_database_url() -> str:
    """Returns the active database URL ("" in validation-only `none` mode).

    Kept for diagnostics parity; callers must not log the value (it contains
    credentials in the postgres case).
    """
    return _DATABASE_URL

def _connect_args(url: str):
    return {"check_same_thread": False} if url.startswith("sqlite") else {}

# Mode is resolved ONCE, at import time, and fails fast with a clear
# configuration error before anything connects (M3_DATABASE_MODE is required).
_DATABASE_MODE, _DATABASE_URL = resolve_database_mode()

if _DATABASE_MODE == "none":
    # Validation-only mode: no SQLAlchemy engine is created and no connection
    # is ever opened. No migrations, table creation, or seed data run.
    engine = None
    SessionLocal = None
    _logger.info(
        "Database mode: none (validation-only). No engine, no connection, "
        "no migrations, no table creation, no seed. Database-dependent "
        "endpoints respond 503 database_disabled."
    )
else:
    engine = create_engine(get_database_url(), future=True, pool_pre_ping=True, connect_args=_connect_args(get_database_url()))
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    _logger.info("Database mode: %s (strict — connected to the explicitly configured URL host only)", _DATABASE_MODE)

DATABASE_MODE = _DATABASE_MODE

# Intentional 503 body for database-dependent endpoints in validation-only
# mode. Contains no connection details, credentials, or URLs.
DB_DISABLED_DETAIL = {
    "error": "database_disabled",
    "database_mode": "none",
    "message": "Database access is disabled (validation-only mode). No data was read or written; retry against a server running with a database.",
}

class Base(DeclarativeBase):
    pass

def database_mode() -> str:
    return DATABASE_MODE

def database_enabled() -> bool:
    return DATABASE_MODE != "none"

def get_db():
    if SessionLocal is None:
        # Intentional, documented 503: the endpoint requires the database and
        # the server runs in validation-only mode. Never a crash, never a
        # fabricated success.
        raise HTTPException(status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE, detail=DB_DISABLED_DETAIL)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
