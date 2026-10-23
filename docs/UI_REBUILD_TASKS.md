# M3 UI Rebuild — Phase Tracker (final)

Started 2026-10-22 after baseline commit `c9a34fd` ("eod changes 22 oct", clean tree).
All UI work remains **uncommitted**. Backend + shared DB untouched (verified below).

## Phase 0 — Audit ✅
- [x] Web audit: React 19 + Vite, 2,762-line `main.tsx` monolith, no router, no test gate.
- [x] Mobile audit: Expo 57 / RN 0.86 / expo-router, offline cache + outbox, 12 tests.
- [x] Roles/routes inventory (7 roles + legacy `pathology`), API shapes verified against `main.py`.
- [x] Questionnaire + validation inspection; git baseline clean.

## Phase 1 — Design system ✅
- [x] `src/ui/tokens.css` (brand teal `#0f766e` aligned to mobile, semantic statuses, spacing/radius/shadow/focus/type scales).
- [x] `src/ui/tokens.ts` (TS mirror, `toneForStatus`).
- [x] `src/ui/index.css` (component styles, responsive ≤720/≤1080).
- [x] `src/ui/components.tsx` (Button/IconButton/Field/Input/Select/TextArea/Toggle/SearchInput/ChipPicker/Card/PageHeader/Page/StatusBadge/Badge/Tabs/Section/DataTable/EmptyState/Skeleton/SkeletonTable/ErrorState/Banner/FormGrid/Metric/Identity/useFocusTrap/Modal/ConfirmDialog/ToastProvider+useToast).

## Phase 2 — App shell ✅
- [x] `src/app/AppShell.tsx`: M3 branding, role-aware nav, scope hints, honest API-connected badge (`/health` probe + `navigator.onLine`), session-expiry surface, responsive sidebar + scrim.
- [x] `lib/roles.ts` (single nav/role source, legacy `pathology` tolerated), `lib/session.tsx` (sessionStorage `m3-session` preserved; 401 → honest expiry banner), `lib/online.ts` (real connectivity), `api.ts` (same contract + `probeApi`, network-failure ⇒ ApiError(0)).

## Phase 3 — Seven role workspaces (web) ✅
- [x] Worker: honest landing (mobile-app redirect), own-scope dashboard.
- [x] Contractor: site workspace, roster pages (overview/cases/workers/sites, reports).
- [x] Pathologist (`pathology` tolerated): lab workspace — samples queue, slide follow-ups, worker drawer diagnostics tab, analytics.
- [x] Clinician: case queue + acknowledge, worker drawer (assessments/follow-ups modals), full nav.
- [x] Health Worker: read-only surveillance pages.
- [x] Research Lab: de-identified molecular results.
- [x] Admin: read-only console + audit trail with filters/paging.
- [x] `WorkerRecord` drawer (6 tabs + role-gated action toolbar + all six action CTAs re-attached to ported modals).
- [x] Monolith split: 12 `screens/*` files + thin `main.tsx`; `styles.css` deleted (git rm); `index.html` rewritten with doctype/head.

## Phase 4 — Contracts ✅
- [x] Endpoint paths/methods/payloads byte-identical (verified during port; status/ack/modal logic copied verbatim).
- [x] Limitations documented in `docs/UI_REBUILD_REPORT.md`.

## Phase 5 — Offline-first truth ✅ (mobile-centred)
- [x] Web: real `online`/`/health` badge; retry/error states; no fabricated queues (web is an online console — documented).
- [x] Mobile: shared outbox flusher `src/outbox.ts` (single-flight), flush-on-boot in `_layout.tsx`, truthful queued/synced/failed surfaces preserved.

## Phase 6 — Known defects ✅ (verified fixes)
- [x] Demo credentials mismatch — **root-caused**: this shared dev DB was seeded by an older run: PIN **1234** and a different phone→role map (…001 contractor, …003 clinician, …004 pathology, …005 worker, …006 health_worker, …007 research_lab, …008 admin) than repo `seed.py` (PIN 2468, …001 worker). Quick-fill updated to live-DB truth in both apps; divergence documented (DB left untouched per safety rules).
- [x] Static "API Connected" badge → real `/health`-probe badge (web).
- [x] `alert()` errors → toasts/banners (both apps) — zero `alert(` remains in web src.
- [x] Nested interactive rows (audit table `<tr onclick>` + mobile WorkerCard/ActionCard) — remediated.
- [x] Session degrading into role-less user → web 401 handler + expiry banner; mobile `markSessionExpired` banner (token preserved).
- [x] Malformed `index.html`, dead "Replay Outbox" button, duplicate Reports tab, un-trapped modals (focus trap + Esc now), draft-restore conflict (newer `updated_at` wins) — all fixed.
- [x] Fabricated offline data (mobile sites) → honest empty states.

## Phase 7 — Accessibility ✅
- [x] Focus-visible rings everywhere, focus traps + Esc in dialogs, aria labels/roles, tabular numerals, wrapping guards (`overflow-wrap`), scroll-safe regions, reduced-motion support, dot+colour status badges (not colour-alone).

## Phase 8 — Testing gates ✅
- [x] Backend: `pytest tests/ -q` (SQLite, disposable) → **161 passed, 1 skipped** (baseline unchanged; no backend diffs).
- [x] Mobile: `npx tsc --noEmit` OK · `npm test` **12/12** · lint 0 errors (1 pre-existing warning baseline).
- [x] Web: `npx tsc --noEmit` OK · `vite build` OK (303.6 kB JS / 87.9 kB gzip) · new `node --test tests/` gate **12/12** (roles/nav matrix incl. legacy `pathology`, status→tone fallbacks).
- [x] Role flows exercised against the real API via Playwright captures (per-role nav visible per server policy).

## Phase 9 — Visual acceptance ✅
- [x] Playwright captures → `screenshots/web-rebuild/` (44 files) + `screenshot-index.md` (role, screen, viewport, env = web).
- [x] APK rebuilt after mobile defect fixes (`apps/mobile/android`, arm64-v8a release) — see report for path/size; native-device verification pending.
- [x] Shared stack never restarted (33+ h uptime at finish); disposable test DB removed after runs.

## Phase 10 — Final safety ✅
- [x] No commit/push/deploy/reset/clean; no destructive ops; shared DB untouched (49 patients / 36 cases / 48 users).
- [x] All screenshots/`-fixtures` use seeded synthetic data only.
