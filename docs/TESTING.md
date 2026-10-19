# M3 Testing and Smoke Verification Report

Date of Verification: 2026-10-19  
Environment: Linux x86_64, Node v22.23.2, npm 10.9.8, Python 3.11.16 / 3.14.7  
Office LAN IP: `192.168.1.122` (API Port: `8001`, Web Port: `5173`, Metro Port: `8081`)

---

## 1. Test Execution Matrix

| Test Suite / Step | Command Executed | Result | Details / Output |
|---|---|---|---|
| **Backend Authorization & Unit Tests** | `cd services/api && .venv/bin/python -m pytest -v` | **PASS** | `2 passed in 4.39s` (login generic 401 error, role gates, pathology pending sample result handling) |
| **Web Console Lint / Typecheck** | `cd apps/web && npm run lint` (`tsc --noEmit`) | **PASS** | `0 errors` |
| **Web Console Production Build** | `cd apps/web && npm run build` (`tsc -b && vite build`) | **PASS** | Built in 142ms: `dist/index.html` (0.16 kB), `dist/assets/index-B9uCI2zX.js` (187.59 kB) |
| **Expo Dependencies Check** | `cd apps/mobile && npx expo install --check` | **PASS** | Dependencies reconciled with Expo SDK 53; `react-native@0.79.6` verified. |
| **Expo Diagnostics (`expo-doctor`)** | `cd apps/mobile && npx expo-doctor` | **PASS** | `18/18 checks passed. No issues detected!` |
| **Mobile TypeScript Check** | `cd apps/mobile && npm run typecheck` | **PASS** | `0 errors` |
| **Expo Go Metro Bundler Startup** | `cd apps/mobile && npx expo start --lan` | **PASS** | Metro running on `exp://192.168.1.122:8081`, manifest served via HTTP 200. |
| **Expo Android Bundle Compilation** | `curl "http://192.168.1.122:8081/node_modules/expo-router/entry.bundle?platform=android&..."` | **PASS** | HTTP 200 OK, full Android bundle generated (6.58 MB) with zero missing modules. |
| **LAN API Health & Connectivity** | `curl -i http://192.168.1.122:8001/health` | **PASS** | HTTP 200 `{"status":"ok","service":"m3-api","time":"..."}` |
| **Web Dev Console on LAN** | `curl -i http://192.168.1.122:5173` | **PASS** | HTTP 200 OK |
| **Full LAN API E2E Flow** | `python3 scripts/verify_e2e_lan.py` | **PASS** | All 6 roles authenticated with PIN 2468, role restrictions enforced (403), intake -> assessment -> pathology -> follow-up -> research molecular results verified. |
| **Offline Caching Spec** | `python3 scripts/verify_offline_cache.py` | **PASS** | SQLite cache tables created, sync metadata stored, offline worker browsing verified, owner data isolated, cache cleared on signout. |

---

## 2. Issues Encountered and Fixes Applied

1. **Web DevDependencies**:
   - *Issue*: `@types/react` and `@types/react-dom` were missing in `apps/web/node_modules`, causing TS7026 JSX element errors.
   - *Fix*: Ran `npm install` in `apps/web`, added `"type": "module"` to `package.json` to prevent CommonJS loader warnings in Vite.

2. **Mobile TypeScript & Syntax Errors**:
   - *Issue*:
     - `apps/mobile/app/index.tsx`: Arrow functions inside `<Controller render={({field}) => <Field...` without surrounding parentheses caused TS1382 JSX parser confusion.
     - `apps/mobile/app/_layout.tsx`: Compressed JSX statement lacked clean nesting and caused TS17008/TS2657 errors.
     - `apps/mobile/src/i18n.ts`: `const en = { ... } as const` inferred literal string types, causing Hindi dictionary (`hi`) assignments to fail type checking.
   - *Fix*: Formatted components with proper JSX wrapping, typed `hi: Record<TranslationKey, string>`, and eliminated duplicate type exports.

