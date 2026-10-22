# Database Modes (`M3_DATABASE_MODE`)

The API never selects a database silently. The database mode is an **explicit,
required** setting:

```
M3_DATABASE_MODE=postgres|sqlite|none
```

If the variable is absent or invalid, startup fails with a clear configuration
error (`DatabaseConfigError`) **before any connection is attempted** — there is
no implicit default database and no fallback between engines.

## Modes

| Mode          | Behavior |
|---------------|----------|
| `postgres`    | Connects **only** to the configured `DATABASE_URL`, which must be a PostgreSQL URL (`postgresql://`, `postgresql+psycopg://`, or `postgres://`). Startup runs a connectivity check (`SELECT 1`) and **refuses to start** with a clear error if the database cannot be reached. Never falls back to SQLite. |
| `sqlite`      | Connects **only** to the configured `DATABASE_URL`, which must be a `sqlite://` URL. Use a **disposable** path for testing (e.g. `sqlite:////tmp/test_m3.db`). A SQLite mode can never touch a PostgreSQL server (scheme lock). |
| `none`        | **Validation-only.** No SQLAlchemy engine is created and no connection, migration, table creation, or seed ever happens. `DATABASE_URL` is ignored entirely (a stale URL cannot cause a connection). Database-dependent endpoints return an intentional `503 database_disabled`. |

## Configuration precedence (deterministic)

1. `M3_DATABASE_MODE` — required; the server fails fast without it.
2. `DATABASE_URL` — supplies the URL for enabled modes. Resolution order:
   real environment variable → `services/api/.env` → pydantic default (an
   SQLite dev file). The chosen mode **validates** the URL scheme and refuses
   mismatches; it never rewrites or re-targets the URL.

Never log or echo `DATABASE_URL`: it contains credentials. Error messages and
API responses describe the scheme only. (`Engine.url` renders the password as
`***` if it is ever stringified.)

Note: Alembic CLI (`python -m alembic upgrade head`) imports the app, so it also
requires a consistent `M3_DATABASE_MODE` matching its `DATABASE_URL`. Do **not**
run Alembic in `none` mode — migrations are only meaningful for real databases.

## Example configurations

```sh
# PostgreSQL (compose stack; mode defaults to postgres in docker-compose.yml)
M3_DATABASE_MODE=postgres
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@db:5432/DB

# Isolated SQLite testing (disposable file only)
M3_DATABASE_MODE=sqlite
DATABASE_URL=sqlite:////tmp/m3_test_$$.db

# Validation-only (no database at all)
M3_DATABASE_MODE=none
# DATABASE_URL value is irrelevant and ignored — leave it unset.
```

## Endpoint capability by mode

| Endpoint group | `postgres` / `sqlite` | `none` (validation-only) |
|---|---|---|
| `GET /health`, `GET /api/v1/health` (liveness, reports `database_mode`, no secrets) | ✅ 200 | ✅ 200 (`validation_only: true`) |
| `GET /openapi.json`, `/docs` | ✅ | ✅ |
| `POST /api/v1/validate-questionnaire` (DB-free schema/rule validation; always `persisted: false`, never persists, never claims a submission was stored) | ✅ 200 / 422 | ✅ 200 / 422 |
| `GET /ready`, `GET /api/v1/ready` (DB connectivity probe) | ✅ 200 when DB ready | ⛔ **503** `database_disabled` (intentional) |
| `GET /diagnostics` | ✅ | ⛔ **503** |
| Login, authentication, and every DB-backed read/write (patients, cases, assessments, samples, workers, questionnaires, notifications, analytics, …) | ✅ | ⛔ **503** `database_disabled` |
| Kafka event producer (in-process queue; no DB) | ✅ (if enabled) | ✅ (no DB use) |

### What `503 database_disabled` looks like

```json
{
  "detail": {
    "error": "database_disabled",
    "database_mode": "none",
    "message": "Database access is disabled (validation-only mode). No data was read or written; retry against a server running with a database."
  }
}
```

The body contains no connection details, hosts, or credentials. This applies
regardless of the presented token: **no identity is accepted, rejected, or
fabricated** in `none` mode because authorization cannot be verified without the
database (a request with an invalid token and one with a valid token receive the
identical intentional 503; nothing is granted).

## What can and cannot be validated in `none` mode

**Can:** process liveness, API routing, OpenAPI/contract shape, Pydantic request
validation (422 paths), the questionnaire schema/rule validator via
`POST /api/v1/validate-questionnaire`, mobile connectivity to the server
(`/health` works, and the app surfaces the 503 message as an alert).

**Cannot:** authentication, authorization, role permissions, any persistence or
read of real data, idempotency-replay across restarts, analytics. No endpoint
reports fabricated patient/case/laboratory/screening success, and no write is
simulated.

## Notes for tools and scripts

- Scripts that import `app.*` (`scripts/seed_pg_testdata.py`,
  `scripts/pg_concurrency_check.py`, `scripts/reconcile_worker_identity.py`,
  `scripts/check_deployment_gates.py` via app imports, verify scripts) take
  `DATABASE_URL` from the runner — pass a matching `M3_DATABASE_MODE`
  explicitly (e.g. `-e M3_DATABASE_MODE=postgres -e DATABASE_URL=...`).
- `python -m app.seed` derives the mode deterministically from the
  `DATABASE_URL` the runner already set (documented CLI convenience).
- Tests (`services/api/tests/conftest.py`) set the mode from the resolved
  disposable test database; mode tests in `tests/test_database_modes.py`
  instrument `sqlalchemy.create_engine` to prove `none` mode creates no engine
  and opens no connection.

## Known limitations / owner decisions

- `M3_DATABASE_MODE` is now **required** for every process that imports the app
  (server, Alembic, seeds, verify scripts run via `docker run -e …`). Existing
  runners that only set `DATABASE_URL` must add the mode.
- `docker-compose.yml` defaults the api service to
  `M3_DATABASE_MODE: ${M3_DATABASE_MODE:-postgres}` so the existing stack keeps
  its exact PostgreSQL configuration.
- Mobile apps need no change: the API base URL was already runtime-configurable
  (`apps/mobile/src/api.ts` server-configuration dialog), and 503
  `detail.message` strings surface directly as user-facing alerts.
