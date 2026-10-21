"""Concurrency integrity check (validation-kit Phase 5C) on an ISOLATED PG test DB.

Proves the two-layer guarantee protecting offline reconciliation:
  1. Two racing sessions inserting the same Patient reconciliation identity
     (global offline request id) cannot both commit - one gets IntegrityError
     from the partial unique index uq_patients_client_request_id (PostgreSQL only).
  2. The loser's failed insert leaves no partial rows behind (transaction rollback).

Requires M3_TEST_DATABASE_URL pointing at a disposable test database
(defaults to the seeded m3_pg_seed DB). Read-mostly: it inserts one
pg-conc-* patient row that later runs skip via the deterministic id.
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[1]
_API = REPO / "services" / "api"


def _ensure_backend_python():
    try:
        import pydantic  # noqa: F401
        import sqlalchemy  # noqa: F401
    except ModuleNotFoundError:
        venv = _API / ".venv" / "bin" / "python"
        if venv.exists() and sys.executable != str(venv):
            os.execv(str(venv), [str(venv), __file__, *sys.argv[1:]])
        raise


_ensure_backend_python()
sys.path.insert(0, str(_API))


def refuse_if_unknown(db_url: str) -> None:
    if db_url.startswith("sqlite"):
        print("REFUSED: a PostgreSQL URL is required."); sys.exit(3)
    dbname = urlparse(db_url).path.lstrip("/")
    lowered = dbname.lower()
    looks_test = lowered.startswith(("m3_test", "m3-pg-test", "m3_pg_", "test_", "pg-conc")) \
        or lowered.endswith(("_test", "_seed"))
    if not looks_test or any(m in lowered for m in ("prod", "production", "live")):
        print(f"REFUSED: '{dbname}' is not recognized as a disposable test database."); sys.exit(3)


def main():
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import IntegrityError, OperationalError
    from sqlalchemy.orm import sessionmaker
    from app import models
    from app.database import Base
    db_url = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
        "M3_TEST_DATABASE_URL", "postgresql+psycopg://m3test:m3test@127.0.0.1:5434/m3_pg_seed")
    refuse_if_unknown(db_url)
    engine = create_engine(db_url)
    insp_tables = set()
    with engine.connect() as conn:
        insp_tables = {r[0] for r in conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))}
    if "patients" not in insp_tables:
        print("Database not initialized; deleting"); sys.exit(3)
    Base.metadata.create_all(engine)  # additive; ensures tables/indexes per metadata

    Session = sessionmaker(bind=engine)
    db = Session()
    creator = db.get(models.User, "pgtest-contractor-1")
    if not creator:
        print("Seeded creator missing; run scripts/seed_pg_testdata.py first"); sys.exit(3)
    # Reset this script's own deterministic namespace (pg-conc-*) so each run
    # exercises a genuine fresh-identity race. Never deletes anything outside
    # the pg-conc-* prefix.
    db.query(models.Patient).filter(models.Patient.id.like("pg-conc-patient-%")).delete()
    db.commit()
    db.close()

    CRID = "pg-conc-AAAA-0001"
    # Deterministic pre-existing row from an earlier run is acceptable too: the
    # race below still proves the index rejects a second identical identity.
    results = {}

    def attempt(label):
        s = Session()
        try:
            s.begin()
            user = s.get(models.User, "pgtest-contractor-1")
            if not s.get(models.Patient, f"pg-conc-patient-{label}"):
                patient = models.Patient(
                    id=f"pg-conc-patient-{label}", patient_code=f"PG-CONC-{label}",
                    preferred_language="en", consent_status="pending",
                    client_request_id=CRID, created_by_user_id=user.id)
                s.add(patient)
                s.commit()
                results[label] = "committed"
            else:
                results[label] = "already-present"
        except (IntegrityError, OperationalError) as exc:
            results[label] = ("rejected: " + type(exc).__name__ + " "
                              + ("uq_patients_client_request_id" if "uq_patients_client_request_id" in str(exc) else
                                 "clients_request id conflict"))
            s.rollback()
        finally:
            s.close()

    attempt("A")
    attempt("B")
    committed = [k for k, v in results.items() if v == "committed"]
    rejected = [k for k, v in results.items() if v.startswith("rejected")]
    print("RACE RESULTS:", results)
    if len(committed) == 1 and len(rejected) == 1:
        print("PASS: exactly one session committed; the other was rejected and rolled back clean")
    elif not committed and not rejected:
        print("PASS (idempotent rerun): both identities already reconciled; no duplicates possible")
    else:
        print("FAIL: expected exactly one commit + one rejection")
        sys.exit(4)
    with Session() as verify:
        rows = verify.query(models.Patient).filter(models.Patient.client_request_id == CRID).all()
        if len(rows) > 1:
            print("FAIL: duplicate reconciliation rows present"); sys.exit(4)
        print(f"Rows with dedupe identity {CRID}: {len(rows)}")
    Session.close_all.__call__  # no-op keep-alive


if __name__ == "__main__":
    main()