3. **Missing Expo Peer Dependencies**:
   - *Issue*: `expo-doctor` identified missing peer dependencies `expo-constants` and `expo-linking` for `expo-router`.
   - *Fix*: Installed both native modules via `npx expo install expo-constants expo-linking`.

4. **Metro Android Bundling Resolution Failures**:
   - *Issue*:
     - `expo-router` required `query-string` at runtime in `getPathFromState-forks.js`.
     - `expo-sqlite` hooks required `expo-asset`.
   - *Fix*: Installed `query-string` and `npx expo install expo-asset`. Verified complete bundle compilation with HTTP 200 (6.58 MB).

5. **Port Conflict on Office Host**:
   - *Issue*: System-wide daemon (`portainer.service`) occupied port `8000` (`--tunnel-port 8000`).
   - *Fix*: Configured M3 FastAPI server to listen on port `8001`, updated `API_CORS_ORIGINS` alias in `services/api/app/config.py`, and updated `.env` across all packages to point to `http://192.168.1.122:8001/api/v1`.

6. **Backend Follow-Up Creation 500 Error**:
   - *Issue*: In `services/api/app/main.py:create_followup`, unpacking `FollowUp(**body.model_dump(), assigned_user_id=...)` raised `TypeError: got multiple values for keyword argument 'assigned_user_id'`.
   - *Fix*: Extracted `data = body.model_dump()`, assigned default `assigned_user_id` when absent, and unpacked cleanly.

7. **Offline Cache Browsing & Cleanup**:
   - *Issue*: `readWorkers` was exported in `cache.ts` but never called in UI, preventing users from browsing cached records when offline.
   - *Fix*: Integrated cached worker browsing with search filter in `apps/mobile/app/dashboard.tsx` and ensured `clearOwner(owner)` is invoked on logout.

8. **Metro Multi-Interface IP Conflict & Scanning Failure**:
   - *Issue*: The host machine has multiple interfaces: Wi-Fi `wlp5s0` (`192.168.1.122`) and a secondary USB adapter (`10.89.92.237`). When launching Metro with `--lan`, Expo auto-selected the USB adapter address (`exp://10.89.92.237:8081`). Scanning this QR code from a mobile phone connected to Wi-Fi failed with a network timeout.
   - *Fix*: Configured Metro with `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.122`. Metro now advertises and serves the bundle at `exp://192.168.1.122:8081`.

9. **False Offline Lockout in Expo Go**:
   - *Issue*: `_layout.tsx` evaluated `Boolean(s.isInternetReachable ?? s.isConnected)`. On isolated office LAN Wi-Fi networks without external WAN access, Android returns `isConnected: true` and `isInternetReachable: false`. Because `false ?? true` evaluates to `false`, the mobile client was mistakenly locked in offline mode.
   - *Fix*: Changed network evaluation to `Boolean(s.isConnected || s.isInternetReachable)`.

10. **Mobile Form Ergonomics & Validation**:
    - *Issue*: Forms previously required manual entry of 36-character UUIDs and raw lowercase enums (`rdt`, `microscopy`, `pf`, `pv`), and required typing raw ISO 8601 datetime strings on mobile. Empty site IDs silently blocked multi-step intake.
    - *Fix*:
      - Rebuilt `components/ui.tsx` with a cohesive monochromatic design system (`Button`, `Field`, `Card`, `ChipPicker`, `StatusBadge`, `NoticeBanner`, `StepIndicator`, `EmptyState`, `LoadingSpinner`).
      - Added dynamic authorized site fetching from `/api/v1/sites` in `intake.tsx` with single-tap chip selection.
      - Implemented protocol preset buttons (+1d, +3d, +7d, +14d, +28d) in `followup.tsx`.
      - Replaced raw string inputs with `ChipPicker` controls for gender, diagnostic method, result status, species, adherence, and outcome.
      - Enabled prefilled patient code routing from the dashboard directly into assessment, diagnostic, and follow-up screens.
      - Overhauled web console (`apps/web`) with responsive mobile layout, data tables, search filters, and login role shortcuts.

