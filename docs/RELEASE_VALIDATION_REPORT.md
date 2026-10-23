# M3 Release Validation Report

**Date**: 23 Oct 2026
**Scope**: Release validation of the rebuilt M3 web + mobile applications (post UI-rebuild working tree, HEAD `c9a34fd`, all rebuild work uncommitted and preserved).
**Method**: Validation-first. All integration testing ran against a purpose-built, fully isolated disposable Compose environment. The shared `m3-compose` stack was never restarted and its database was never written to.

---

## 1. Environment and isolation evidence

The briefed warning proved central: setting a different project name on the **existing** `docker-compose.yml` is **not** sufficient isolation — container names are hard-coded (`m3-compose-postgres`, …), ports are fixed (5432/9092/8003/5173/8081), and a `-p` run would have collided with the live shared stack. A focused environment was therefore written from scratch:

- File: `scripts/release-validation/compose.validation.yml` (new, untracked)
- Project/containers: `m3val` → `m3val-postgres`, `m3val-kafka`, `m3val-api`, `m3val-web`, `m3val-api-none`
- Ports: 8004 (api), 8005 (api-none), 5174 (web), 9094 removed later (see §9.1) — all verified free before start
- Volume: `m3val_m3val-postgres-data` (fresh, unique) — **never** the shared `m3_m3-compose-postgres-data`
- Network: `m3val_m3val-net` (unique) — **never** the shared `m3_m3-network`
- API env: `M3_DATABASE_MODE=postgres` explicit, `DATABASE_URL` assembled inside compose and pointing to the disposable db service; CORS allow-list = isolated console origins only (`http://localhost:5174` etc.)
- Web image built with `VITE_API_BASE_URL=http://localhost:8004/api/v1`
- `docker compose config` was inspected **before** start: isolation confirmed (names/ports/volume/network unique, explicit modes)
- Migrations + seed (`alembic upgrade head && python -m app.seed`) ran **only** on the disposable database (verified seeded state: 7 users, 1 patient, 1 site, alembic at head, 0 API errors). No migrations/seed/destructive operation touched the shared stack.
- Seed fixture truth = current repo `seed.py` (phones `+919000000001..007` = worker/clinician/pathologist/health_worker/research_lab/contractor/admin, dev PIN `2468`) — this matches `scripts/verify_e2e_lan.py` exactly, so the disposable DB resolved the shared-DB seed divergence documented in the UI rebuild report (§7.2). No credential value is printed in this report.

## 2. Test matrix by role and workflow (HTTP, real server, disposable PG)

Harnesses:
- `scripts/verify_e2e_lan.py` (pre-existing) with `M3_E2E_BASE_URL=http://localhost:8004/api/v1` — the full 7-role matrix: auth (unknown phone 401, wrong PIN 401), per-role sessions, RBAC write denials (worker on assessments/samples, clinician on samples, health_worker/research_lab/admin on all writes), worker registration + re-registration identity resolution, 5-section questionnaire submit + idempotent duplicate, clinician assessment + follow-up assignment, pathologist sample + Day-7 slide follow-up with reason, contractor membership + reported-status (planned vs recorded malaria status), pseudonymized research view, dashboards by scope, offline-replay reconciliation (duplicate=true, no second record), cross-account replay → 409, stale-edit 409 conflict + resolution, audit RBAC + no-write route, logout session revocation.
- `scripts/release-validation/validate_api_gaps.py` (new) — supplementary gap coverage.

**Result: `verify_e2e_lan.py` — 40/40 PASS ("ALL E2E LAN SURVEILLANCE TESTS PASSED SUCCESSFULLY").**

Gap-harness result (**34/34 PASS**) highlights per workflow:

| Group | Checks (all PASS) |
|---|---|
| Auth/session | garbage bearer → 401; all 7 roles authenticate; wrong-PIN sessions uniformly 401 |
| Case acknowledge | worker symptom report → 201 → case `awaiting_clinical_review`; clinician ack → 200 `status=assigned`; repeat ack → 409; worker/health_worker ack → 403; unknown case → 404; acked state persists on re-read |
| Assessment identity | unknown patient → 404 |
| Pathology negatives | positive without species → 422; `species=other` without note → 422; smear_type with rdt → 422; valid sample → 201; rejections left **zero** extra persisted rows |
| Follow-up negatives | malformed `due_date` → 422; missing assignee → 422; nothing persisted |
| Contractor boundary | clinical detail view denied (404, existence masked) |
| Admin/audit | audit-events paging (`limit`, `offset`, `total`) works; second page differs; clinician denied (403); no write route (403/405) |
| Login lockout | 5 wrong PINs → subsequent correct PIN **still 401** (uniform, no account disclosure); lockout state persisted across logins and API restarts (server-side, DB-backed); UI login honestly reports the ended session (observed organically in Phase 4) |

