# Offline Tablet Demo Mode — Install & Run Guide

Offline Demo Mode lets a reviewer install the M3 Malaria Surveillance app as a
release APK on an Android tablet and explore **all seven role interfaces, the
questionnaire/diagnostic validation logic, and local record creation** — with
**no server, no laptop, no network, and no risk to real data**.

Everything the demo shows is deterministic **synthetic data** built into the
app. Every synthetic identity is unambiguously labelled, and no demo action is
ever sent to any server.

---

## 1. Safety boundary (what demo mode guarantees)

| Guarantee | How it is enforced |
| --- | --- |
| Clearly labelled | Persistent orange banner "Offline Demo — Synthetic Data Only" on every demo screen; every demo record carries `demo_saved_locally` status and a synthetic label (`M3-SYN-*`, `Synthetic …`) |
| No real authentication | Demo sessions are constructed **without a token** (`token: undefined`), so no real API request can ever be authorized. Entering demo never contacts a server. |
| Isolated storage | Native: a **separate SQLite file `m3-demo.db`** (the real store uses `m3-cache.db`, tables `cached_workers` / `local_drafts` / `outbox` / `cache_meta`). Web/tests: `m3demo:`-prefixed keys, never the real `m3:*` keys. |
| No real database writes | Demo writes route only to the demo store; there is no code path from a demo screen into the real outbox, drafts, or worker cache (proven by the network/store mock harness — see below). |
| No demo entries in the real outbox | `saveDemoRecord` / `saveDemoDraft` never call `enqueueOutbox`; the real outbox remains empty and untouched during a demo session. |
| No auto-upload when connectivity returns | `flushOutbox` is a **hard no-op in demo mode** (`demo` opt and empty real outbox); demo records cannot enter the replay path. |
| No merging with real records | Demo data lives in a separate namespace; demo identity (`synthetic-demo`) is distinct from any real account id; reset wipes only the demo namespace. |
| No reuse of real tokens | A real session token is never read or copied by demo code; demo role-switching is demo-only and grants **zero** real server privileges. |

**Isolation evidence (automated):** `scripts/release-validation/offline_demo.test.ts`
(8 scenarios) and `apps/mobile/src/demo.test.ts` (7 tests) run the real demo
code against a counting network transport plus real-store spies, and prove:
zero API calls during demo init/bootstrap of all seven roles; demo writes with
0 calls to `enqueueOutbox`/`saveDraft`; connectivity return with a token
present replays nothing; mode switching never merges queues, drafts or
identities; demo `reset` leaves real `m3:*` keys intact; the existing online
flush path still passes.

---

## 2. Install the release APK

> APK build details (path / version / size / SHA-256) are recorded in
> `docs/RELEASE_VALIDATION_REPORT.md`. Verify the checksum after copying to
> the tablet:

