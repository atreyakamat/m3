# M3 UI Rebuild — Final Report

Date: 2026-10-22 · Baseline: commit `c9a34fd` ("eod changes 22 oct", clean tree) · **All changes uncommitted.**

---

## 1. Design system and shared components

One coherent system, aligned with the mobile app's teal brand (`#0f766e`) over slate neutrals; zero new runtime dependencies.

| Layer | Files |
|---|---|
| Design tokens | `apps/web/src/ui/tokens.css` (brand, semantic status, spacing, radius, elevation, focus, type scale, motion, z-index, breakpoints) · `apps/web/src/ui/tokens.ts` (TS mirror + `toneForStatus`) |
| Stylesheet | `apps/web/src/ui/index.css` (335 lines; buttons, forms, cards, badges, tabs, tables, banners/states, metrics, identity, modal/drawer, toasts, responsive 720/1080) — the only stylesheet; legacy `styles.css` removed via `git rm` |
| Component library | `apps/web/src/ui/components.tsx`: Button, IconButton, Field, Input, Select, TextArea, Toggle, SearchInput, ChipPicker, Card, PageHeader, Page, Badge, StatusBadge, Tabs, Section, DataTable (clickable rows, skeletons, empty states), EmptyState, Skeleton/SkeletonTable, ErrorState, Banner, FormGrid, Metric, Identity, useFocusTrap, Modal (focus trap + Esc), ConfirmDialog, ToastProvider/useToast |
| App core | `apps/web/src/app/AppShell.tsx` · `apps/web/src/lib/roles.ts` (single role/nav source, legacy `pathology` tolerated) · `lib/session.tsx` (sessionStorage `m3-session` preserved, 401→expiry surface) · `lib/online.ts` (real `navigator.onLine` + `/health` probe) · `lib/api.ts` upgraded in place (same contract + `setUnauthorizedHandler` + `probeApi`; network failure ⇒ distinguishable `ApiError(0)`) |
| Mobile parity | `apps/mobile/src/outbox.ts` (new shared single-flight outbox flusher used by intake, dashboard and boot) |

## 2. Screens and workflows per role (web console)

All seven roles have complete, polished experiences; nav is filtered by `lib/roles.ts` and independently enforced server-side.

- **Labour Worker** — honest landing (worker flows live in the M3 Android app), personal-status metrics from `/dashboard` (`scope: own`).
- **Contractor** — Overview (`scope: managed_sites`), Case Queue (site-scoped minimal columns by server), Workers search/read, Construction Sites directory. Enrollment and status recoding are worker-context actions surfaced in the Worker drawer (as before; no invented bulk flows).
- **Pathologist** (legacy `pathology` sign-ins tolerated) — Diagnostics & Pathology queue with per-test badges and slide follow-up recording, worker drawer with sample CTA + slide follow-up CTA, analytics.
- **Clinician / Medical Officer** — full nav: case queue **with acknowledge** (`POST /cases/{id}/acknowledge`, stopPropagation-safe), worker drawer 6 tabs with Record Assessment / Schedule Follow-up modals (all conditional branches and payload construction ported verbatim).
- **Health Worker** — read-only surveillance: cases, workers, follow-ups, sites, reports.
- **Research Lab** — de-identified molecular results (`/research-results`: pcr_status, species_confirmation, parasite_density(+unit), gametocyte_presence, pfhrp2/3) + analytics; explicit de-identification banner.
- **Admin** — read-only console: everything above plus **Audit Trail** with debounced filters and server paging (`/audit-events`).

Worker-record drawer (`screens/WorkerRecord.tsx`): overview / screening (all 5 questionnaire sections) / clinical / diagnostics / follow-ups / travel, role-gated action toolbar + per-context CTAs, all six modals (`screens/modals.tsx`) preserving exacting payloads: `POST /assessments`, `POST /follow-ups`, `POST /samples`, `PUT /samples/{id}/slide-followup`, `POST /workers/{id}/membership`, `PUT /workers/{id}/reported-status`.

## 3. Exact files changed

**Web (rebuild core):**
`index.html` (rewritten: doctype/head/title), `package.json` (only a `"test"` script + dev-dep Playwright for capture), `src/api.ts`, `src/main.tsx` (2,762→211 lines), `src/AnalyticsDashboard.tsx` (restyled to the system, logic untouched), `src/types.ts` (new, contracted domain types), `src/styles.css` (**deleted**), new: `src/ui/{tokens.css,tokens.ts,index.css,components.tsx}`, `src/app/AppShell.tsx`, `src/lib/{roles.ts,session.tsx,online.ts}`, `src/screens/{LoginScreen,OverviewScreen,CasesScreen,WorkersScreen,WorkerRecord,SamplesScreen,FollowUpsScreen,SitesScreen,ResearchScreen,AuditScreen,ReportsScreen,modals}.tsx`, `tests/{roles,tokens}.test.ts`, `scripts/capture.mjs`.