## 3. API writes and persisted-state evidence

Post-run disposable-DB counts (`docker exec m3val-postgres psql`): patients 8, questionnaire_submissions 1 (idempotent replay never multiplied), symptom_reports 5 (→ 5 cases), cases 5 (all with `status='assigned'` + `acknowledged_at` set after acks), samples 7, follow_ups 2, audit_events 120, worker_site_assignments 2.

Idempotency proof — duplicate `client_request_id` rows per table:
```
symptom_reports_dups|0
questionnaire_submissions_dups|0
cases_dups|0
```
Rejected writes never persisted partial rows; successful writes were read back with authoritative state (e.g. acknowledged case re-read as `assigned`).

## 4. Offline / synchronization results

Three evidence tiers; device-level scenarios remain pending:

1. **`scripts/verify_offline_cache.py` (SQLite cache/outbox spec suite): 17/17 PASS** — cache init, offline read, sync metadata preservation, per-owner cache isolation, sign-out clearing, draft preservation across owner switch, draft isolation, draft cleanup after final submission, new-worker offline enqueue, outbox owner isolation, purge after server replay, pending idempotency id reuse on double-tap, pending-id survival through ambiguous timeout, no cross-owner pending-id leakage, session-expiry keeps pending id, ack retires only the matching id.
2. **Real outbox algorithm, node-scenario harness (new): `scripts/release-validation/outbox_flush.test.ts` — 8/8 PASS** against the production `apps/mobile/src/outbox.ts` (`flushOutbox`) with only the I/O seams mocked (api transport/cache/app store): oldest-first drain; offline no-op keeps queue+draft; transport failure returns item to `queued` and keeps draft; auth error parks item + `authBlocked` and keeps the rest; permanent rejection parks item as `failed` and continues replay; duplicate-ack counts as success and a re-press never re-sends; flush is single-flight + identity-bound; per-owner isolation (one owner never flushes another's queue or retires another's pending key). Run command recorded in §8.
3. **Manual device scenarios: PENDING.** No physical Android device is attached (`adb devices` → none) and the machine has no emulator/system images (`NO_SYSTEM_IMAGES`); none were downloaded. Restart-persistence, reconnect-flush, and queue-badge visuals still require an on-device pass.

## 5. Web build, browser, and CORS results

- Playwright capture suite run against the **isolated** console at `http://localhost:5174` (image built with the 8004 API URL) for **all 7 roles** with real CORS enforcement (`--disable-web-security` dropped) and the disposable-seed role mapping/PIN passed via env (`ROLES_JSON`, `DEV_PIN`, `OUT_DIR` — capture.mjs now parameterized). 40+ captures in `screenshots/release-validation/` with `screenshot-index.md`.
- Console/error scan per role: clean for worker/pathologist/research_lab/health_worker/contractor (0 errors, 0 failed requests); clinician shows a single deliberate RBAC `403 GET /samples?limit=50` — the UI renders an honest red "Couldn't load this data — You do not have permission for this action" panel with request ID + Retry (screenshot `clinician-samples-denied.png`). Minor finding (§9.3).
- **CORS/deployment readproof**: preflight from `:5174` → 200 with `access-control-allow-origin: http://localhost:5174`, `allow-credentials: true`, method/header lists; also reflected on simple GET. Preflight from the shared console origin `:5173` → **400 + no allow-origin** (rejected). The allow-list is narrow and correct for the isolated origin; the *production* deployment recommendation (not executed) is in §12.
- **503 database-disabled honesty in the browser**: a second console build (`VITE_API_BASE_URL=http://localhost:8005/api/v1`, container on `:5176`) was driven against `M3_DATABASE_MODE=none` API: login attempt surfaces the exact server response (`database_disabled`, "No data was read or written…") in a warning block; screenshot `web-none-mode-503-login.png`. No fabricated success anywhere.
- **Narrow viewports**: 390×844 and 768×1024 → horizontal overflow **0 px** in both; workspace, tables, and drawer usable (screenshots `web-narrow-mobile-*.png`).
- Web quality gates re-run this phase (§8).

