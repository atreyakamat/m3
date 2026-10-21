"""Database-selection policy for the M3 test suite (Fix 2: SQLite test isolation).

Pure functions, no app imports, so BOTH tests/conftest.py (at import time) and
the regression tests (tests/test_db_policy.py) can call them without side
effects.

Policy summary:
  * A PostgreSQL URL configured through M3_TEST_DATABASE_URL or DATABASE_URL
    is honored (production-looking names are refused outright — unchanged
    behavior from the original conftest).
  * An explicitly configured SQLite URL is honored ONLY when it is clearly a
    test-owned disposable database: the file lives under the system temp
    directory, or its basename is test-named (contains "test", never "dev").
    Anything else (./m3-dev.db, ./mol.sqlite, caller data files) is refused so
    the suite can neither mutate nor delete it. Fail-safe on ambiguity.
  * With no configured URL the suite owns its classic ./test-m3.db file.
  * Cleanup paths (-db, -wal, -shm) are always derived from the CONFIGURED
    engine URL, never hard-coded.
"""
import os
import tempfile
from pathlib import Path
from urllib.parse import urlparse


class UnsafeTestDatabaseError(RuntimeError):
    """Raised when a configured SQLite URL is not a clearly disposable test database."""


PRODUCTION_MARKERS = ("prod", "production", "live", "stage", "staging")


def is_postgresql_url(url: str) -> bool:
    return url.startswith("postgresql://") or url.startswith("postgresql+psycopg://")


def is_sqlite_url(url: str) -> bool:
    return url.startswith("sqlite:")


def _contains_marker(text: str, markers):
    lowered = text.lower()
    return [m for m in markers if m in lowered]


def resolve_candidate_url(candidate: str | None, temp_dir: str | None = None) -> tuple[str, str]:
    """Return (resolved_url, kind) for a candidate env value, or the suite-owned
    default when no candidate is set. kind is 'postgresql', 'sqlite', or
    'sqlite_default'. Raises UnsafeTestDatabaseError for unsafe selections."""
    if not candidate:
        return "sqlite:///./test-m3.db", "sqlite_default"

    if is_postgresql_url(candidate):
        dbname = urlparse(candidate).path.lstrip("/").lower()
        if _contains_marker(dbname, PRODUCTION_MARKERS):
            raise UnsafeTestDatabaseError(
                f"Refusing to run tests against suspected production database: {dbname}")
        return candidate, "postgresql"

    if is_sqlite_url(candidate):
        path = sqlite_url_path(candidate)
        if path is None:
            raise UnsafeTestDatabaseError(f"Cannot interpret sqlite url: {candidate}")
        markers = _contains_marker(path.name, PRODUCTION_MARKERS)
        if markers or "dev" in path.name.lower():
            raise UnsafeTestDatabaseError(
                f"Refusing sqlite test target '{path}': the name looks like a real "
                "environment database. Use a test-named file or one under the temp directory.")
        base = Path(temp_dir or tempfile.gettempdir()).resolve()
        under_temp = False
        try:
            path.resolve().relative_to(base)
            under_temp = True
        except ValueError:
            under_temp = False
        test_named = "test" in path.name.lower()
        if not (under_temp or test_named):
            raise UnsafeTestDatabaseError(
                f"Refusing sqlite test target '{path}': not test-named and not under "
                f"the temp directory ({base}). Tests delete and recreate their "
                "database, so ownership must be unambiguous.")
        return candidate, "sqlite"

    raise UnsafeTestDatabaseError(f"Unsupported test database url: {candidate}")


def sqlite_url_path(url: str, base_dir: str | None = None) -> Path | None:
    """Extract the filesystem path from a sqlalchemy sqlite URL."""
    if not is_sqlite_url(url):
        return None
    raw = url.split(":", 1)[1]
    raw = raw.lstrip("/")
    # '///tmp/x.db' -> '/tmp/x.db'; '///./x.db' -> './x.db' (process cwd).
    if raw.startswith("./"):
        return (Path(base_dir or os.getcwd()) / raw[2:]).resolve()
    return Path("/" + raw) if not raw.startswith("/") else Path(raw)


def sqlite_owned_paths(url: str, base_dir: str | None = None) -> list[str]:
    """Files (db + wal + shm) that the test fixture owns for this sqlite URL.
    Callers must only delete paths this function returns."""
    path = sqlite_url_path(url, base_dir)
    if path is None:
        raise UnsafeTestDatabaseError(f"Not a sqlite url: {url}")
    return [str(path), str(path) + "-wal", str(path) + "-shm"]