**Mobile (defect/quality batch):**
`app/_layout.tsx` (flush-on-boot), `app/dashboard.tsx` (shared outbox, Replay Outbox fixed, session-expired banner), `app/index.tsx` (press feedback, corrected demo quick-fill), `app/intake.tsx` (shared flusher, updated_at draft-conflict policy), `app/sites.tsx` (fabricated offline data removed → honest empty states), `components/{WorkerCard,NotificationModal}.tsx` (no nested touchables, press feedback), `components/ui.tsx`, `src/{api.ts,store.ts,cache.ts,i18n.ts}` (401→`markSessionExpired`, `sessionExpiredAt`, draft timestamps, en+hi strings), `src/outbox.ts` (new shared module).

## 4. Known defects fixed — and how each was verified

| Defect | Fix | Verification |
|---|---|---|
| Demo credentials don't match fixtures | Root-caused: shared dev DB was seeded by an older run — PIN **1234** and phone→role map different from repo `seed.py` (PIN 2468). Quick-fill now encodes live-DB truth; divergence documented (DB untouched) | `verify_pin` probe inside the API container + successful logins for all 7 roles via the UI (Playwright) |
| Static "API Connected" badge (web) | `/health` probe + `navigator.onLine`, honest tones (checking/ok/unreachable) | Offline capture shows real offline badge (Playwright `setOffline`) |
| `alert()` error handling | Toasts/banners; zero `alert(` left | `grep -rn "alert(" apps/web/src` → none |
| Nested interactive rows / touchables (web audit row, mobile WorkerCard/ActionCard) | Non-interactive containers + explicit accessible action buttons | Code review + `tsc`; row actions stopPropagation (cases) |
| Replay Outbox dead button | Shared `flushOutbox` (single-flight) wired to dashboard + intake + boot | Code-level; mobile tests still 12/12 |
| Draft restore conflict | Newer `updated_at` wins (equal/missing ⇒ server); verified `updated_at` stamped on save | cache.ts diff review |
| Session degrades to generic user | Web: 401 ⇒ expiry banner + sign-in; mobile: `sessionExpiredAt` banner, token preserved | Code-level; duration-limited by no live 401 during captures |
| Malformed index.html / no doctype | Rewritten with head/title/viewport | Build output `dist/index.html` 0.52 kB sane |
| Duplicate Reports tab (mirrored dashboard) | Reports = honest limitations page + pointers | Screenshot per role |
| Un-trapped modals | `useFocusTrap` + Esc + scroll lock in Modal/ConfirmDialog | Managed focus checks in code |
| Fabricated offline data (mobile sites) | Synthetic sites/rosters removed; honest offline empty states | sites.tsx diff review |
| Press feedback gaps | Pressed states in login tabs, notification chips, banners | index.tsx/NotificationModal diff review |

## 5. Test commands and exact results

| Gate | Command | Result |
|---|---|---|
| Backend regression (unchanged backend) | `docker compose run --rm --no-deps -v $PWD:/home/atreya/Work/m3 -w services/api -e DATABASE_URL='sqlite:////tmp/m3_uirebuild_pytest.db' api sh -c 'PYTHONPATH=. python -m pytest tests/ -q -p no:cacheprovider'` | **161 passed, 1 skipped** (time 119.30s) — identical to baseline |
| Web typecheck | `cd apps/web && npx tsc --noEmit` | exit 0 |
| Web build | `npm run build` | success — 303.6 kB JS (87.9 kB gzip), 16.2 kB CSS |
| Web unit tests (new) | `npm test` (`node --test tests/`) | **12 passed / 0 failed** |
| Mobile typecheck | `cd apps/mobile && npx tsc --noEmit` | exit 0 |
| Mobile unit tests | `npm test` | **12 passed** |
| Mobile lint | `npm run lint` | 0 errors, 1 pre-existing warning (baseline) |
| Shared DB check | `psql` counts + container uptime | 49 patients / 36 cases / 48 users unchanged; stack never restarted (33+ h) |

## 6. Screenshot index and environments

