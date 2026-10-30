# Site-transfer workflow

Implements the confirmed rules in `worker_architecture.md` §17. The state
machine is a single pure module (`packages/shared/src/logic/transfer.ts`) used
by the API (authoritative) and the clients (display). The API resolves the
current/destination contractor from the authoritative site records — a client
can never approve on behalf of an unrelated contractor.

## Approval matrix

| Initiated by | Worker | Current (from-site) contractor | Destination (to-site) contractor | Completes when |
| --- | --- | --- | --- | --- |
| **Worker** | pre-approved (they submitted) | must approve | must approve | both contractors approve |
| **Contractor** (the destination contractor) | must accept | must approve | pre-approved (they initiated) | worker accepts **and** current contractor approves |

## Statuses

`PENDING_WORKER_RESPONSE`, `PENDING_CURRENT_CONTRACTOR`,
`PENDING_DESTINATION_CONTRACTOR`, `ACCEPTED` (completed), `REJECTED`,
`CANCELLED`. The status is derived from the three decision slots
(`worker`, `fromContractor`, `toContractor`) by `computeTransferStatus`.

- Worker-initiated: `PENDING_CURRENT_CONTRACTOR` → `PENDING_DESTINATION_CONTRACTOR` → `ACCEPTED`.
- Contractor-initiated: `PENDING_WORKER_RESPONSE` → `PENDING_CURRENT_CONTRACTOR` → `ACCEPTED`.
- Any required rejection → `REJECTED`. Initiator cancel while open → `CANCELLED`.
- Sequencing: for a contractor-initiated request the current contractor can only
  act **after** the worker accepts (`canActorDecide`).

## Rules enforced

- **One pending request per worker** — checked in the create transaction and
  backed by the `uq_open_transfer_per_worker` partial unique index.
- A pending / rejected / cancelled request **never** changes the active site.
- On completion the previous assignment is closed (`active=false`, `endedAt`) and
  a new active assignment is created — the full history is retained.
- Every request and decision (who + when) is recorded, plus an `AuditLog` entry.

## Concurrency safety

Each decision runs in one interactive transaction that locks the transfer row
with `SELECT … FOR UPDATE`, recomputes status from freshly-committed state, and —
if it is the decision that completes the transfer — performs the assignment
switch in the same transaction. Two contractors approving simultaneously
therefore serialise: exactly one completion occurs, and the
`uq_active_assignment_per_worker` index is the final backstop against duplicate
active assignments. This path is covered by an e2e concurrency test.
