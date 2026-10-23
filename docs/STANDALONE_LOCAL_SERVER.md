# Standalone Local Server Mode

*Status: implemented and release-validated on this machine; physical-device
verification is explicitly **PENDING** (no authorized tablet / emulator was
available during this build — see "Acceptance gates" below).*

Standalone Local Server Mode runs the **real M3 backend on the tablet
itself**: the Android app embeds an actual CPython 3.12 runtime (Chaquopy)
which serves the genuine FastAPI application (`services/api/app`) with
uvicorn, backed by a real SQLite database in the app's private storage. There
is no demo data, no synthetic identity, no simulated write, and no internet,
laptop, Wi-Fi, Expo Metro, shared Docker stack or remote PostgreSQL involved
in any request.

This is a **separate mode** from:

* the existing **online mode** (the app talking to a remote FastAPI server),
  which is untouched, and
* the existing **Offline Demo Mode** (synthetic in-app data), whose entry is
  currently **hidden** on the sign-in screen. Its code is fully intact and is
  restored by flipping one flag (`SHOW_DEMO_ENTRY = true` in
  `apps/mobile/app/index.tsx`).

Not for production clinical use: this deployment exists for authorized
testing. See "Security limitations" at the bottom.

---

## 1. Architecture and Android runtime strategy

| Layer | Implementation |
|---|---|
| Python runtime | Chaquopy 17.1.0 Gradle plugin; CPython **3.12.15-0** target (`com.chaquo.python:target`, Maven Central); platform tag `android_24_arm64_v8a`, min API 24 |
| Server | uvicorn 0.34.2 (plain, no `[standard]` extras) programmatically serving the real `app.main:app` inside a daemon Python thread **in the app process** |
| Bind address | `127.0.0.1:8741` only — never `0.0.0.0`. Nothing is reachable from Wi-Fi or any other device |
| Native bridge | `LocalServerModule.kt` (React Native `M3LocalServer` module) → `m3_local_server.py` (packaged from `apps/mobile/android/app/m3-python/`) |
| JS bridge | `apps/mobile/src/localServer.ts` (`localServerStart/Stop/Reset/Status`) |
| API client | `apps/mobile/src/api.ts` forces `http://127.0.0.1:8741/api/v1` while local mode is active; the persisted remote custom URL is left byte-for-byte intact and re-activated on exit |
| Database | real SQLite (SQLAlchemy `M3_DATABASE_MODE=sqlite`, `DATABASE_URL=sqlite:///<filesDir>/m3-local.db`) |
| Migrations | **real alembic `upgrade head`** — the `alembic/` tree from `services/api` ships as APK assets (`alembic_pack/`) and is extracted to real files on-device before the first upgrade |
| Packaging sync | Gradle tasks `syncM3Backend` (services/api/app → APK python sources) and `syncM3Migrations`/`syncM3MigrationsIni` ( alembic tree → assets) run before every build, so the embedded backend is always identical to the repo |

Why in-process: Android does not permit an arbitrary always-on background
service; hosting uvicorn inside the app process (a Python thread) is the only
approach installable without root/ADB/developer tooling that keeps the *real*
FastAPI handlers. Lifecycle consequences are documented in §7.

### Python dependency handling

All backend dependencies run on-device as real packages
(`apps/mobile/android/app/m3-requirements.txt`; versions identical to
`services/api`):

* Pure-Python packages (fastapi, uvicorn, SQLAlchemy core, alembic, pydantic,
  pydantic-settings, PyJWT, pwdlib, aiokafka…) resolve from PyPI.
* Native extensions with Android-agnostic wheels are NOT published upstream as
  `android` platform wheels; they come from the Chaquopy legacy wheel repo
  (`chaquo.com/pypi-13.1`, wired via `--extra-index-url`):
  `greenlet 3.0.1`, `cffi 1.17.1`, `argon2_cffi_bindings 21.2.0`
  (cp312 / `android_24` / arm64-v8a).
