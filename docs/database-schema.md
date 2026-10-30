# Database schema (PostgreSQL / Prisma)

Source of truth: `apps/api/prisma/schema.prisma`. Migrations in
`apps/api/prisma/migrations`. All primary keys are UUIDs.

## Entities

| Model | Purpose | Key relations |
| --- | --- | --- |
| `User` | Auth principal. One role; workers have `pinHash`+`phone`, staff have `username`+`passwordHash`. | → `Worker` (1:1, optional), → `Contractor` (1:1, optional) |
| `Worker` | Stable worker identity. `workerCode` = human-facing Worker ID (e.g. `M3-7F3K9A`); `id` = internal key. | has many assignments, episodes, prescriptions, reports, follow-ups, transfers; 1:1 screening |
| `Contractor` | Contracting company; owns sites. | has many `ConstructionSite` |
| `LocationNode` | Self-referential location tree: `STATE → DISTRICT → TALUKA → AREA`. | `parent`/`children` |
| `ConstructionSite` | Site master data. `siteCode` unique; linked to an `AREA` node and a contractor. | → `LocationNode`, → `Contractor` |
| `WorkerSiteAssignment` | Current + historical worker↔site membership with `active`, `startedAt`, `endedAt`. | → `Worker`, → `ConstructionSite` |
| `InitialScreening` | One-time baseline (unique per worker). `status` DRAFT/COMPLETE, `answers` JSON, `consentGiven`, `version`. | → `Worker` (unique) |
| `MalariaEpisode` | A suspected/confirmed episode. | → `Worker`; has diagnostics + prescriptions |
| `DiagnosticResult` | Authorized RDT/microscopy result (species, testDate). | → `MalariaEpisode` |
| `Prescription` | Append-only prescription linked to an episode (never overwritten). | → `MalariaEpisode`, → `Worker` |
| `SymptomReport` | Worker "feeling unwell" report (not a diagnosis). | → `Worker`, optional episode |
| `FollowUp` | Check-in question + worker response. | → `Worker`, optional episode |
| `SiteTransferRequest` | Transfer request with per-party decisions, status, timestamps, effective date. | → `Worker`, → from/to `ConstructionSite` |
| `IdempotencyKey` | Dedup for retry-safe creates (`@@unique([scope, key])`). | — |
| `AuditLog` | Audit events for sensitive changes. | — |

## Enums

`Role`, `Language (en/hi/bn/mr)`, `ScreeningStatus`, `EpisodeStatus`,
`TestType (RDT/MICROSCOPY)`, `DiagnosticResultValue`, `PlasmodiumSpecies`,
`LocationLevel`, `TransferInitiator`, `TransferStatus`, `Decision`. These mirror
`packages/shared/src/enums.ts` exactly.

## Integrity constraints

- **Foreign keys** across all relations; indexes on hot lookup columns.
- **Partial unique indexes** (migration `..._partial_unique_indexes`):
  - `uq_active_assignment_per_worker` — at most **one active** `WorkerSiteAssignment` per worker.
  - `uq_open_transfer_per_worker` — at most **one non-terminal** `SiteTransferRequest` per worker (the "one pending request" rule).
- `Worker.phone`, `Worker.workerCode`, `ConstructionSite.siteCode`,
  `User.username`, `User.phone` are unique → prevents duplicate worker records.
- Multi-step operations (transfer completion) run inside DB transactions with a
  `SELECT … FOR UPDATE` row lock on the transfer (see site-transfer doc).

## Migration commands

```bash
cd apps/api
npx prisma migrate dev       # create + apply (development)
npx prisma migrate deploy    # apply committed migrations (CI/prod/containers)
npx prisma generate          # regenerate client
npm run db:seed              # dev/demo seed data
```