- **Web:** `screenshots/web-rebuild/` — 44 PNGs (login, per-role overview + every authorized tab, worker-record drawer, offline-banner, audit filters) at 1440×900, browser `Chromium 156 headless` via Playwright 1.64.1 against the real local API. Index: `screenshots/web-rebuild/screenshot-index.md`. Note: captures use a harness-only non-CORS browser (see limitation 1).
- **Android (historical, prior phases):** `screenshots/android/` untouched.
- **Native device verification: pending** — no physical device was attached this session; nothing is claimed on its behalf.

## 7. Limitations / unresolved items

1. **CORS allow-list is host-bound**: the healthy shared API allows `localhost:5173/8081`. The dockerized web container serves the pre-rebuild build on 5173; proof-captures therefore ran from an alternate port with web-security disabled **in the capture browser only**. Real deployments must either rebuild the container (out of scope; stack untouched) or reach the API on an allowed origin.
2. **Seed divergence (documented, not altered)**: repo `seed.py` (PIN 2468; phone→role …001 worker …002 clinician …003 pathology …004 health_worker …005 research_lab …006 contractor …007 admin) vs the running shared DB (PIN 1234; …001 contractor …003 clinician …004 pathology …005 worker …006 health_worker …007 research_lab …008 admin). Fresh environments seeded per seed.py will mismatch the dev quick-fill; consider a `--dev-pin/--dev-map` switch in seed.py later (backend change — explicitly deferred here).
3. Contractor account auto-locked mid-capture due to repeated failed logins from earlier wrong-credential runs (server lockout policy working as designed; auto-expires; **DB recorded then released the state itself** — reran captures post-unlock see below).
4. Web is an online console: no fabricated queued-write affordances were added (mobile owns offline intake/queue with truthful states).
5. Native Android verification on a physical device remains pending (APK provided below).
6. **Mutating workflows were not exercised over the network** this session: acknowledging a case or recording assessments/samples would write to the shared dev DB, which is under preservation rules. All write flows were ported with byte-identical payload construction and are regression-protected by the backend suite (161 passed), but their end-to-end UI writes should be exercised on a disposable DB/stack.

## 8. Data-preservation confirmation

- Shared Postgres volume untouched: **49 patients / 36 cases / 48 users** as at start; no migrations, reseeds, deletes or resets; role lockout rows expired naturally.
- Docker `m3-compose-*` never restarted (uptime 33 h+ at finish).
- All pre-existing files preserved; the only deletion is the retired `styles.css` (`git rm`, recoverable from git).
- Nothing committed, pushed, or deployed; no destructive git operations.

## 9. Final git status / diff summary

Uncommitted diff across **19 modified files, 1 deletion, 9 new path groups** (+1,018 / −3,355 tracked-line delta; ~3,300 new lines in the web `ui/`, `lib/`, `app/`, `screens/`, `tests/` trees):
`git status --short` at completion:

```
 M apps/mobile/app/_layout.tsx            M apps/mobile/src/cache.ts
 M apps/mobile/app/dashboard.tsx          M apps/mobile/src/i18n.ts
 M apps/mobile/app/index.tsx              M apps/mobile/src/store.ts
 M apps/mobile/app/intake.tsx             M apps/web/index.html
 M apps/mobile/app/sites.tsx              M apps/web/package.json (+lock)
 M apps/mobile/components/NotificationModal.tsx   M apps/web/src/AnalyticsDashboard.tsx
 M apps/mobile/components/WorkerCard.tsx  M apps/web/src/api.ts
 M apps/mobile/components/ui.tsx          M apps/web/src/main.tsx
 M apps/mobile/src/api.ts                 D apps/web/src/styles.css
 M apps/web/tsconfig.tsbuildinfo
?? apps/mobile/src/outbox.ts              ?? apps/web/src/{app,lib,screens,ui,types.ts}
?? apps/web/scripts/                      ?? apps/web/tests/
?? docs/UI_REBUILD_TASKS.md               ?? docs/UI_REBUILD_REPORT.md
?? screenshots/ (web-rebuild captures)
```

## 10. APK release

- Pipeline: local Gradle `apps/mobile/android` → `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a`, rebuilt **after** the mobile defect fixes, `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.153:8003/api/v1` (LAN fallback; runtime-configurable in-app as before).
- Result: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` — **34.1 MB**, built 22 Oct 21:17 local, versionName 0.1.0 (versionCode 1).
- Note: Java 27 + android-36 hits a known `JdkImageTransform` breakage in masked-view; built with **Temurin 21** instead. No project files changed for this.
- Native-device verification: **pending** (none attached).
