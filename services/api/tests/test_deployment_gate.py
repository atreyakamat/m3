"""scripts/check_deployment_gates.py detects when identity/idempotency uniqueness is NOT enforced."""
import os
import pathlib
import sqlite3
import subprocess
import sys

def _find_repo_root():
    for p in pathlib.Path(__file__).resolve().parents:
        if (p / "scripts" / "check_deployment_gates.py").exists():
            return p
    for p in pathlib.Path(__file__).resolve().parents:
        if (p / "check_deployment_gates.py").exists():
            return p
    return pathlib.Path(__file__).resolve().parents[-1]

ROOT = _find_repo_root()
API = ROOT / "services" / "api" if (ROOT / "services" / "api").exists() else ROOT
GATE_SCRIPT = ROOT / "scripts" / "check_deployment_gates.py" if (ROOT / "scripts" / "check_deployment_gates.py").exists() else (ROOT / "check_deployment_gates.py")


def _run(args, db_url, cwd):
    # The app (imported by alembic/env.py) requires an explicit database mode.
    # These alembic/gate subprocesses always use a disposable SQLite file, so
    # the mode is set to match the URL (no silent defaults, no fallback).
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                          env={**os.environ, "DATABASE_URL": db_url, "M3_DATABASE_MODE": "sqlite"})


def test_gate_passes_on_migrated_db_and_fails_when_uniqueness_missing(tmp_path):
    db = tmp_path / "gate-test.db"
    url = f"sqlite:///{db}"
    up = _run([sys.executable, "-m", "alembic", "upgrade", "head"], url, API)
    assert up.returncode == 0, up.stderr
    # The gate script was extended to 11 gates (§22.12: D1/D2 replay-race
    # indexes); the migrated gate must report the full count it now runs.
    gate = [sys.executable, str(GATE_SCRIPT)]
    ok = _run(gate, url, ROOT)
    assert ok.returncode == 0, ok.stdout
    assert "gates passed" in ok.stdout, ok.stdout
    assert "11/11 gates passed" in ok.stdout, ok.stdout
    assert "FAIL" not in ok.stdout, ok.stdout

    con = sqlite3.connect(db)
    con.execute("DROP INDEX uq_users_patient_id")
    con.commit(); con.close()
    bad = _run(gate, url, ROOT)
    assert bad.returncode == 1
    assert "FAIL  one account per worker profile" in bad.stdout


def test_migration_warns_and_gate_fails_when_duplicate_claims_preexist(tmp_path):
    db = tmp_path / "gate-dup-test.db"
    url = f"sqlite:///{db}"
    assert _run([sys.executable, "-m", "alembic", "upgrade", "20261022_01"], url, API).returncode == 0
    con = sqlite3.connect(db)
    con.execute("PRAGMA foreign_keys=OFF")
    # the baseline schema is built from current models, so emulate a pre-constraint database
    con.execute("DROP INDEX IF EXISTS uq_users_patient_id")
    con.execute("INSERT INTO patients (id, patient_code, consent_status, preferred_language, age_flagged, created_at, updated_at) "
                "VALUES ('p1','M3-DUP1','documented','en',0,'2026-01-01','2026-01-01')")
    for i in ("u1", "u2"):
        con.execute("INSERT INTO users (id, phone_e164, display_name, pin_hash, preferred_language, active, technical_provisioner, "
                    "failed_login_count, patient_id, created_at, updated_at) VALUES (?,?,?,?,?,1,0,0,'p1','2026-01-01','2026-01-01')",
                    (i, "+9190000000" + i[-1] + "0", i, "x", "en"))
    con.commit(); con.close()
    up = _run([sys.executable, "-m", "alembic", "upgrade", "head"], url, API)
    assert up.returncode == 0, up.stderr
    assert "uq_users_patient_id not created" in up.stderr, "duplicate-index warning must be visible"
    gate = _run([sys.executable, str(ROOT / "scripts" / "check_deployment_gates.py")], url, ROOT)
    assert gate.returncode == 1 and "FAIL  no worker profile claimed by more than one account" in gate.stdout
    # nothing was merged or deleted
    con = sqlite3.connect(db)
    assert con.execute("SELECT COUNT(*) FROM users WHERE patient_id='p1'").fetchone()[0] == 2
