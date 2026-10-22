"""Explicit database-mode resolution for the M3 API (M3_DATABASE_MODE).

The application never picks a database silently. The mode is an explicit,
required setting:

    M3_DATABASE_MODE=postgres   connect ONLY to the configured PostgreSQL URL
    M3_DATABASE_MODE=sqlite     connect ONLY to the configured SQLite URL
    M3_DATABASE_MODE=none       validation-only: no engine, no connection,
                                no migrations, no table creation, no seed

Precedence (documented in docs/DATABASE_MODES.md):
  1. M3_DATABASE_MODE — required; absent or invalid fails startup with a clear
     configuration error BEFORE any connection is attempted.
  2. DATABASE_URL (env > services/api/.env > framework default, resolved by
     pydantic-settings) supplies the URL for enabled modes; the mode validates
     the URL scheme and refuses mismatches instead of falling back.

Error messages describe the scheme only and never echo the full URL, so no
credentials can leak through logs or API responses.
"""
import os

from .config import get_settings

MODES = ("postgres", "sqlite", "none")

POSTGRES_SCHEMES = ("postgresql://", "postgresql+psycopg://", "postgres://")


class DatabaseConfigError(RuntimeError):
    """Raised when the database configuration is absent or invalid.

    Surfaced at import/startup so the server fails safely instead of silently
    selecting a database.
    """


def _missing_mode_error() -> DatabaseConfigError:
    return DatabaseConfigError(
        "M3_DATABASE_MODE is not set. Configure it explicitly with one of:\n"
        "    M3_DATABASE_MODE=postgres  (server: connect to DATABASE_URL, a PostgreSQL URL)\n"
        "    M3_DATABASE_MODE=sqlite    (offline dev/testing: connect to DATABASE_URL, a sqlite:// URL)\n"
        "    M3_DATABASE_MODE=none      (validation-only: no database, DB endpoints return 503)\n"
        "Set it in your environment or services/api/.env. There is NO implicit "
        "default database; the server refuses to start without an explicit mode."
    )


def resolve_database_mode() -> tuple[str, str]:
    """Return (mode, url).

    mode  — one of MODES
    url   — the configured DATABASE_URL for enabled modes, or "" for `none`
            (in `none` mode the URL setting is intentionally ignored; it is
            never inspected, validated, or connected to).
    """
    raw = os.environ.get("M3_DATABASE_MODE")
    if raw is None or not raw.strip():
        raise _missing_mode_error()
    mode = raw.strip().lower()
    if mode not in MODES:
        raise DatabaseConfigError(
            f"M3_DATABASE_MODE={raw.strip()!r} is invalid. Expected one of: "
            "postgres, sqlite, none. No database was selected; fix the setting "
            "and restart."
        )
    settings = get_settings()
    url = (settings.database_url or "").strip()
    if mode == "none":
        # Validation-only: the URL setting is deliberately ignored. Return ""
        # so no code path can hand it to an engine by accident.
        return mode, ""
    if not url:
        raise DatabaseConfigError(
            f"M3_DATABASE_MODE={mode} requires an explicit DATABASE_URL "
            "(environment or services/api/.env). No fallback database is used."
        )
    if mode == "postgres" and not url.startswith(POSTGRES_SCHEMES):
        raise DatabaseConfigError(
            "M3_DATABASE_MODE=postgres requires DATABASE_URL to be a PostgreSQL "
            "URL (postgresql://, postgresql+psycopg:// or postgres://). The "
            "configured URL has a different scheme — refusing to connect and "
            "refusing to fall back. Fix the configuration (the shared/staging "
            "database is never substituted automatically)."
        )
    if mode == "sqlite" and not url.startswith("sqlite"):
        raise DatabaseConfigError(
            "M3_DATABASE_MODE=sqlite requires DATABASE_URL to be a sqlite:// "
            "URL. The configured URL has a different scheme — refusing to "
            "connect (this also prevents an SQLite mode from ever touching a "
            "PostgreSQL server)."
        )
    return mode, url