```bash
sha256sum apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

On the tablet: enable "Install unknown apps" for your file manager / browser if
needed, open the APK, tap **Install**. The app is the release build (`org.m3.surveillance`).
**No Metro/dev server, no Expo Go, no network is required** — the APK opens
directly to the sign-in/server-config screen.

## 3. Enter and exit demo mode

1. Open the app. On the sign-in / server-configuration screen find the
   amber-bordered card **“Offline Demo”** with the current counts of existing
   demo records, drafts and activity.
2. Tap it and choose one of the **seven demo roles** (see below), then **Enter
   demo**. This is fully local: no connection attempt is made.
3. The dashboard then clearly displays: a demo banner, a "server switched
   off" notice, and demo-disabled outbox/API controls.

**To exit:** press **Sign out** inside the demo — this ends the demo session
locally only (no API call, no token removal, no data wipe) and returns to the
sign-in screen. Real session storage is never touched.

**To reset demo data entirely:** in the dashboard’s *Demo work* inspector
card tap **Reset demo data** and confirm. That wipes drafts, records,
activity and the demo session marker — and nothing else (real outbox,
drafts, cached workers, server config and tokens are untouched).

## 4. The seven demo roles

| Demo role | What you can explore offline |
| --- | --- |
| **Worker** | Browse synthetic demos/users list, the questionnaire flow (with drafts), synthetic "my cases", symptom report entry |
| **Contractor** | Synthetic roster and site browsing (writes are demo-disabled) |
| **Pathologist** | Diagnostic sample form with in-form validation, synthetic example samples, slide follow-up entry |
| **Clinician / Medical officer** | Assessment form (synthetic facilities), case queue with details, follow-up assignment (demo-local) |
| **Health worker** | Case queue, follow-up/monitoring examples, symptom queue browsing |
| **Research lab** | Read-only synthetic research aggregates |
| **Admin** | Synthetic audit timeline, system metrics, queue overviews (actions demo-disabled) |

You can **switch demo role at any time** from the dashboard (explicit demo
role-switcher) — this is demo-only and never changes real permissions.

## 5. What works offline vs what needs a real server

| Works fully offline in demo | Requires the real online app (disabled in demo) |
| --- | --- |
| All seven role dashboards with synthetic data | Any real sign-in / token authentication |
| Questionnaire intake with full conditional validation (same rules as the live app) | Actual creation of worker records / questionnaire submissions on the server |
| Diagnostic sample form + slide follow-up validation | Real laboratory result upload |
| Symptom reports, assessments, follow-up assignment | Real case assignment / status changes |
| Reading / restoring / deleting local demo drafts | Real PostgreSQL persistence |
| Completed demo records saved locally (with timestamps, `demo_saved_locally`) | Outbox replay, sync, real-time data |
| Demo work inspector, activity history, reset | Research-lab real data access |

Local actions explicitly say when work is **demo-only** ("stored on this
device only, never sent to any server"); drafts carry local `updated_at`
timestamps and completed demo submissions are recorded separately with
`created_at` and a local reference.

## 6. Data scope and persistence

- Demo drafts, records and activity persist **across app restarts** on the
  device (separate SQLite DB on Android / localStorage keys in tests).
- Demo drafts are keyed by demo owner; completed demo submissions are
  separate from drafts and show as `demo_saved_locally`.
- Demo records are capped (200 records / 100 activity entries) so storage
  stays small.
- Nothing is ever uploaded: there is no idempotency key, no outbox entry and
  no replay for demo work, so returning connectivity (Wi-Fi, hotspot, laptop
  tethering) **cannot** pull demo data to a server.

## 7. Questionnaire & diagnostic validation coverage

The demo runs the **same conditional validation rules as the live app** — the
rules were extracted verbatim from production code into
`src/questionnaireValidation.ts` and `src/diagnosticValidation.ts`, so both the
live intake UI and this offline demo share one source of truth. In demo you can
check: DOB/age fallback, ID-type conditionals, fever/symptom → duration chains,
outside-Goa travel conditionals, planned-travel episode rules, short mobile
rejection; and diagnostic rules (positive → species required, species "other"
→ note, microscopy/smp → smear type, method "other" → note, slide follow-up
reason rules). Invalid submissions are rejected inline with the same messages
as production.

## 8. Reset

Two levels:

1. **Reset demo data** (Dashboard → Demo work → Reset demo data): wipe all
   synthetic drafts/records/activity and any persisted demo role.
2. Re-enter demo at the sign-in screen any time afterwards; the demo seed
   data (workers, sites, cases, etc.) is regenerated deterministically every
   session.

## 9. Verification status

- Automated: mobile unit tests (32 ✔, incl. validation + demo-store),
  release-validation isolation harness (8 ✔), backend/web suites and the
  offline-cache spec (17 ✔) all pass — see `docs/RELEASE_VALIDATION_REPORT.md`.
- Manual: physical-tablet walkthrough is **pending** — perform steps 2–4 on
  the target device before the field review.