* **`pydantic-core 2.23.4` has no Android wheel anywhere**, so it was
  cross-compiled for this build (maturin + Rust `stable`, NDK 27.1 against
  the Chaquopy CPython 3.12 target headers/libs) and committed as a wheel:

  * `apps/mobile/android/app/m3-wheels/pydantic_core-2.23.4-cp312-cp312-android_24_arm64_v8a.whl`
  * SHA-256: `9682a1ec6c004441a969a1618ac4fe6f82d4d207ff909185f8c38e8c25efae81`
  * (build workspace/repro script: `/tmp/opencode/pycorebuild/pybuild2.sh` —
    `PYO3_CROSS_*` against the extracted `target-3.12.15-0-arm64-v8a.zip`
    plus `_sysconfigdata__linux_.py` from the target stdlib zip)

* Postgres driver (psycopg), kafka runtime (aiokafka is installed but
  **Kafka is disabled**: `KAFKA_ENABLED=false`, event hub is a no-op) and
  uvicorn's C extras (`httptools`, `uvloop`, `watchfiles`) are deliberately
  absent on the tablet.

### Build requirements (host)

```bash
JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2 \
M3_BUILD_PYTHON=/home/atreya/.local/share/mise/installs/python/3.12.15/bin/python3.12 \
./gradlew assembleRelease
```

The build-host Python must be **3.12.x** (`M3_BUILD_PYTHON` env var;
`app/build.gradle` documents the default path). All other tooling is fetched
by Gradle.

## 2. First-launch database initialization

When the user presses **"Start local server & use this tablet"** on the
sign-in screen:

1. `LocalServerModule.kt` starts the embedded CPython runtime (first press
   costs a few seconds of interpreter init) and extracts `assets/alembic_pack/`
   (the real `alembic.ini` + `alembic/env.py` + all migration scripts) into
   `filesDir/migration/` — alembic must load `env.py` from real files.
2. `m3_local_server.py::start()` sets the environment **before any backend
   import**: `M3_DATABASE_MODE=sqlite`,
   `DATABASE_URL=sqlite:////data/user/0/org.m3.surveillance/files/m3-local.db`,
   `KAFKA_ENABLED=false`, a **random per-boot `BOOTSTRAP_SECRET`** (see §4).
3. `alembic upgrade head` runs the complete real migration chain onto the
   fresh SQLite file (proven on-device-equivalent: fresh temp file →
   22 tables, head `20261027_01`).
4. `from app.main import app` imports the REAL backend; `uvicorn.Server`
   binds `127.0.0.1:8741`.
5. The UI polls `status()` and **only** after an explicit `ready` signal does
   it switch the API client to loopback. Any migration/import/startup error
   moves the state to `failed` with a short, human-visible traceback — a
   failed init is **never** reported as success and never falls back to any
   remote URL.

Database files (app-private storage, deleted by Android on uninstall):

```
/data/user/0/org.m3.surveillance/files/
    m3-local.db          the standalone database
    m3-local.db-wal      (SQLite side files)
    m3-local.db-shm
    migration/           extracted alembic scripts (uninstalled with the app)
```

Nothing is ever migrated in from the shared PostgreSQL database, from the
Docker volume, or from the Offline Demo store.

## 3. Which features run locally

Everything that lives behind the real HTTP API works over loopback, using the
real server-side validation and persistence:

| Role | Real flows available offline |
|---|---|
| Labour Worker | real signup/login, editable questionnaire drafts, all five sections with the real field/conditional validation, single-screening rule (RDT due), symptom reports |
| Contractor | site/workers lookup, roster, travel events, QR worker identification, role/site scoping enforced by the real dependencies |
| Pathologist | worker/case lookup, RDT/microscopy/SMP diagnostic paths, species & smear validation, follow-up slides |
| Clinician / MO | case acknowledgement, clinical assessments, treatment/follow-up/outcomes, permission checks |
| Health Worker | read-only surveillance views (real scope rules) |
| Research Lab | aggregate views (read-only; research-result writes return the real 403 guard) |
| Admin | dashboard/analytics and real audit-event review (`/audit-events`) |

Also working locally: server-side sessions (pre-restart tokens survive),
idempotent duplicate submission protection per `client_request_id` (detailed
http-level proof in `services/api/tests/test_standalone_lifecycle.py`),
notification rows, outbox replay **against the local server** (still the real
outbox algorithm; it never touches a remote host in this mode).

Not available locally (and honestly reported as such):

