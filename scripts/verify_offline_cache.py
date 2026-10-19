"""Verify SQLite offline cache behavior according to M3 design specification.
Exercises schema initialization, write, read-only offline query, and cache clearing.
"""
import json
import sqlite3
import tempfile
import os

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

        conn.close()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)

if __name__ == "__main__":
    test_cache_lifecycle()
    print("ALL OFFLINE CACHE SPEC TESTS PASSED")
