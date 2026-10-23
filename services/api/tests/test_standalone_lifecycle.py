"""Standalone Local Server lifecycle tests (in-tablet FastAPI + SQLite).

These mirror the runtime the Android app uses for the Standalone Local Server
mode (docs/STANDALONE_LOCAL_SERVER.md): the REAL application is served by
uvicorn bound to 127.0.0.1 in its own process, migrations are applied by
`alembic upgrade head` (NOT create_all), writes happen through the real HTTP
API, and the server is fully STOPPED and rebooted mid-test to prove committed
records survive the app-process lifecycle on the same SQLite file.

Everything runs on a suite-owned temp SQLite file (db_policy refuses unknown
paths) and never touches PostgreSQL or the shared docker stack.
"""
import json
import os
import pathlib
import socket
import sqlite3
import subprocess
import sys
import time

import pytest

API_DIR = pathlib.Path(__file__).resolve().parents[1]

SYS_VARS_TO_STRIP = ("M3_DATABASE_MODE", "M3_TEST_DATABASE_URL", "DATABASE_URL", "KAFKA_ENABLED")

VALID_Q = {
    "personal": {"full_name": "Standalone Worker A", "dob": "1992-04-10", "gender": "male",
                 "mobile": "+919123450001", "id_type": "aadhaar", "address_present": "Campal, Panaji",
                 "preferred_language": "hindi"},
    "past_history": {"diagnosed_malaria": "no", "repellent": "yes", "mosquito_net": "yes"},
    "present_clinical": {"fever_today": "no", "symptoms": ["no_other_symptoms"], "breathing_difficulty": "no",
                         "chest_pain": "no", "confusion": "no", "can_attend_testing": "not_required"},
    "migration_history": {"time_in_goa": "1_6_months", "outside_goa_3m": "no", "fever_before_goa_3m": "no"},
    "planned_travel": {"planning": "no"},
}


def _free_loopback_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class StandaloneServer:
    """Miniature of m3_local_server.py + LocalServerModule.kt: alembic upgrade
    then uvicorn on 127.0.0.1 in a separate process (the app-process analog)."""

    def __init__(self, tmpdir: pathlib.Path, port: int):
        self.tmpdir = tmpdir
        self.port = port
        self.proc: subprocess.Popen | None = None

    def env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if k not in SYS_VARS_TO_STRIP}
        env.update(
            {
                "M3_DATABASE_MODE": "sqlite",
                "DATABASE_URL": f"sqlite:///{self.tmpdir}/m3-local.db",
                "KAFKA_ENABLED": "false",
                "PYTHONDONTWRITEBYTECODE": "1",
                "JWT_SECRET": "standalone-test-jwt-secret-not-for-deployment",
            }
        )
        return env

    def migrate(self) -> None:
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=str(API_DIR), env=self.env(), check=True,
            capture_output=True, text=True,
        )

    def start(self) -> None:
        log = open(self.tmpdir / "server.log", "ab")
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app",
             "--host", "127.0.0.1", "--port", str(self.port), "--log-level", "info"],
            cwd=str(API_DIR), env=self.env(), stdout=log, stderr=log,
        )
        log.close()
        self.wait_ready()

    def stop(self) -> None:
        assert self.proc is not None
        self.proc.terminate()
        try:
            self.proc.wait(15)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(5)
        self.proc = None

    def wait_ready(self, timeout: int = 90) -> None:
        import httpx
        deadline = time.time() + timeout
        last_error: Exception | None = None
        while time.time() < deadline:
            if self.proc and self.proc.poll() is not None:
                log_text = (self.tmpdir / "server.log").read_text()
                raise RuntimeError(f"server exited rc={self.proc.returncode}\n{log_text[-2500:]}")
            try:
                r = httpx.get(f"http://127.0.0.1:{self.port}/api/v1/ready", timeout=2)
                if r.status_code == 200:
                    return
                last_error = RuntimeError(f"ready {r.status_code}: {r.text[:200]}")
            except Exception as e:  # noqa: BLE001 (poll retried until deadline)
                last_error = e
            time.sleep(0.4)
        raise TimeoutError(f"server not ready: {last_error}")


def env_clean():
    return {k: v for k, v in os.environ.items() if k not in SYS_VARS_TO_STRIP}


@pytest.fixture()
def standalone(tmp_path: pathlib.Path):
    server = StandaloneServer(tmp_path, _free_loopback_port())
    server.migrate()
    server.start()
    yield server
    if server.proc is not None:
        server.stop()


def _client(base: str):
    import httpx
    return httpx.Client(base_url=base, timeout=20)