* Kafka event fan-out — disabled (`KAFKA_ENABLED=false`); the producer queues
  in-process and simply never drains.
* Anything requiring other network services beyond the tablet (none exist in
  the current backend beyond Kafka).

## 4. Administrator / bootstrap-account setup

* **Primary account-creation path is the real public signup endpoint**
  (`POST /api/v1/auth/signup`), which exists in the backend and performs real
  credential validation, argon2 (pwdlib) password hashing, real server-side
  role assignment and real JWT session issue. The sign-in screen's existing
  login/**signup** forms work unchanged against the loopback server.
* ⚠️ **Known, documented risk (unchanged backend behavior): the real signup
  endpoint accepts *any* role, including admin, for any caller.** In the
  shared deployment this is a genuine privilege-escalation issue tracked for
  the backend team. The standalone mode does *not* paper over it; testers
  should create the admin first, then everything else through real flows.
* The backend's `POST /api/v1/bootstrap/users` endpoint stays effectively
  unusable in standalone mode: `BOOTSTRAP_SECRET` is generated randomly at
  every server boot and never displayed, so no one can call it.
* There are **no hardcoded passwords, no master PINs, no demo token, no role
  quick-switch** in standalone mode. Invalid credentials fail exactly as they
  do on the remote server.

Suggested test-account flow on a fresh tablet:

1. Start local server (§2).
2. Sign-up (role select appears on the form) → **Admin** first.
3. Sign out; sign up/accounts for the other roles as needed; all seven roles
   are exercisable from the same device.

## 5. How to create and log in with real test accounts

1. Open the app → tap **Standalone Local Server → Start local server & use
   this tablet**. The card reports starting state (including migration
   progress/errors) and then "Local server is running".
2. Use the normal form: *Create an account* (signup) with phone + 4‑digit PIN
   + display name + role; the same form's Login tab for existing accounts.
3. `logout` on the dashboard performs a real `POST /auth/logout` (token
   revoked server-side) while the embedded server keeps running for account
   switching.
4. **Exit local mode** returns to the remote-server resolution chain (the
   saved URL re-activates untouched). **Stop local server** terminates
   uvicorn; committed data stays on disk; **Delete all local test data** (with
   a typed confirmation dialog; refused while the server is running) removes
   exactly the `m3-local.db*` files — never the remote server config, the
   online-mode caches, or anything outside `filesDir`.

## 6. Offline and lifecycle limitations (documented, honest)

* The embedded server runs in the app process. Killing the app process
  (swipe-away, force-stop, OOM-kill, tablet reboot) **stops the server**.
  Committed records are always safe (SQLite commits per request); the only
  loss possible is an in-flight request's response.
* On the next cold start, the sign-in card **auto-restarts** the server
  (local-mode flag is persisted in `cache_meta`), so the "safe lifecycle"
  behavior is: server up when the app is open; the app always gates all
  requests on the explicit readiness signal. When the server was stopped but
  not ready, screens show the actionable error and the start/retry button —
  the UI never fabricates an offline success, and the API client is switched
  to loopback **only** while the readiness signal is active.
* Airplane mode is fully supported (loopback never needs Wi-Fi, and the
  connectivity listener is bypassed in this mode).
* Do not expose the tablet's local server over USB/network debugging — the
  bind is loopback-only by design.

## 7. Mode differences

| Aspect | Standalone Local Server | Online (remote server) | Offline Demo (hidden) |
|---|---|---|---|
| Backend logic | real FastAPI, on-device | real FastAPI, remote | synthetic, in-app |
| Persistence | real SQLite in app-private storage | real server DB (Postgres) | device-only demo store |
| Network | loopback only, zero internet | LAN/public URL required | zero network |
| Authentication | real argon2+JWT accounts | same | demo identity, no auth |
| Records uploaded to server | never (nothing remote exists in-path) | yes | never |
| Synthetic data | none (fresh DB; testers create real records) | whatever the server holds | entirely synthetic, isolated |
| Redirect/switching behavior | exit restores saved remote URL; every other resolution untouched | n/a | restore gated by SHOW_DEMO_ENTRY |
| Process-death behavior | auto-restart on next boot; data survives | reconnect logic | n/a |

## 8. Security limitations

* Loopback-only by design, but the on-device API runs over plain HTTP between
  the app and the embedded server; TLS is intentionally absent because the
  traffic never crosses a network boundary.
* Logging is minimized (uvicorn `access_log=False`, no request bodies) but
  Android logcat may contain stack traces on failures.
* Uninstalling the application deletes the database (private-storage
  lifecycle). Keep that in mind for archival testing.
* The reset function is explicitly confirmed and surgical (only
  `m3-local.db*`); it cannot cascade into the online mode, the demo store or
  the remote server configuration.
* This deployment is **not** approved for production clinical or
  surveillance use; privacy, security, clinical and operational review is
  required before any such use.
* All synthetic test records are ones the tester creates through real
  workflows on a clean database — there is no preloaded synthetic content in
  standalone mode.

## 9. Acceptance gates (automated)

| Gate | Result |
|---|---|
| Backend suite (incl. real-API auth matrix, RBAC, idempotency) | **163 passed, 1 skip** |
| `tests/test_standalone_lifecycle.py` (real migrations + uvicorn subprocess, signup→login→questionnaire→403 role guard→**server stop/restart** persistence→session & duplicate protection across restart) | **2 passed** (new) |
| Mobile unit tests | **32/32** |
| Release-validation harness (`offline_demo.test.ts`, `outbox_flush.test.ts`) | **16/16** |
| Release-validation `standalone.test.ts` (no remote leak with a conflicting saved URL; restart persistence of the localMode flag; loopback strictness; online-chain regression) | **6/6** (new) |
| `scripts/verify_offline_cache.py` offline-cache spec | **17 PASS** (unchanged) |
| Mobile typecheck / lint | clean / clean (1 pre-existing unrelated warning) |
| Real alembic chain on a fresh SQLite file | 22 tables, head `20261027_01` |
| pydantic-core Android wheel import/ABI provenance | built from PyPI tag `v2.23.4` source against the Chaquopy target; SHA-256 above |
| **Physical tablet verification** | **PENDING — no device/AVD available; a release APK exists for authorized sideload testing (see §10)** |

## 10. Release APK

| Property | Value |
|---|---|
| Package | `org.m3.surveillance` |
| Version | `0.3.0-standalone` (versionCode 3) |
| Path | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Size | 65,677,005 bytes (~62.6 MiB) |
| SHA-256 | `7eea383f15c652cff06adaeee6a8ae7b922ad5ccf1985b8b0387b7ad17a1888b` |
| Signature | project debug keystore (`CN=Android Debug`, SHA-256 `fac61745dc09…033b9c`) — same signing scheme as the previous `0.2.0-demo` release; `apksigner verify` passes |
| ABIs | arm64-v8a (Chaquopy `android_24` target; minSdk 24, targetSdk 36) |
| Embedded runtime | CPython 3.12.15 (Chaquopy) + real FastAPI/uvicorn on `127.0.0.1:8741` |
| Verified APK contents | `assets/chaquopy/app.imy` (14 real backend modules + `m3_local_server`), `assets/chaquopy/requirements-common.imy` (1,148 pip entries incl. `pydantic_core/_pydantic_core.cpython-312.so`, argon2 `_ffi.so`, greenlet), `lib/arm64-v8a/libpython3.12.so`, 11 `assets/alembic_pack/` migration entries (`alembic.ini`, `env.py`, all 9 version scripts → head `20261027_01`) |

## 11. Files introduced/changed by this mode

Backend/test: `services/api/tests/test_standalone_lifecycle.py`.

Mobile: `android/app/m3-python/m3_local_server.py`,
`android/app/src/main/java/org/m3/surveillance/LocalServerModule.kt`,
`.../M3LocalServerPackage.kt` (+ registration in `MainApplication.kt`),
`android/app/build.gradle` + `android/build.gradle` (Chaquopy),
`android/app/m3-requirements.txt`, `android/app/m3-wheels/…whl`,
`src/localServer.ts`, `src/api.ts` (local-mode forcing), `src/store.ts`,
`src/i18n.ts`, `app/index.tsx` (hides demo + standalone card),
`app/dashboard.tsx`, `app/_layout.tsx`,
`scripts/release-validation/standalone.test.ts`, `docs/STANDALONE_LOCAL_SERVER.md`.