Offline-banner behavior re-captured per role (real navigator-offline detection).

## 6. Android APK details and device verification status

- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Size: **34,074,849 bytes**; sha256 `f2084a5ae3f61221c2605ef73aa85939c94368a442abc2ddcbadae9ef4b37a68`; build timestamp 22 Oct 2026 21:17:53 IST
- Badging (`aapt dump badging`, build-tools 35.0.0): package `org.m3.surveillance`, versionCode **1**, versionName **0.1.0**, minSdk **24**, targetSdk **36**; permissions: `INTERNET`, `READ_EXTERNAL_STORAGE` (maxSdk 32)
- **Device/emulator verification: explicitly PENDING.** No device attached, no AVD/system images available; nothing was sideloaded. Native-device acceptance (install, launch, questionnaire flows, offline sync on-device, network security config) still requires an authorized physical test device and is not claimed.

### 6.1 Offline Demo Mode APK (Phase 9, 23 Oct 2026)

- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (rebuilt in place with Offline Demo Mode)
- Command: `./gradlew assembleRelease` in `apps/mobile/android` with `JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2` (JDK **17** Temurin; the default JDK 27 is **not** supported by the RN root-project Gradle plugin — "Unsupported class file major version 71")
- Size: **34,111,509 bytes**; sha256 `ac9a4cfa3aa24a0d608efdf3cbc2b88d8c9b6925e9a6b843c8afcf0008392b6a`
- Badging (`aapt dump badging`, build-tools 36.0.0): package `org.m3.surveillance`, versionCode **2**, versionName **0.2.0-demo**, minSdk **24**, targetSdk **36**, native-code **arm64-v8a**, label "M3 Surveillance"
- Runtime equality proof: Hermes release bundle fully embedded (`assets/index.android.bundle` in the APK) — the app opens to the sign-in/server-config screen with **no Metro/dev server, no Expo Go and no network**.
- Demo documentation: `docs/OFFLINE_TABLET_DEMO.md`; demo-isolation proof: `scripts/release-validation/offline_demo.test.ts` (8 scenarios ✔) and `apps/mobile/src/demo.test.ts` (7 ✔)
- **Physical-tablet verification of demo mode: explicitly PENDING** (no device/AVD available on the build machine; nothing sideloaded).
- versionName was intentionally bumped to `0.2.0-demo` (versionCode 2) so tablet installs of the demo build are distinguishable from the earlier 0.1.0 build.

### 6.2 Standalone Local Server APK (23 Oct 2026)

- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (rebuilt in place with Standalone Local Server Mode)
- Command: `./gradlew assembleRelease` in `apps/mobile/android` with `JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2` (JDK 17 Temurin) and `M3_BUILD_PYTHON=/home/atreya/.local/share/mise/installs/python/3.12.15/bin/python3.12` (Chaquopy requires a host Python of the same minor version as the embedded runtime)
- Size: **65,677,005 bytes**; sha256 `7eea383f15c652cff06adaeee6a8ae7b922ad5ccf1985b8b0387b7ad17a1888b`
- Badging (`aapt2 dump badging`, build-tools 36.0.0): package `org.m3.surveillance`, versionCode **3**, versionName **0.3.0-standalone**, targetSdk **36**, native-code **arm64-v8a**, label "M3 Surveillance"; verification: `apksigner verify` OK (project debug keystore, same as §6.1)
- Embedded runtime verified inside the APK:
  - `assets/chaquopy/app.imy` — the REAL `app` backend package (main/models/schemas/security/database/permissions/questionnaire/analytics/…, 13 modules) + `m3_local_server.pyc` bootstrap
  - `assets/chaquopy/requirements-common.imy` — 1,148 pip package entries, including native binaries `pydantic_core/_pydantic_core.cpython-312.so` (self-built Android wheel, sha256 `9682a1ec…e81`), `argon2` `_ffi.so`, greenlet
  - 11 `assets/alembic_pack/` entries — the complete real alembic tree (`alembic.ini`, `env.py`, all 9 version scripts up to head `20261027_01`)