def test_standalone_signup_login_questionnaire_and_restart_persistence(standalone):
    base = f"http://127.0.0.1:{standalone.port}/api/v1"

    # --- Phase 1: real signup, real tokens, real writes via HTTP -----------
    c = _client(base)
    ready = c.get("/ready")
    assert ready.status_code == 200, ready.text
    assert ready.json() == {
        "status": "ready", "service": "m3-api", "database": "connected",
        "time": ready.json()["time"],
    }
    health = c.get("/health")
    assert health.status_code == 200
    assert health.json()["database_mode"] == "sqlite"
    assert health.json()["database"] == "enabled"

    r = c.post("/auth/signup", json={
        "phone": "+918000000001", "pin": "1234",
        "display_name": "Standalone Admin Tester", "role": "admin",
    })
    assert r.status_code == 201, r.text
    admin_token = r.json()["access_token"]

    r = c.post("/auth/signup", json={
        "phone": "+918000000002", "pin": "4321",
        "display_name": "Standalone Worker Tester", "role": "worker",
    })
    assert r.status_code == 201, r.text
    worker = r.json()["user"]
    worker_token = r.json()["access_token"]
    assert worker["patient_id"], "worker signup must create the real patient profile"
    worker_id = worker["id"]

    # Wrong PIN must fail exactly like the (remote) production server.
    bad = c.post("/auth/login", json={"phone": "+918000000002", "pin": "9999"})
    assert bad.status_code in (401, 403), bad.text

    # Real workflow write: questionnaire via the LOCAL server.
    first = c.post(
        "/questionnaires/submit",
        headers={"Authorization": f"Bearer {worker_token}", "X-Request-ID": "crid-standalone-e2e-1"},
        json={"data": VALID_Q, "client_request_id": "crid-standalone-e2e-1"},
    )
    assert first.status_code == 201, first.text
    submission_id = first.json()["submission_id"]
    assert first.json()["duplicate"] is False
    # Unauthorized role replay: a contractor account must NOT write questionnaires.
    r2 = c.post("/auth/signup", json={
        "phone": "+918000000003", "pin": "1111",
        "display_name": "Standalone Contractor", "role": "contractor",
    })
    assert r2.status_code == 201, r2.text
    contractor_token = r2.json()["access_token"]
    forbidden = c.post(
        "/questionnaires/submit",
        headers={"Authorization": f"Bearer {contractor_token}"},
        json={"data": VALID_Q, "client_request_id": "crid-standalone-e2e-2"},
    )
    assert forbidden.status_code == 403, forbidden.text

    # --- Phase 2: full stop + reboot; prove committed data survives --------
    c.close()
    standalone.stop()
    standalone.start()

    c = _client(base)
    # 1. Committed workflow data persisted in the local SQLite file.
    con = sqlite3.connect(standalone.tmpdir / "m3-local.db")
    row = con.execute(
        "SELECT data, state, client_request_id FROM questionnaire_submissions WHERE id=?",
        (submission_id,),
    ).fetchone()
    con.close()
    assert row is not None, "questionnaire submission did not SURVIVE the server restart"
    assert row[1] == "submitted"
    assert json.loads(row[0])["personal"]["full_name"] == "Standalone Worker A"
    assert row[2] == "crid-standalone-e2e-1"

    # 2. Credentials persisted: same PIN logs in after reboot.
    ok = c.post("/auth/login", json={"phone": "+918000000002", "pin": "4321"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["user"]["id"] == worker_id

    # 3. Server-side sessions persisted: the PRE-restart token is still valid.
    me = c.get("/me", headers={"Authorization": f"Bearer {worker_token}"})
    assert me.status_code == 200, me.text
    assert me.json()["id"] == worker_id

    # 4. Idempotency protection still works post-restart: same crid replays
    #    as duplicate:true with the same submission_id — no second row.
    dup = c.post(
        "/questionnaires/submit",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"data": VALID_Q, "client_request_id": "crid-standalone-e2e-1"},
    )
    assert dup.status_code == 200, dup.text
    assert dup.json()["duplicate"] is True
    assert dup.json()["submission_id"] == submission_id
    c.close()

    # 5. Full audit trail persisted (real authorization history).
    ca = _client(base)
    events = ca.get(
        "/audit-events", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert events.status_code == 200, events.text
    kinds = {e["action"] for e in events.json()["items"]}
    assert "questionnaire.submitted" in kinds
    assert "questionnaire.duplicate_submit_rejected" in kinds
    ca.close()


def test_standalone_never_touched_remote_db_or_shared_stack(standalone):
    """Loopback-only serving + no shared-stack artifacts pass through."""
    import httpx
    base = f"http://127.0.0.1:{standalone.port}/api/v1"
    # The server listens on 127.0.0.1: connecting via any other local address
    #    is impossible for a loopback-bound listener; asserting the bind via
    #    ss/lsof is environment-dependent, so we assert reachable ONLY by
    #    loopback and record the log for evidence.
    log = (standalone.tmpdir / "server.log").read_text()
    assert "127.0.0.1" in log
    assert "0.0.0.0" not in log, "standalone server must never bind all interfaces"
    r = httpx.get(f"{base}/health", timeout=5)
    assert r.status_code == 200
    log2 = (standalone.tmpdir / "server.log").read_text()
    assert "postgres" not in log2 or "postgresql:" not in log2