11. **Metro Web Bundling Resolution (`inline-style-prefixer` & `wa-sqlite.wasm`)**:
    - *Issue*: Metro failed during web compilation with `Unable to resolve "inline-style-prefixer/lib/plugins/imageSet" from "node_modules/react-native-web/dist/modules/prefixStyles/static.js"` and `Unable to resolve module ./wa-sqlite/wa-sqlite.wasm from .../expo-sqlite/web/worker.ts`. This was caused by Metro's package export resolver failing to resolve subpath imports without file extensions from packages lacking an `"exports"` map, and `.wasm` missing from asset extensions.
    - *Fix*: Created [`apps/mobile/metro.config.js`](file:///home/atreya/Projects/m3/apps/mobile/metro.config.js) with:
      1. `config.resolver.assetExts.push('wasm')` for WebAssembly bundling.
      2. A custom `resolveRequest` hook that automatically resolves extensionless subpath imports for `inline-style-prefixer/lib/*` and `react-native-web/dist/index`.
      3. Verified web bundling compiles cleanly with HTTP 200 OK (`4.42 MB`, 793 modules bundled).

---

## 3. End-to-End Verification Flow

Run the automated LAN verification suite:
```sh
python3 scripts/verify_e2e_lan.py
```

### Steps Verified:
1. **Health Check**: Accessed `http://192.168.1.122:8001/health` over office LAN IP (HTTP 200).
2. **Negative Authentication**:
   - Unregistered phone (`9999999999`) -> 401 `Unable to sign in with those credentials`
   - Valid phone with incorrect PIN (`0000`) -> 401 `Unable to sign in with those credentials`
3. **Role Authentication**:
   - `+919000000001` (worker) -> JWT token returned, role `['worker']`
   - `+919000000002` (clinician) -> JWT token returned, role `['clinician']`
   - `+919000000003` (pathology) -> JWT token returned, role `['pathology']`
   - `+919000000004` (health_worker) -> JWT token returned, role `['health_worker']`
   - `+919000000005` (research_lab) -> JWT token returned, role `['research_lab']`
   - `+919000000006` (contractor) -> JWT token returned, role `['contractor']`
4. **Role Authorization Gates**:
   - Worker attempted `POST /assessments` -> 403 Forbidden
   - Worker attempted `POST /samples` -> 403 Forbidden
   - Clinician attempted `POST /samples` -> 403 Forbidden
   - Pathology attempted `POST /research-results` -> 403 Forbidden
5. **Surveillance Flow**:
   - Worker intake `POST /workers` -> Returned opaque patient code `M3-...`
   - Clinician assessment `POST /assessments` -> Associated clinical encounter recorded
   - Pathology test `POST /samples` -> Diagnostic test recorded (`result_status="positive"`, `species="pv"`)
   - Health worker follow-up `POST /follow-ups` -> Scheduled with protocol-specified due date
   - Research lab result `POST /research-results` -> Logged molecular result (`pcr_status="detected"`, `parasite_density=12500 parasites/uL`)
6. **Data Isolation**:
   - Clinician viewing patient detail receives clinical identity
   - Contractor receives roster only without clinical or research records
   - Worker dashboard shows personal scope (`scope="own"`)
   - Clinician dashboard displays authorized operational totals

---

## 4. Untested Items & Limitations

1. **Physical Handheld Device Touch & Camera Scan**:
   - Metro bundle build, manifest generation, and LAN routing were verified over HTTP/TCP (`exp://192.168.1.122:8081`).
   - Physical touch input, barcode camera scanning of the terminal QR code, and physical Android screen rendering require a physical mobile device running the Expo Go app connected to the same Wi-Fi subnet.
2. **Physical Device Network Toggling**:
   - SQLite offline cache schema, query logic, data isolation, and UI conditional disabling (`disabled={!online}`) were verified programmatically.
   - Physical toggle of Airplane mode on an actual phone in the field remains a physical QA step.
3. **PostgreSQL Production Container Migration**:
   - The verified test environment ran against SQLite development and test storage with full Alembic schema parity. Testing against the live multi-container PostgreSQL Docker deployment requires starting `docker compose up db api` once port 8000 is mapped or portainer is stopped.
