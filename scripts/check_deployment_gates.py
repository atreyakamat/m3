#!/usr/bin/env python3
"""Read-only deployment gate: are the data-integrity guarantees actually enforced?

  DATABASE_URL=... python scripts/check_deployment_gates.py     (exit 0 = all gates pass)

Checks (each PASS/FAIL, never modifies data):
  * database is at the Alembic head revision;
  * one account per worker profile: unique index on users.patient_id exists AND no
    profile is claimed by two accounts (migration 20261023_01 skips the index with a
    warning if duplicates pre-exist, which leaves this gate FAILING until resolved);
  * idempotency keys are unique at the database level (patients, questionnaire
    submissions, symptom reports, cases, samples, follow-ups).
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))


def main() -> int:
    if not os.environ.get("DATABASE_URL"):
        sys.exit("DATABASE_URL must be set explicitly.")
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import create_engine, inspect, text
    eng = create_engine(os.environ["DATABASE_URL"])
    insp = inspect(eng)
    results = []

    def gate(name, ok, detail=""):
        results.append(ok)
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  -- {detail}" if detail and not ok else ""))

    cfg = Config(str(ROOT / "services" / "api" / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "services" / "api" / "alembic"))
    head = ScriptDirectory.from_config(cfg).get_current_head()
    with eng.connect() as c:
        try:
            cur = c.execute(text("SELECT version_num FROM alembic_version")).scalar()
        except Exception:
            c.rollback()
            cur = None
        gate("database at migration head", cur == head, f"db={cur} head={head}")
        dups = c.execute(text("SELECT patient_id, COUNT(*) FROM users WHERE patient_id IS NOT NULL "
                              "GROUP BY patient_id HAVING COUNT(*) > 1")).fetchall()
        gate("no worker profile claimed by more than one account", not dups, f"{len(dups)} profile(s) multiply claimed")

    def unique_on(table, col):
        if not insp.has_table(table):
            return False
        for ix in insp.get_indexes(table):
            if ix.get("unique") and ix["column_names"] == [col]:
                return True
        return any(u["column_names"] == [col] for u in insp.get_unique_constraints(table))

    for table, col, label in (
        ("users", "patient_id", "one account per worker profile (users.patient_id unique)"),
        ("patients", "client_request_id", "registration idempotency key unique"),
        ("questionnaire_submissions", "client_request_id", "questionnaire idempotency key unique"),
        ("symptom_reports", "client_request_id", "symptom-report idempotency key unique"),
        ("cases", "client_request_id", "case idempotency key unique"),
        ("samples", "client_request_id", "sample-result idempotency key unique (D1)"),
        ("follow_ups", "client_request_id", "follow-up idempotency key unique (D2)"),
    ):
        gate(label, unique_on(table, col), f"no unique index/constraint on {table}.{col}")

    def partial_index_present(table, index_name):
        """Confirm the race backstop exists as a PARTIAL unique index (or that
        the migration recorded it as deferred because duplicates pre-existed).
        Deferred is reported, not failed: the operator must resolve rows first."""
        if not insp.has_table(table):
            return None
        for ix in insp.get_indexes(table):
            if ix["name"] == index_name and ix.get("unique"):
                return True
        return False

    for table, index_name, label in (
        ("samples", "uq_samples_client_request_id", "sample replay-race index present (uq_samples_client_request_id)"),
        ("follow_ups", "uq_follow_ups_client_request_id", "follow-up replay-race index present (uq_follow_ups_client_request_id)"),
    ):
        state = partial_index_present(table, index_name)
        if state is None:
            gate(label, False, f"table {table} missing")
        elif state is False:
            # Deferred by duplicate detection (migration never deletes rows).
            with eng.connect() as c:
                dupes = c.execute(text(
                    f"SELECT COUNT(*) FROM {table} WHERE client_request_id IS NOT NULL "
                    "GROUP BY client_request_id HAVING COUNT(*) > 1")).fetchall()
            if dupes:
                gate(label, False, f"DEFERRED: {len(dupes)} duplicate key(s) must be reconciled manually")
            else:
                gate(label, False, "unique index absent though no duplicates exist")
        else:
            gate(label, True)
    failed = results.count(False)
    print(f"\n{len(results) - failed}/{len(results)} gates passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