- Build fixes made during this phase (all verified in the final APK): Chaquopy `buildPython` is a list; task-order validation between the Gradle sync tasks and Chaquopy source/asset merge tasks; two SRC-path bugs (`projectRoot`-level arithmetic and `m3-python` resolved relative to the app project); `aiokafka` removed from the device package list (no platform-independent wheel exists; backend imports it lazily and Kafka is disabled — import-proven without it)
- Standalone documentation: `docs/STANDALONE_LOCAL_SERVER.md`; no-remote-leak proof: `scripts/release-validation/standalone.test.ts` (6 ✔); on-device-equivalent lifecycle proof: `services/api/tests/test_standalone_lifecycle.py` (2 ✔ — real alembic, uvicorn on 127.0.0.1, signup/login/questionnaire/403-role-guard, full stop+restart persistence)
- **Physical-tablet verification of standalone mode: explicitly PENDING** (no device/AVD available on the build machine; nothing sideloaded). The architecture is automated-test-verified only.

## 7. Database-mode safety results

**`none` mode (live HTTP on `:8005`, stale `DATABASE_URL` → `host.invalid`):**
- `GET /health` → 200 with `database_mode:"none"`, `database:"disabled"`, `validation_only:true`
- `POST /auth/login`, `POST /questionnaires/submit`, authenticated `GET /workers` → **all 503 `database_disabled`** with explicit "No data was read or written…"
- `POST /validate-questionnaire` (db-free) → 422 with proper schema validation detail (endpoint works without a database)
- Startup banner: "VALIDATION-ONLY MODE … No database engine exists; no migrations, table creation, or seed data run…"
- **Zero session rows** from either API container in `pg_stat_activity` on the disposable Postgres; no connection errors / no `host.invalid` contact attempts in logs (the stale URL is absorbed, never dialed, never logged verbatim)

**`postgres` mode**: all Phase 2 integration traffic ran with `M3_DATABASE_MODE=postgres` on the disposable DB (engine-of-record parity with production). Unit suite also executed with explicit SQLite DB (161+1skip) mirroring CI usage.

Destructive operations only ever targeted disposable resources.

## 8. Exact test commands and results (this phase)

| Command | Result |
|---|---|
| `docker compose -f scripts/release-validation/compose.validation.yml up -d --build` | all 5 services healthy (after §9.1 fix); migrations+seed on disposable DB only |
| `M3_E2E_BASE_URL=http://localhost:8004/api/v1 python3 scripts/verify_e2e_lan.py` | **40/40 PASS** |
| `python3 scripts/release-validation/validate_api_gaps.py` (GAP_API_URL `:8004`, GAP_NONE_API_URL `:8005`) | **34/34 PASS** |
| `python3 scripts/verify_offline_cache.py` | **17/17 PASS** |
| `node --import ./scripts/release-validation/ts_loader.mjs --test --experimental-test-module-mocks scripts/release-validation/outbox_flush.test.ts` | **8/8 PASS** |
| Backend SQLite: `docker run --rm -v $PWD:/home/atreya/Work/m3:ro -w …/services/api -e DATABASE_URL='sqlite:////tmp/val_pytest.db' m3val-api sh -c "PYTHONPATH=. python -m pytest tests/ -q -p no:cacheprovider"` (includes auth-matrix, RBAC, database-modes, deployment-gate, idempotency-scoping, migrations, questionnaire suites) | **161 passed, 1 skipped** (identical to rebuild-phase baseline; skip = PG-only case) |
| Backend PostgreSQL (disposable): same image + `M3_TEST_DATABASE_URL` → `…@db:5432/m3val_test` (separate test DB created inside the disposable container) | **162 passed** (PG-only case now runs; 0 failures) |
| `apps/mobile`: `npm run typecheck` / `npm run test` / `npm run lint` (outbox 8/8 counted separately above) | typecheck clean; **12/12**; outbox **8/8**; lint **0 errors** (1 pre-existing `no-unused-vars` warning in `scripts/verify_pagination_web.js`, untouched) |
| `apps/web`: `npm run lint`(tsc) / `npm run test` / `npm run build` | tsc clean; **12/12**; built 303.6 kB JS · build OK |
| Web capture (isolated): `WEB_BASE=http://localhost:5174 … ROLES_JSON='<repo-seed mapping>' DEV_PIN=… NO_INSECURE=1 node scripts/capture.mjs` (7 roles) | 40+ captures + console audit; 1 by-design 403 handling verified honest |
| APK checks: `sha256sum`, `aapt dump badging`, `adb devices` | recorded; no devices |

Prior-phase results (not re-executed where distinct): mobile 12/12 + web 12/12 first-green runs, backend 161+1 baseline — both re-confirmed this phase.

## 9. Bugs found and fixes made

