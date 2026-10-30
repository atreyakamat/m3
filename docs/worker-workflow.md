# Worker workflow

The worker journey (mobile app and web portal), per `worker_architecture.md`.

1. **Language** — choose English / Hindi / Bengali / Marathi; saved locally and
   reused. Changeable later in Profile. (UI chrome is translated; questionnaire
   wording is kept in the approved source language — see open decisions.)
2. **Returning-worker check** — `GET /auth/exists` routes a known phone to sign-in.
3. **Register / sign in** — new worker: name + phone + PIN (PIN hashed with
   bcrypt, never stored or logged in plain text). A duplicate phone is rejected
   (409), so no duplicate worker record is created. A stable **Worker ID**
   (`M3-XXXXXX`) is generated and used as the internal key for all records.
4. **Construction-site selection** — drill down State → District → Taluka → Area,
   or search. The worker's record stores the **Site ID**, via a
   `WorkerSiteAssignment` (not a free-text name). Later changes go through Transfer.
5. **Initial screening (one-time)** — the approved questionnaire (Sections I–V)
   rendered dynamically from `packages/shared`. Drafts are saved and resumable.
   Marked COMPLETE only when required fields **and** consent are present (shared
   `evaluateScreeningCompleteness`). A completed screening cannot be re-opened or
   done twice.
6. **Dashboard** — profile, current site, **malaria status** chip, and quick
   actions. Malaria status is `NO_RESULT` / `AWAITING` / `POSITIVE` / `NEGATIVE`
   and is **never** inferred from symptoms.
7. **Profile** — registered info, Worker ID, phone, current site, screening
   summary. Cannot edit official diagnostic results.
8. **Feeling unwell** — tap-based symptom report (+ optional note). Saved with a
   timestamp; **not** a diagnosis and never changes malaria status. Works offline
   (queued in the outbox, idempotent).
9. **Malaria status & diagnostics** — view authorized RDT/microscopy results,
   species, dates. Read-only.
10. **Prescriptions** — **current opens by default**; separate History tab;
    records are append-only and linked to their episode.
11. **Follow-up check-ins** — respond with tap options + optional text; stored
    with timestamp and worker/episode linkage; not a diagnostic result.
12. **Transfer** — see `docs/site-transfer-workflow.md`.

## Offline availability

Available offline on mobile: language, viewing cached profile/records, drafting
screening, and submitting symptom reports (queued). Requiring connectivity:
registration/login, site master-data search, completing screening against the
server, and all transfer approvals (validated live by the backend). See
`docs/offline-sync.md`.
