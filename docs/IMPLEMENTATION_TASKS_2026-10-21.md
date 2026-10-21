# Implementation Record — M3 Tasks 1-7 (2026-10-21)

All seven tasks from `TodoPlan.md` are implemented, verified against the live
stack (docker compose on port 8003), and the backend test suite passes
(120/122; the 2 remaining failures are pre-existing path-layout assumptions of
`test_worker_identity.py`/`test_deployment_gate.py`/`test_shared_contract.py`
when run inside the flat container image, unrelated to these changes).

## Task 1 — Dynamic server URL + tunnels
- `apps/mobile/src/api.ts`: base URL resolution order = stored custom URL
  (cache_meta, sync on all platforms) → `EXPO_PUBLIC_API_BASE_URL` → platform
  default. `normalizeServerUrl()` accepts `192.168.1.116:8003`,
  `http://…` or tunnel URLs; `/api/v1` is appended when missing.
  `probeServerUrl()` performs the health check with a 6 s timeout.
- `apps/mobile/src/store.ts`: `customServerUrl` + `setCustomServerUrl`.
- `apps/mobile/app/index.tsx`: “Server Configuration” dialog on the sign-in
  screen — input field, **Test Connection** (reports HTTP 200 / failure),
  **Save server** (survives restarts, no rebuild), **Use default server**.
- `scripts/tunnel.sh`: launches `cloudflared tunnel --url http://localhost:8003`
  or `ngrok http 8003` (installs instructions when neither is present).

## Task 2 — APK < 25 MB
- `apps/mobile/eas.json`: `preview`/`production` now set
  `gradleCommand: ":app:assembleRelease -PreactNativeArchitectures=arm64-v8a"`.
- Expo 57 implements the classic Gradle toggles via `android/gradle.properties`
  (the generated `app/build.gradle` reads them): single ABI
  (`reactNativeArchitectures=arm64-v8a` — the `enableSeparateBuildPerCPUArchitecture`
  equivalent) plus R8/ProGuard + resource shrinking
  (`android.enableMinifyInReleaseBuilds=true`,
  `android.enableShrinkResourcesInReleaseBuilds=true` — the
  `enableProguardInReleaseBuilds` equivalent).
- `npx expo prebuild --platform android` was run; the native project is now
  versioned (`.gitignore` exception added). `scripts/build-apk.sh` regenerates
  and re-applies the flags after any fresh prebuild.

## Task 3 — Hindi + interactive tour
- `apps/mobile/src/i18n.ts`: every new key has a full Hindi translation
  (screening rule, tour steps, worker cards, notifications, server config).
- `apps/mobile/components/TourModal.tsx`: 4-step modal — आपकी भूमिका /
  मज़दूर खोज और एकल जांच / जांच और लैब परीक्षण / ऑफलाइन सिंक सुविधा, with
  आगे / पीछे / समाप्त + Skip. Auto-opens when `m3_tour_completed` is absent
  from storage; **Start Tour (टूर शुरू करें)** button in the dashboard footer.

## Task 4 — Worker search + cards + bottom sheet
- `apps/mobile/components/WorkerCard.tsx`: large name, phone, home state,
  screened/pending badge, **View Record** + per-role quick action.
- `apps/mobile/components/WorkerDetailModal.tsx`: bottom sheet, tabs
  Profile / Screening / Lab Tests / Treatment; sections the role cannot read
  answer with a restriction notice.
- `apps/mobile/app/dashboard.tsx`: filter matches `display_name`,
  `phone_e164`, `nativity`, `occupation` (+ code).
- Server: `patient_view` exposes `nativity`, `screening_completed`,
  `screened_at`; `GET /workers?q=` now matches name, nativity and phone for
  health workers (verified: q=Bihar, q=Ramesh, q=43299 all return the worker).

## Task 5 — Single-screening governance
- `services/api/app/models.py`: `Patient.screening_completed` (+ `screened_at`),
  `ClinicalAssessment.re_screening_reason`; migration
  `20261026_01_screening_completion` (applied to the live DB).
- `POST /api/v1/workers`: 409 duplicate-intake messages distinguish
  “already completed screening”.
- `POST /api/v1/assessments`: the first encounter is clinician-only; a
  re-screen on an already-screened worker requires (a) role
  `clinician`/`health_worker` and (b) a recorded `re_screening_reason`
  (422 without it). Health workers may only re-screen within their assigned
  follow-up scope (platform access model, all preserved by tests).
- Mobile: screened workers show a locked label “जांच पूर्ण / Screening
  Completed + date”; clinicians see **Re-screen**, contractors see nothing.
- Verified live: 409 duplicate, 201 first screen, 422 reasonless re-screen,
  201 clinician re-screen, 201 health-worker re-screen.

## Task 6 — Medical color system
- `apps/mobile/components/ui.tsx`: Teal `#0f766e` primary, Sky `#0284c7`
  accent, Slate `#f8fafc`/`#ffffff`/`#e2e8f0` surfaces, semantic `#e11d48`
  (severe), `#d97706` (pending), `#059669` (cleared). Buttons: radius 12 +
  larger padding. Sign-in screen re-skinned light; stack header teal with
  white tint.

## Task 7 — Kafka + notification bell
- `docker-compose.yml`: `kafka` service (apache/kafka:3.7.0, KRaft, single
  node; internal listener `kafka:29092`, host `localhost:9092`, healthcheck via
  `kafka-topics.sh`). API env: `KAFKA_ENABLED=true`,
  `KAFKA_BOOTSTRAP_SERVERS=kafka:29092`.
- `services/api/app/kafka_producer.py`: in-process queue drained by a
  background task into topic `malaria.events` (best-effort; API writes never
  fail on a Kafka outage). Events: `intake.created`, `screening.completed`,
  `screening.rescreened`, `symptom_report.created`, `diagnostic.positive`.
- Positive test result also persists a `diagnostic_positive` notification for
  clinicians (case-linked or standalone).
- `apps/mobile/components/NotificationBell.tsx` (badge poll every 30 s) is
  mounted in the Stack header right (`_layout.tsx`) and in the dashboard top
  bar; `NotificationModal.tsx` displays the inbox with All/Unread/Urgent
  filters and tap-to-mark-read.
- Verified live: positive RDT → HTTP 201 → events `intake.created` and
  `diagnostic.positive` consumed from `malaria.events` → clinician `unread: 2`.

## Run / verify
```bash
docker compose up -d --build          # db + kafka + api + web + mobile-web
./scripts/tunnel.sh                   # public tunnel to :8003
./scripts/build-apk.sh                # size-optimized arm64-v8a APK
```
Then in the app: sign-in → **Server Configuration** → paste tunnel URL or LAN
IP → **Test Connection** → HTTP 200 → Save.
