# M3 Validation Kit — Release Candidate 1

Everything needed to re-verify the platform from a clean machine. All commands run from
the repository root unless stated. Nothing here mutates the dev/production database; every
terminal step targets an explicitly disposable test database or a SQLite file created
fresh by the test harness.

---

## 1. Environment setup

```bash
# 1a. Python venv for the backend test battery
cd services/api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..

# 1b. Disposable PostgreSQL 16 (validated config). Destroy freely.
docker run --name m3-pg-test -p 5434:5432 \
  -e POSTGRES_USER=m3test -e POSTGRES_PASSWORD=m3test -e POSTGRES_DB=m3_test \
  -d postgres:16-alpine

# 1c. Node deps for both clients
(cd apps/mobile && npm install)
(cd apps/web && npm install)
```

Never run these commands against `m3-dev.db`'s companion production DB or any database
whose name contains `prod`/`live`; every script below refuses such URLs explicitly.

---

## 2. Automated verification battery

| # | Command | Expectation |
|---|---------|-------------|
| 2a | `cd services/api && .venv/bin/python -m pytest tests/ -q` | 55 passed, 1 skipped (SQLite) |
| 2b | `M3_TEST_DATABASE_URL='postgresql+psycopg://m3test:m3test@127.0.0.1:5434/m3_test' .venv/bin/python -m pytest tests/ -q` (same cwd; DB may need recreate first, see below) | 56 passed |
| 2c | `cd apps/mobile && npm run typecheck` | 0 errors (`expo lint` reports pre-existing SDK-57 react-compiler style warnings — known debt, see RELEASE_READINESS §7) |
| 2d | `cd apps/web && npm run build && npm run lint` | clean build + clean tsc |

Freshing the PG suite target when re-running:

```bash
docker exec m3-pg-test psql -U m3test -d postgres \
  -c "DROP DATABASE IF EXISTS m3_test;" -c "CREATE DATABASE m3_test;"
```

Notes:
- `tests/conftest.py` honors `M3_TEST_DATABASE_URL`; without it the SQLite file
  `services/api/test-m3.db` is recreated per run.
- The audit-trail test file `tests/test_migrations.py::test_postgres_legacy_upgrade_rehearsal`
  creates its own isolated DB `m3_migration_test_pg` and drops/recreates it per run.

## 3. Repeatable PostgreSQL test-data seeder

```bash
python3 scripts/seed_pg_testdata.py \
  --db-url 'postgresql+psycopg://m3test:m3test@127.0.0.1:5434/m3_pg_seed'
```

Guarantees: refuses non-test database names (`m3_prod`, production markers), refuses
sqlite URLs, never deletes rows, is idempotent (second run reports zero created),
and prints per-category counts. It seeds:
- 9 accounts covering all 7 roles (+2 extra workers), PIN 2468, prefix `pgtest-`
- 2 contractor sites + 1 facility, 4 synthetic workers (complete/partial/draft
  questionnaire states, consent documented/pending, DOB Feb-29 and age-only records)
- 5 roster memberships incl. month/year-boundary episodes; 2 travel events
  (planned + returned across the Dec 28 boundary)
- 3 clinical assessments (admitted severe via RDT, outpatient resolved via receipt,
  month-boundary incomplete treatment with documented reason)
- 4 samples/tests (positive pv, negative, mixed smear, pending smp), 2 slide
  follow-ups, 3 follow-ups (due/completed/missed), 2 molecular results

## 4. Read-only integrity SQL

```bash
docker exec -i m3-pg-test psql -U m3test -d m3_pg_seed -v ON_ERROR_STOP=1 -q \
  -f - < scripts/sql/verify_integrity.sql
```

Expected on a freshly seeded DB: sections A–E all zero/empty; section F counts
matching the seeder output above (section G's audit listing fills after an API run).

## 5. Upgrade-path rehearsal (disposable DB, PostgreSQL)

```bash
bash scripts/pg_upgrade_rehearsal.sh
```

Builds `m3_pg_upg` at revision 20261019_01, inserts legacy rows, upgrades to head,
asserts row preservation + new columns (`client_request_id`),

`created_by_user_id`) + indexes (incl. partial unique `uq_patients_client_request_id`)
and an ORM read, then drops the DB. Prints `UPGRADE REHEARSAL: PASS` on success.
Single-DB SQLite variant wrapped by `tests/test_migrations.py` (runs inside pytest).

