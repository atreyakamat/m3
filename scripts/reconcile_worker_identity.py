#!/usr/bin/env python3
"""Audited reconciliation of orphaned worker profiles (development / pilot data).

Background: before migration 20261023_01 a worker account that registered twice got a
second Patient and users.patient_id was overwritten, detaching every Case,
questionnaire and follow-up on the first profile ("orphaned": rows still exist, but
the worker's account no longer points at them).

This tool NEVER merges, deletes or rewrites clinical rows. The only mutation it can
make is re-pointing ONE worker account (users.patient_id) at ONE existing, unclaimed
profile, and every such change is written to audit_events with the previous value so
it can be reversed by running the tool again with the old profile id.

  report (default, read-only):
      DATABASE_URL=... python scripts/reconcile_worker_identity.py
  dry-run of a relink (still read-only):
      ... --user <user_id> --patient <patient_id> --reason "why"
  apply:
      ... --user <user_id> --patient <patient_id> --reason "why" --apply

Safety rules enforced on --apply:
  * the target profile must exist and must not be claimed by another account;
  * the account must hold the worker role;
  * the target must have been created by that same account, unless
    --allow-different-creator is given (human confirmed identity out of band);
  * if the account's CURRENT profile has dependent records (cases, questionnaires,
    follow-ups, samples) the relink would orphan those instead, so it is refused
    unless --acknowledge-current-profile-orphaned is given (then it is reported and
    audited, and remains recoverable by relinking back).
"""
import argparse
import getpass
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

DEPENDENTS = (
    ("cases", "patient_id"),
    ("questionnaire_submissions", "patient_id"),
    ("follow_ups", "patient_id"),
    ("samples", "patient_id"),
    ("symptom_reports", "patient_id"),
)


def dependents(db, patient_id):
    from sqlalchemy import text
    counts = {}
    for table, col in DEPENDENTS:
        try:
            counts[table] = db.scalar(text(f"SELECT COUNT(*) FROM {table} WHERE {col} = :p"), {"p": patient_id}) or 0
        except Exception:  # table absent in an older schema
            db.rollback()
            counts[table] = 0
    return counts


def worker_accounts(db):
    from sqlalchemy import text
    return db.execute(text(
        "SELECT u.id, u.phone_e164, u.display_name, u.patient_id FROM users u "
        "JOIN role_assignments r ON r.user_id = u.id AND r.role = 'worker' AND r.revoked_at IS NULL "
        "GROUP BY u.id, u.phone_e164, u.display_name, u.patient_id ORDER BY u.phone_e164")).fetchall()


def report(db):
    from sqlalchemy import text
    claimed = {r[0] for r in db.execute(text("SELECT patient_id FROM users WHERE patient_id IS NOT NULL"))}
    dup = db.execute(text("SELECT patient_id, COUNT(*) FROM users WHERE patient_id IS NOT NULL "
                          "GROUP BY patient_id HAVING COUNT(*) > 1")).fetchall()
    print("== Profiles claimed by more than one account (must be resolved manually) ==")
    print("\n".join(f"  patient {p}: {n} accounts" for p, n in dup) or "  none")
    print("\n== Orphan candidates: unclaimed profiles created by a worker account ==")
    found = 0
    for uid, phone, name, current in worker_accounts(db):
        rows = db.execute(text(
            "SELECT id, patient_code, created_at FROM patients WHERE created_by_user_id = :u ORDER BY created_at"),
            {"u": uid}).fetchall()
        orphans = [r for r in rows if r[0] not in claimed]
        if not orphans:
            continue
        cur = dependents(db, current) if current else {}
        print(f"\n  account {uid} {phone} ({name}) -> current profile {current} deps={cur}")
        for pid, code, created in orphans:
            deps = dependents(db, pid)
            tag = "HAS-RECORDS" if any(deps.values()) else "empty"
            found += 1
            print(f"    candidate {pid} {code} created={created} [{tag}] {deps}")
    if not found:
        print("  none")
    print("\nNo data was changed. To relink one account to one candidate, re-run with "
          "--user/--patient/--reason (dry-run) and add --apply.")


def relink(db, args):
    from sqlalchemy import text
    from app import models
    from app.security import audit
    user = db.get(models.User, args.user)
    patient = db.get(models.Patient, args.patient)
    errors = []
    if not user:
        errors.append("unknown user")
    if not patient:
        errors.append("unknown patient")
    if errors:
        sys.exit("REFUSED: " + ", ".join(errors))
    if user.id not in {r[0] for r in worker_accounts(db)}:
        errors.append("account does not hold the worker role")
    holder = db.scalar(text("SELECT id FROM users WHERE patient_id = :p AND id != :u"), {"p": patient.id, "u": user.id})
    if holder:
        errors.append(f"profile already claimed by account {holder}")
    if patient.created_by_user_id != user.id and not args.allow_different_creator:
        errors.append("profile was not created by this account (use --allow-different-creator after confirming identity)")
    cur_deps = dependents(db, user.patient_id) if user.patient_id and user.patient_id != patient.id else {}
    if any(cur_deps.values()) and not args.acknowledge_current_profile_orphaned:
        errors.append(f"account's current profile {user.patient_id} has records {cur_deps}; relinking would orphan them "
                      "(use --acknowledge-current-profile-orphaned to proceed)")
    if user.patient_id == patient.id:
        errors.append("already linked; nothing to do")
    target_deps = dependents(db, patient.id)
    print(f"user={user.id} {user.phone_e164}  {user.patient_id} -> {patient.id} ({patient.patient_code})")
    print(f"target profile records: {target_deps}; current profile records: {cur_deps or 'n/a'}")
    if errors:
        sys.exit("REFUSED: " + "; ".join(errors))
    if not args.apply:
        print("DRY RUN: no change made. Add --apply to write.")
        return
    previous = user.patient_id
    user.patient_id = patient.id
    audit(db, None, "worker.identity_reconciled", "worker", patient.id, {
        "user_id": user.id, "previous_patient_id": previous, "new_patient_id": patient.id,
        "reason": args.reason, "operator": getpass.getuser(), "target_records": target_deps,
        "previous_records": cur_deps, "different_creator_override": bool(
            patient.created_by_user_id != user.id)})
    db.commit()
    print("APPLIED and audited (worker.identity_reconciled). Reverse by relinking to the previous profile id.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--user")
    ap.add_argument("--patient")
    ap.add_argument("--reason")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--allow-different-creator", action="store_true")
    ap.add_argument("--acknowledge-current-profile-orphaned", action="store_true")
    args = ap.parse_args()
    if not os.environ.get("DATABASE_URL"):
        sys.exit("DATABASE_URL must be set explicitly (no default: this tool must never guess a database).")
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        if args.user or args.patient:
            if not (args.user and args.patient and args.reason):
                sys.exit("--user, --patient and --reason are all required for a relink")
            relink(db, args)
        else:
            report(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
