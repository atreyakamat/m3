# Offline-first architecture (mobile)

The Expo worker app keeps supported functions usable without connectivity.

## Local storage

- **Expo SQLite + Drizzle ORM** (`apps/mobile/src/db`). Tables: `screening_draft`,
  `symptom_report`, `follow_up_response`, and a generic `outbox`. DDL is created
  idempotently on first launch so the app works offline from the start.
- Per-viewer convenience state (JWT, language) uses Expo SecureStore (token) and
  AsyncStorage (language/user), each wrapped in try/catch.

## Sync-state visibility

Every local record carries an explicit sync state — `LOCAL`, `PENDING`,
`SYNCED`, `FAILED` — surfaced with colour-coded chips (shared
`syncStateColors`). A local-only record is **never** shown as server-confirmed.
The dashboard shows a pending-sync indicator and an offline banner.

## Outbox + retry + idempotency

- Eligible mutations are enqueued in the `outbox` with a client-generated
  **idempotency key**.
- `runSync(token)` drains the outbox, POSTing each payload with its stored key,
  so a retried request never duplicates a record server-side (the backend
  `IdempotencyKey` table enforces this for symptom reports).
- Transient network failures leave items `PENDING`; hard failures mark `FAILED`
  and re-queue up to a max attempt count.

## What is available offline vs online

| Available offline | Requires connectivity |
| --- | --- |
| Language selection; view cached profile/records | Registration / login |
| Draft the initial screening | Site master-data search |
| Submit a symptom report (queued) | Completing screening on the server |
| | **All transfer approvals** |

## Conflict rules

Blind last-write-wins is **not** used for initial screening, diagnostic results,
prescriptions or transfers:

- **Initial screening** — one per worker; a server-COMPLETE screening is
  authoritative and the client will not overwrite it (409 on draft/complete).
- **Diagnostic results / prescriptions** — worker-side is read-only and
  append-only server-side; the client never mutates them.
- **Site transfers** — approvals are validated **live** by the backend inside a
  locked transaction. A transfer is never completed from a queued offline action,
  so the outbox explicitly excludes transfer approvals.
- **Symptom reports / follow-up responses** — safe to queue; deduplicated by
  idempotency key.