## 6. Concurrency integrity against the reconciliation race

```bash
python3 scripts/pg_concurrency_check.py \
  'postgresql+psycopg://m3test:m3test@127.0.0.1:5434/m3_pg_seed'
```

Proves two racing sessions writing the same offline attempt id produce exactly one
committed patient row; the loser is rejected by the partial unique index and rolls
back clean. Single-commit contracts print `PASS: exactly one session committed...`.

## 7. Live-API end-to-end (all 7 roles + P0/P3 server flows)

Start a disposable API instance (or use your own already-running one at :8001):

```bash
cd services/api
rm -f /tmp/opencode/m3_e2e_shadow.db
DATABASE_URL='sqlite:////tmp/opencode/m3_e2e_shadow.db' .venv/bin/alembic upgrade head
DATABASE_URL='sqlite:////tmp/opencode/m3_e2e_shadow.db' .venv/bin/python -m app.seed
DATABASE_URL='sqlite:////tmp/opencode/m3_e2e_shadow.db' \
JWT_SECRET='e2e-shadow-test-secret-0F' BOOTSTRAP_SECRET='bootstrap-e2e-0F' \
  .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8002   # stop with Ctrl-C

M3_E2E_BASE_URL='http://127.0.0.1:8002/api/v1' python3 scripts/verify_e2e_lan.py
```

Sections covered: health, negative auth + failed-login lockout (5 wrong PINs lock; correct PIN still rejected with the generic message until unlocked), 7-role login, RBAC 403 gates, full
surveillance flow (intake → screening → clinical → lab → slide follow-up → contractor
report), privacy views, offline-replay reconciliation (same + cross-creator), stale-edit
409 guard with server-supplied version, audit RBAC + revoked sessions via POST /auth/logout.
Without `M3_E2E_BASE_URL` the script targets the LAN IP on :8001 as before.

Mobile conflict-UX contract (versioned writes): the two server-guarded write screens —
contractor reported status (sites) and pathologist slide follow-up (diagnostic) — now mirror
the server's `updated_at` back as `base_updated_at`. On a 409 the app shows "Record Changed
Elsewhere" with the authoritative server timestamp and offers "Load & retry" (resubmits
against the server version) or "Keep server version" (cancels). Session-expiry on an
online submission keeps the in-progress form on screen with a sign-in-again prompt;
the tamper-evidence cross-check remains `scripts/sql/verify_integrity.sql`.

## 8. Offline client verification

```bash
python3 scripts/verify_offline_cache.py   # draft + outbox retention, replay cleanup
```

## 9. Manual acceptance checklist (each role, on-device/table)

1. **Worker**: login (PIN), personal dashboard, submit all 5 questionnaire sections,
   keep unanswered fields empty and verify per-section save reliability;
   enable airplane mode, register a worker offline, re-enable connectivity, confirm
   exactly one created record and the outbox item disappears.
2. **Contractor**: roster scoping to their sites only; enroll worker; re-open
   connectivity interrupted once mid-submit (offline draft + one server record).
3. **Clinician**: assessments create; try stale concurrent edit (expect 409 with a
   server timestamp, retry passes); assign a follow-up with +3d due date passing 30d.
4. **Pathologist**: samples/tests for pf/pv/mixed; slide follow-up record reason flow.
5. **Health worker**: follow-up roster list read-only; attempts to write get 403 UX.
6. **Research lab**: read-only results list de-identified (no name/mobile columns).
7. **Admin**: audit trail read (login, worker creation/replay, logout rows present);
   write attempts 403; cannot see/overwrite workers' questionnaire content.

## 10. Disposal

```bash
docker exec m3-pg-test psql -U m3test -d postgres -c "DROP DATABASE IF EXISTS m3_pg_seed;" \
  -c "DROP DATABASE IF EXISTS m3_test;" -c "DROP DATABASE IF EXISTS m3_migration_test_pg;"
docker rm -f m3-pg-test      # when done with the kit entirely
rm -f services/api/test-m3.db   # recreated automatically by the test suite
```

`m3-dev.db` (the developer's live database) is never touched by this kit.