**Fixed this phase (validation-environment only, no product code changed):**
1. `m3val-kafka` healthcheck was too tight (10 s timeout vs JVM cold start) and its advertised PLAINTEXT listener pointed at the host-mapped port unreachable inside the container → healthcheck `start_period: 40s`, `timeout: 30s`, interval 10 s; advertised listener aligned to the internal pattern; redundant host port mapping removed. Service then went healthy; no shared-stack mutation.
2. Frontend harness ergonomics (supporting validation, not product defects): `capture.mjs` gained `DEV_PIN`/`ROLES_JSON`/`OUT_DIR`/`NO_INSECURE` env parameterization and a console-error/network audit so the disposable run could execute with real CORS.

**Product observations (non-blocking, recorded for owners):**
3. Clinician nav exposes the "Diagnostics & Pathology" tab while its data endpoint is RBAC-denied → honest 403 error panel renders (good), but the "Lab queue is clear" empty-state below it reads misleadingly next to the error banner. Suggest suppressing that empty-state or gating the tab; cosmetic.
4. Web quick-fill login chips still carry the **shared-DB** legacy mapping/labels (PIN hint text) — correct for the current shared demo DB but diverges from fresh-seed truth (§1). Reminder in deployment notes: the login hint text should match the deployed DB's seed source.
5. All reported findings are honest-error-safe: the UI never fabricated data or success in any observed failure/limitation state.

## 10. Remaining blockers / manual actions

- **Android device verification pending** — perform on an authorized physical device against an isolated API (steps list in mission Phase 5): install APK, launch, login, questionnaire+draft flows, offline queue + reconnect, screenshots/logs. Not claimed.
- **Deployment (not executed, recommendation only)**:
  - Build web image with the *production* API origin in `VITE_API_BASE_URL`; add that exact web origin to the API's `API_CORS_ORIGINS` allow-list (narrow, explicit — proven pattern and behavior this phase). Do not widen to wildcard origins.
  - Login hint/copy should match the deployed DB seed source.
  - Run migrations+seed exactly once against the production DB at cutover; the compose pattern proven here (explicit mode + gated boot) is the reference.
- Admin account on the disposable environment was left in a locked state by the lockout tests and was unlocked once mid-run on the disposable DB only; it no longer exists (teardown §11).

## 11. Shared database and working-tree preservation

- **Shared stack**: untouched — same five containers with continued uptimes (43–44 h at final check vs 42–44 h at Phase 0; never restarted/recreated), plus the unrelated `office-inventory-dashboard` container still running untouched.
- **Shared DB identity preserved**: patients **49**, cases **36**, users **48**, samples **13** — identical to the Phase 0 baseline; zero writes.
- **Disposable resources removed** (`down -v` + manual ad-hoc container removal): 0 m3val containers / volumes / networks / images remain; the `m3val_test` database existed only inside the removed disposable volume.
- **Working tree**: no commit/push/reset/clean/stash performed. Baseline Phase 0 status: 31 dirty entries; the tree now contains **all baseline entries preserved** plus this phase's additions (`scripts/release-validation/` and `docs/RELEASE_VALIDATION_REPORT.md`; screenshots live inside the already-untracked `screenshots/`). Nothing removed or overwritten; `apps/web/scripts/capture.mjs` (already-untracked rebuild artifact) was extended only.
- Pre-existing modified files and diffs (e.g. `apps/web/tsconfig.tsbuildinfo` churn from builds) remain; no unrelated refactor was performed.

## 12. Final recommendation

**READY WITH EXPLICIT LIMITATIONS.**

Grounded in observed end-to-end evidence: the full 7-role HTTP matrix (40/40) and 34 gap checks pass against a real PostgreSQL-backed API with persisted-state and idempotency proofs; the database-mode safety story is verified live (503 honesty, zero engine/contact side effects); CORS is correct and narrow for the isolated origin; the web renders every failure state honestly (503, 403, offline) with zero fabricated content and no layout overflow at narrow viewports; offline logic is validated at the cache-spec level (17/17) and against the real outbox algorithm (8/8); backend gates are identical-or-stronger than baseline (162/162 on PostgreSQL now passing).

Explicit limitations gating *full* release: (a) **physical-device verification of the release APK is pending** (no device/emulator was available; nothing was claimed); (b) **deployment configuration must be completed at cutover** (production API origin in the web build + matching narrow CORS entry + one-time production migrate/seed + login-copy alignment). Field-device acceptance and a completed deployment runbook turn this into unqualified READY.
