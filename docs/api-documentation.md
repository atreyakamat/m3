# API documentation

Base URL: `/api/v1`. Interactive OpenAPI/Swagger UI at **`/api/docs`**
(machine-readable JSON at `/api/docs-json`). All non-public routes require a
`Authorization: Bearer <jwt>` header; roles are enforced server-side.

## Auth

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/auth/exists?phone=` | public | returning-worker routing |
| POST | `/auth/worker/register` | public | `{name,phone,pin,preferredLanguage}`; 409 if phone exists (no duplicate) |
| POST | `/auth/worker/login` | public | `{phone,pin}` |
| POST | `/auth/staff/login` | public | `{username,password}` |

Responses carry `{ token, user }` where `user = {userId, role, workerId, contractorId, displayName}` (`workerId` is the human `workerCode`).

## Workers

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/workers/me` | WORKER | profile, current site, **derived malaria status**, counts |
| POST | `/workers/me/site` | WORKER | first-time site selection `{siteId}` |
| GET | `/workers/lookup/:workerCode` | CONTRACTOR | minimal confirmation details |

## Sites

| GET | `/sites/locations?level=&parentId=` | any auth | hierarchy drill-down |
| GET | `/sites?search=&areaId=&page=&pageSize=` | any auth | paginated search |
| GET | `/sites/:siteCode` | any auth | site details |

## Screening (WORKER)

| GET | `/screening/me` · PUT `/screening/me/draft` · POST `/screening/me/complete` |
Completing validates required fields + consent via the shared rule; a second
completion returns 409; a completed screening cannot revert to draft.

## Records

| GET | `/records/me/episodes` · `/records/me/diagnostics` | WORKER | read-only |
| GET | `/records/me/prescriptions/current` · `/records/me/prescriptions/history` | WORKER | current by default; history append-only |
| GET | `/records/me/follow-ups` · POST `/records/me/follow-ups/respond` | WORKER | |
| POST | `/records/me/symptom-reports` | WORKER | idempotent via `idempotencyKey` |
| POST | `/records/episodes` | CLINICIAN, HEALTH_WORKER | open an episode |
| POST | `/records/diagnostics` | CLINICIAN, PATHOLOGIST | **only** authorized roles set diagnostic status |
| POST | `/records/prescriptions` | CLINICIAN | append-only |

Workers can never create diagnostic results (403).

## Transfers

| POST | `/transfers/worker` | WORKER | create worker-initiated |
| GET | `/transfers/me` | WORKER | my requests + history |
| POST | `/transfers/:id/worker/accept` · `/worker/reject` | WORKER | respond to contractor-initiated |
| POST | `/transfers/contractor` | CONTRACTOR | initiate into a site they manage |
| GET | `/transfers/approvals` | CONTRACTOR | requests awaiting this contractor |
| POST | `/transfers/:id/contractor/approve` · `/contractor/reject` | CONTRACTOR | backend resolves current-vs-destination slot |
| POST | `/transfers/:id/cancel` | WORKER/CONTRACTOR | initiator only |

See `docs/site-transfer-workflow.md` for the state machine.

## Stakeholders

| GET | `/stakeholders/dashboard` | any auth | `{role,label,implemented,message}` — placeholder for non-implemented roles, no fabricated data |
| GET | `/stakeholders/contractor/sites` | CONTRACTOR | sites managed + active worker counts |

## Meta

| GET | `/meta/health` | public | liveness |
| GET | `/meta/questionnaire` | public | versioned worker-screening definition |

## Conventions

- HTTP status codes: 200/201 success, 400 validation, 401 unauthenticated,
  403 forbidden, 404 not found, 409 conflict (duplicate/one-pending/closed).
- List endpoints paginate with `page`/`pageSize` → `{items,page,pageSize,total,totalPages}`.
- Error body: `{statusCode, error, message, ...details, timestamp}`.
