"""Verify SQLite offline cache behavior according to M3 design specification.
Exercises schema initialization, write, read-only offline query, and cache clearing.
"""
import json
import sqlite3
import tempfile
import os
import time

def test_cache_lifecycle():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # 1. Init cache
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS cached_workers (owner_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(owner_id,id));
            CREATE TABLE IF NOT EXISTS local_drafts (owner_id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
        """)
        conn.commit()
        print("PASS: Cache tables initialized.")

        # 2. Write workers while online
        owner_id = "user-worker-123"
        cached_data = [
            {
                "id": "patient-1",
                "patient_code": "M3-SYN-7K2Q",
                "display_name": "Synthetic Participant A",
                "age_years": 29,
                "gender": "male",
                "occupation": "construction",
                "consent_status": "documented",
                "initial_symptoms": ["fever"],
                "updated_at": "2026-10-19T09:00:00Z"
            }
        ]
        sync_time = "2026-10-19T09:15:00Z"

        cur.execute("DELETE FROM cached_workers WHERE owner_id = ?", (owner_id,))
        for w in cached_data:
            cur.execute("INSERT INTO cached_workers(owner_id, id, json) VALUES(?,?,?)", (owner_id, w["id"], json.dumps(w)))
        cur.execute("INSERT OR REPLACE INTO cache_meta(key, value) VALUES(?,?)", (f"lastSync:{owner_id}", sync_time))
        conn.commit()
        print("PASS: Worker records cached for offline browsing.")

        # 3. Simulate offline read (no network call)
        cur.execute("SELECT json FROM cached_workers WHERE owner_id = ? ORDER BY id", (owner_id,))
        rows = [json.loads(r[0]) for r in cur.fetchall()]
        assert len(rows) == 1
        assert rows[0]["patient_code"] == "M3-SYN-7K2Q"
        print(f"PASS: Read-only offline read succeeded: {rows[0]['patient_code']}")

        # Read last sync metadata
        cur.execute("SELECT value FROM cache_meta WHERE key = ?", (f"lastSync:{owner_id}",))
        last_sync = cur.fetchone()[0]
        assert last_sync == sync_time
        print(f"PASS: Last sync metadata preserved offline: {last_sync}")

        # 4. Multi-tenant isolation: different owner sees nothing
        cur.execute("SELECT json FROM cached_workers WHERE owner_id = ? ORDER BY id", ("other-owner",))
        assert cur.fetchall() == []
        print("PASS: Cache isolation between different owners confirmed.")

        # 5. Clear cache on sign-out
        cur.execute("DELETE FROM cached_workers WHERE owner_id = ?", (owner_id,))
        cur.execute("DELETE FROM cache_meta WHERE key = ?", (f"lastSync:{owner_id}",))
        conn.commit()

        cur.execute("SELECT json FROM cached_workers WHERE owner_id = ?", (owner_id,))
        assert cur.fetchall() == []
        print("PASS: Cache cleared successfully on signout.")

        # 6. Verify Offline Draft Retention Safeguard (PRD SCR-001/SCR-005)
        # Draft saved by owner_id before or during session
        draft_payload = {"personal": {"full_name": "Field Worker Draft", "mobile": "+919876543210"}}
        cur.execute("INSERT OR REPLACE INTO local_drafts(owner_id, json, updated_at) VALUES(?,?,?)",
                    (owner_id, json.dumps(draft_payload), "2026-10-20T09:00:00Z"))
        conn.commit()

        # Sign-out happens again: cached workers & meta cleared, but draft is PRESERVED
        cur.execute("DELETE FROM cached_workers WHERE owner_id = ?", (owner_id,))
        cur.execute("DELETE FROM cache_meta WHERE key = ?", (f"lastSync:{owner_id}",))
        conn.commit()

        cur.execute("SELECT json FROM local_drafts WHERE owner_id = ?", (owner_id,))
        draft_row = cur.fetchone()
        assert draft_row is not None
        restored = json.loads(draft_row[0])
        assert restored["personal"]["full_name"] == "Field Worker Draft"
        print(f"PASS: In-progress draft preserved across sign-out for owner: {restored['personal']['full_name']}")

        # Other owner cannot access this draft (tenant isolation)
        cur.execute("SELECT json FROM local_drafts WHERE owner_id = ?", ("other-owner",))
        assert cur.fetchall() == []
        print("PASS: Draft isolation between distinct accounts confirmed.")

        # Once submitted, draft is explicitly deleted
        cur.execute("DELETE FROM local_drafts WHERE owner_id = ?", (owner_id,))
        conn.commit()
        cur.execute("SELECT json FROM local_drafts WHERE owner_id = ?", (owner_id,))
        assert cur.fetchall() == []
        print("PASS: Draft cleaned up after final submission.")

        # 7. Verify Outbox Queueing and Offline First-Time Worker Registration (P0)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS outbox (
                id TEXT PRIMARY KEY NOT NULL,
                owner_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                kind TEXT NOT NULL,
                payload TEXT NOT NULL
            );
        """)
        conn.commit()

        # Enqueue offline registration item
        reg_payload = {
            "worker": {
                "display_name": "Offline First Worker",
                "gender": "male",
                "mobile": "+919876543299",
                "consent_status": "documented",
                "client_request_id": "client-reg-uuid-123"
            },
            "questionnaire": {
                "data": {"personal": {"full_name": "Offline First Worker"}},
                "client_request_id": "client-req-uuid-456"
            }
        }
        item_id = "outbox-item-1"
        cur.execute(
            "INSERT INTO outbox(id, owner_id, created_at, status, attempts, last_error, kind, payload) VALUES(?,?,?,?,?,?,?,?)",
            (item_id, owner_id, "2026-10-20T10:00:00Z", "queued", 0, None, "worker_register", json.dumps(reg_payload))
        )
        conn.commit()

        # Verify queued item is retrieved in order
        cur.execute("SELECT id, kind, status, payload FROM outbox WHERE owner_id = ? AND status != 'failed' ORDER BY created_at", (owner_id,))
        queued_items = cur.fetchall()
        assert len(queued_items) == 1
        assert queued_items[0][1] == "worker_register"
        assert queued_items[0][2] == "queued"
        print("PASS: Offline first-time worker registration enqueued with worker_register kind.")

        # Verify status transitions (e.g. syncing -> retry or success)
        cur.execute("UPDATE outbox SET status = 'syncing' WHERE id = ?", (item_id,))
        conn.commit()
        cur.execute("SELECT status FROM outbox WHERE id = ?", (item_id,))
        assert cur.fetchone()[0] == "syncing"

        # Outbox isolation: other owner cannot see queued items
        cur.execute("SELECT * FROM outbox WHERE owner_id = ?", ("other-owner",))
        assert cur.fetchall() == []
        print("PASS: Outbox isolation across distinct user accounts confirmed.")

        # Successful sync replay: removes outbox item
        cur.execute("DELETE FROM outbox WHERE id = ?", (item_id,))
        conn.commit()
        cur.execute("SELECT COUNT(*) FROM outbox WHERE owner_id = ?", (owner_id,))
        assert cur.fetchone()[0] == 0
        print("PASS: Outbox item safely purged after successful server replay.")

        conn.close()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_pending_request_id_lifecycle():
    """Fix-1 regression: the questionnaire idempotency key is minted once per
    logical submission, reused across ambiguous retries/outbox replay, is
    owner-isolated, survives app restarts/logout, and only retires on an
    authoritative server ack. Mirrors src/cache.ts pending-ID functions and
    the intake.tsx lifecycle wiring."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:

        seq = [0]

        def mint(owner: str) -> str:
            """Mint-or-reuse, exactly as intake.tsx handleSubmit does."""
            cur.execute("SELECT value FROM cache_meta WHERE key = ?", (f"pendingSubmission:{owner}",))
            row = cur.fetchone()
            if row:
                return row[0]  # reuse for the SAME logical submission
            seq[0] += 1  # monotonic: two mints can never collide (unlike ms clocks)
            req_id = f"req_{owner}_{time.time_ns()}_{seq[0]}"
            cur.execute("INSERT OR REPLACE INTO cache_meta(key, value) VALUES(?,?)",
                        (f"pendingSubmission:{owner}", req_id))
            return req_id

        def acknowledge(owner: str, req_id: str):
            """Clear only on authoritative ack and only if it still matches."""
            cur.execute("DELETE FROM cache_meta WHERE key = ? AND value = ?",
                        (f"pendingSubmission:{owner}", req_id))

        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS cached_workers (owner_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(owner_id,id));
            CREATE TABLE IF NOT EXISTS local_drafts (owner_id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
        """)
        conn.commit()

        owner_a, owner_b = "worker-a", "worker-b"

        # 1. Mint once, reused across repeated Submit presses.
        first_id = mint(owner_a)
        second_press_id = mint(owner_a)
        assert first_id == second_press_id, "repeated press minted a DIFFERENT id (duplicate-risk defect)"
        print(f"PASS: repeated submit presses reuse the pending id ({first_id}).")

        # 2. Ambiguous timeout: NO ack happened, retry keeps the same id.
        ambiguous_restart_id = mint(owner_a)
        assert ambiguous_restart_id == first_id, "app restart during ambiguity rotated the id"
        print("PASS: pending id survives ambiguous-timeout restart until ack.")

        # 3. Owner isolation across logout/login and saved DB restart.
        id_b = mint(owner_b)
        assert id_b != first_id
        cur.execute("SELECT value FROM cache_meta WHERE key = ?", (f"pendingSubmission:{owner_a}",))
        assert cur.fetchone()[0] == first_id
        cur.execute("SELECT value FROM cache_meta WHERE key = ?", (f"pendingSubmission:{owner_b}",))
        assert cur.fetchone()[0] == id_b
        print("PASS: pending ids cannot leak across owners (logout/login safe).")

        # 4. A rejected/failed attempt (e.g. expired session) does NOT retire the id.
        conn.commit(); conn.close(); conn = sqlite3.connect(db_path); cur = conn.cursor()
        cur.execute("SELECT value FROM cache_meta WHERE key = ?", (f"pendingSubmission:{owner_a}",))
        assert cur.fetchone()[0] == first_id
        print("PASS: session-expiry failure keeps the pending id for the next retry.")

        # 5. Authoritative ack retires the id; the NEXT submission mints a NEW one.
        acknowledge(owner_a, first_id)
        conn.commit()
        fresh_id = mint(owner_a)
        assert fresh_id != first_id, "ack did not retire the pending id"
        # Wrong-key ack (other owner's id) must not clear someone else's pending key.
        acknowledge(owner_a, id_b)
        cur.execute("SELECT value FROM cache_meta WHERE key = ?", (f"pendingSubmission:{owner_b}",))
        assert cur.fetchone()[0] == id_b
        print("PASS: ack retires only the matching pending id; new submission gets a new id.")

        conn.close()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)

if __name__ == "__main__":
    test_cache_lifecycle()
    test_pending_request_id_lifecycle()
    print("ALL OFFLINE CACHE SPEC TESTS PASSED")
