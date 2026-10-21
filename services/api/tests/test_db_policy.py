"""Fix-2 regression tests: SQLite test-isolation policy.

Covers (a) unit behavior of tests/db_policy.py — explicit SQLite URLs are
honored, ambiguous/dev/production databases are refused before any file is
touched, and cleanup paths are derived from the configured URL; (b) the live
conftest wiring — the configured URL is what the engine actually uses; and
(c) a concurrent-run proof — two pytest processes with different private
SQLite databases run at the same time, both pass, and neither deletes the
other's database file.
"""
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pytest

import db_policy
from db_policy import (
    UnsafeTestDatabaseError,
    resolve_candidate_url,
    sqlite_owned_paths,
    sqlite_url_path,
)


def test_default_lane_owns_suite_db():
    url, kind = resolve_candidate_url(None)
    assert kind == "sqlite_default" and url == "sqlite:///./test-m3.db"


def test_explicit_private_sqlite_url_is_honored():
    url = "sqlite:////tmp/opencode/private_lane_test.db"
    resolved, kind = resolve_candidate_url(url)
    assert resolved == url and kind == "sqlite"


def test_dev_named_sqlite_is_refused():
    for name in ("m3-dev.db", "m3_dev.db", "app-prod.db", "mol-live.sqlite"):
        with pytest.raises(UnsafeTestDatabaseError):
            resolve_candidate_url(f"sqlite:///./{name}")


def test_plain_caller_file_is_refused():
    with pytest.raises(UnsafeTestDatabaseError):
        resolve_candidate_url("sqlite:///./mol.sqlite")


def test_production_pg_name_is_refused():
    with pytest.raises(UnsafeTestDatabaseError):
        resolve_candidate_url("postgresql+psycopg://m3test:m3test@127.0.0.1:5434/m3_prod")
    with pytest.raises(UnsafeTestDatabaseError):
        resolve_candidate_url("postgresql://user:pw@host:5432/production")


def test_temp_dir_file_is_owned_even_without_test_in_name():
    with tempfile.TemporaryDirectory() as base:
        url = f"sqlite:///{base}/anything.db"
        _resolved, kind = resolve_candidate_url(url, temp_dir=base)
        assert kind == "sqlite"


def test_wal_shm_cleanup_paths_derive_from_url():
    with tempfile.TemporaryDirectory() as base:
        url = f"sqlite:///{base}/mytest_m3.db"
        paths = sqlite_owned_paths(url)
        assert len(paths) == 3
        assert paths[0].endswith("mytest_m3.db")
        assert paths[1].endswith("mytest_m3.db-wal")
        assert paths[2].endswith("mytest_m3.db-shm")
        # The hard-coded legacy name must NOT appear anywhere in derived paths.
        assert not any("test-m3" in p for p in paths)


def test_relative_url_resolves_against_process_cwd(tmp_path):
    path = sqlite_url_path("sqlite:///./test-m3.db", base_dir=str(tmp_path))
    assert path == (tmp_path / "test-m3.db").resolve()


def test_engine_uses_configured_database_url(tmp_path):
    """Live conftest wiring: whatever DATABASE_URL this process runs with is
    exactly what the engine resolves to (no silent _SCALE override)."""
    import re
    from app.database import engine
    from app.config import get_settings

    configured = os.environ.get("DATABASE_URL")
    # conftest exports the resolved value before app.config reads it.
    assert configured is not None
    # str(engine.url) masks the password; compare the unmasked rendering.
    assert engine.url.render_as_string(hide_password=False) == configured
    assert get_settings().database_url == configured
    if engine.dialect.name == "sqlite":
        db_file = sqlite_url_path(configured)
        assert db_file is not None
        # fresh_db actually created the configured file in this run.
        if db_file.name != ":memory:":
            assert db_file.exists(), f"engine did not create {db_file}"


def test_concurrent_pytest_processes_use_isolated_databases(tmp_path):
    """Two pytest subprocesses, different private SQLite files, started at the
    same moment: both succeed and neither removes the other's database."""
    lane_a = tmp_path / "lane_a_test.db"
    lane_b = tmp_path / "lane_b_test.db"
    api_root = Path(__file__).resolve().parents[1]
    cmd_tail = ["-q", "tests/test_workflows.py::test_qr_token_opaque_and_resolvable",
                "-p", "no:cacheprovider"]
    procs = []
    for lane_path in (lane_a, lane_b):
        env = dict(os.environ)
        env["DATABASE_URL"] = f"sqlite:///{lane_path}"
        env.pop("M3_TEST_DATABASE_URL", None)
        procs.append(subprocess.Popen(
            [sys.executable, "-m", "pytest", *cmd_tail],
            cwd=str(api_root), env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True))
    outputs = []
    for proc in procs:
        out, _ = proc.communicate(timeout=300)
        outputs.append((proc.returncode, out))
    for index, (rc, out) in enumerate(outputs):
        assert rc == 0, f"lane {index} failed:\n{out[-3000:]}"
    assert lane_a.exists() and lane_b.exists(), \
        "a concurrent run deleted the other lane's database file"
    # And the file content is non-trivial (created by create_all, not just touched).
    assert lane_a.stat().st_size > 100_000 or lane_b.stat().st_size > 100_000
