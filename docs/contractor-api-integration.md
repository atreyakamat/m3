# M3 Malaria Surveillance Platform — Contractor API Integration Specification

This document provides the authoritative API contract specification for the Contractor Mobile Module in the M3 Malaria Surveillance Platform.

---

## 1. API Contract Inventory

| Feature | HTTP Method | Endpoint | Authentication & Guard | Request Body | Query Parameters | Response Structure | Error Handling | Mobile Screen |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Authentication (Login)** | `POST` | `/api/v1/auth/login` | None | `{"phone": string, "pin": string}` | None | `{"token": string, "user": AuthUser}` | `400 Bad Request`, `401 Unauthorized` (Invalid credentials), `403 Forbidden` (Deactivated account) | [`sign-in.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/sign-in.tsx) |
| **First-Login Credential Change** | `POST` | `/api/v1/auth/change-credential` | Bearer Token (allows pending) | `{"newCredential": string, "confirmCredential": string}` | None | `{"token": string, "user": AuthUser}` | `400 Bad Request` (Mismatch or strength), `401 Unauthorized` | [`first-login.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/first-login.tsx) |
| **Contractor Profile & Assigned Sites** | `GET` | `/api/v1/contractor/profile` | Bearer Token, Role: `CONTRACTOR` | None | None | `{"contractorId": string, "name": string, "phone": string, "active": boolean, "createdAt": string, "assignedSites": Array<ContractorSiteSummary>}` | `401 Unauthorized`, `403 Forbidden` | [`(contractor)/profile.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/profile.tsx), [`dashboard.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/dashboard.tsx) |
| **Assigned Sites (Stakeholders Compatibility)** | `GET` | `/api/v1/stakeholders/contractor/sites` | Bearer Token, Role: `CONTRACTOR` | None | None | `Array<ContractorSiteSummary>` | `401 Unauthorized`, `403 Forbidden` | Backward compatibility |
| **Site Worker Statistics** | `GET` | `/api/v1/contractor/sites/:siteCode/stats` | Bearer Token, Role: `CONTRACTOR`, Site Guard | None | None | `{"siteCode": string, "siteName": string, "totalWorkers": number, "positive": number, "negative": number, "awaitingResults": number, "noResultRecorded": number, "lastUpdated": string}` | `401 Unauthorized`, `403 Forbidden` (Unassigned site), `404 Not Found` | [`(contractor)/workers.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/workers.tsx) |
| **Site Workers List** | `GET` | `/api/v1/contractor/sites/:siteCode/workers` | Bearer Token, Role: `CONTRACTOR`, Site Guard | None | `search?: string`, `q?: string`, `malaria?: "ALL" \| "POSITIVE" \| "NEGATIVE"`, `page?: number`, `pageSize?: number` | `{"items": Array<ContractorWorkerRow>, "total": number, "page": number, "pageSize": number, "totalPages": number}` | `401 Unauthorized`, `403 Forbidden` (Unassigned site), `404 Not Found` | [`(contractor)/workers.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/workers.tsx) |
| **Individual Worker Detail** | `GET` | `/api/v1/contractor/workers/:workerCode` | Bearer Token, Role: `CONTRACTOR`, Managed Worker Guard | None | None | `{"workerId": string, "patientId": string, "name": string, "phone": string, "age": number \| null, "gender": string \| null, "currentSite": {"siteId": string, "name": string}, "malariaStatus": "POSITIVE" \| "NEGATIVE" \| null}` | `401 Unauthorized`, `403 Forbidden` (Worker not at contractor site), `404 Not Found` | [`(contractor)/worker-detail.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/worker-detail.tsx) |
| **Site Join Requests** | `GET` | `/api/v1/contractor/sites/:siteCode/join-requests` | Bearer Token, Role: `CONTRACTOR`, Site Guard | None | `status?: string` | `{"items": Array<ContractorJoinRequest>, "total": number}` | `401 Unauthorized`, `403 Forbidden` (Unassigned site) | [`(contractor)/requests.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/requests.tsx) |
| **Decide Join Request** | `POST` | `/api/v1/join-requests/:id/decide` | Bearer Token, Role: `CONTRACTOR`, Site Guard | `{"approve": boolean}` | None | `{"joinRequestId": string, "status": "ACCEPTED" \| "DECLINED"}` | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (Not site contractor), `409 Conflict` (Already decided) | [`(contractor)/requests.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/requests.tsx) |
| **Site Transfers** | `GET` | `/api/v1/contractor/sites/:siteCode/transfers` | Bearer Token, Role: `CONTRACTOR`, Site Guard | None | `status?: string` | `{"items": Array<ContractorTransferRow>, "total": number}` | `401 Unauthorized`, `403 Forbidden` (Unassigned site) | [`(contractor)/requests.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/requests.tsx) |
| **Initiate Contractor Transfer** | `POST` | `/api/v1/transfers/contractor` | Bearer Token, Role: `CONTRACTOR`, Destination Site Guard | `{"workerId": string, "toSiteId": string, "reason"?: string}` | None | `{"id": string, "status": "PENDING"}` | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (Destination not owned), `404 Not Found` | [`(contractor)/initiate-transfer.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/initiate-transfer.tsx) |
| **Approve Transfer** | `POST` | `/api/v1/transfers/:id/contractor/approve` | Bearer Token, Role: `CONTRACTOR`, Relevant Contractor Guard | `{"reason"?: string}` | None | `{"id": string, "status": string}` | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict` | [`(contractor)/requests.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/requests.tsx) |
| **Reject Transfer** | `POST` | `/api/v1/transfers/:id/contractor/reject` | Bearer Token, Role: `CONTRACTOR`, Relevant Contractor Guard | `{"reason": string}` | None | `{"id": string, "status": string}` | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict` | [`(contractor)/requests.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/requests.tsx) |
| **Site Travels & 7-Day Alerts** | `GET` | `/api/v1/contractor/sites/:siteCode/travels` | Bearer Token, Role: `CONTRACTOR`, Site Guard | None | None | `{"items": Array<ContractorTravelRow>, "total": number}` | `401 Unauthorized`, `403 Forbidden` (Unassigned site) | [`(contractor)/travels.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/travels.tsx) |
| **Global 7-Day Positive Travel Alerts** | `GET` | `/api/v1/travel/alerts/my-sites` | Bearer Token, Role: `CONTRACTOR` | None | None | `Array<TravelAlertItem>` | `401 Unauthorized`, `403 Forbidden` | [`(contractor)/travels.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/travels.tsx) |
| **Submit Positive Travel Report** | `POST` | `/api/v1/travel/reports` | Bearer Token, Role: `CONTRACTOR`, Site Guard | `{"workerId": string, "travelRecordId": string, "comment": string}` | None | `{"id": string, "travelRecordId": string, "status": "OPEN"}` | `400 Bad Request` (Missing comment or non-positive worker), `403 Forbidden`, `404 Not Found`, `409 Conflict` (Duplicate report) | [`(contractor)/travel-report-form.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/travel-report-form.tsx) |
| **Worker Travel Cancellation** | `POST` | `/api/v1/travel/my-record/cancel` | Bearer Token, Role: `WORKER` | `{"travelRecordId": string, "reason"?: string}` | None | `{"travelRecordId": string, "status": "CANCELLED", "reportPreserved": boolean}` | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict` | [`travel.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(tabs)/travel.tsx) |
| **Contractor Notifications** | `GET` | `/api/v1/contractor/notifications` | Bearer Token, Role: `CONTRACTOR` | None | `unreadOnly?: boolean` | `{"items": Array<NotificationItem>, "unread": number}` | `401 Unauthorized`, `403 Forbidden` | [`(contractor)/notifications.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/notifications.tsx) |
| **Acknowledge Notification** | `POST` | `/api/v1/contractor/notifications/:id/ack` | Bearer Token, Role: `CONTRACTOR` | `{}` | None | `{"id": string, "read": true}` | `401 Unauthorized`, `404 Not Found` | [`(contractor)/notifications.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)/notifications.tsx) |

---

## 2. Invariant and Privacy Guarding Rules

1. **Role Guarding**:
   - All Contractor endpoints are protected by `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('CONTRACTOR')`.
   - Pending credential tokens (`mustChangeCredential: true`) are blocked from all domain endpoints with `403 Forbidden`. Only `/auth/change-credential` is permitted.

2. **Site Ownership Guarding**:
   - Access to `/contractor/sites/:siteCode/*` validates site assignment via `validateContractorSite`. Attempting to access another contractor's site throws `ForbiddenException` (`403 Forbidden`).
   - Access to `/contractor/workers/:workerCode` verifies that the worker is actively assigned to a site managed by the requesting contractor. Attempting to query workers from other contractors' sites throws `ForbiddenException`.

3. **Individual Worker Malaria Status Visibility**:
   - For an individual worker (in Worker List, Worker Details, and Travel List), `malariaStatus` is strictly restricted to `'POSITIVE'`, `'NEGATIVE'`, or `null`.
   - `AWAITING` and `NO_RESULT` statuses are **never** exposed for individual workers. They return `null` (undisclosed).
   - Incomplete or pending statuses are never converted into Negative.
   - Aggregate site statistics (`/contractor/sites/:siteCode/stats`) accurately preserve all categories (`totalWorkers`, `positive`, `negative`, `awaitingResults`, `noResultRecorded`).
   - Contractors cannot filter workers by `AWAITING` or `NO_RESULT` (such queries return 0 items to prevent leaking undisclosed statuses).

4. **Zero Clinical Information Leakage**:
   - Contractor endpoints **never** expose Government ID numbers (e.g. Aadhaar), permanent addresses, screening questionnaire responses, malaria species, full prescriptions, or clinical notes.

5. **Seven-Day Travel Alert Window & Dynamic Updates**:
   - Triggers when departure date is within 7 days (`>= now && <= now + 7 days`), travel record is not cancelled, and worker has an authorised `POSITIVE` diagnostic result.
   - Updates dynamically as laboratory test results are recorded by clinicians:
     - Worker starts negative -> alert is inactive.
     - Worker tests positive -> alert becomes active.
     - Worker resolves/tests negative -> alert deactivates.
   - Cancelled travels are excluded from upcoming alerts.
   - If travel is cancelled after a travel report was submitted:
     - The report is preserved in the database (`status: 'OPEN'`).
     - A cancellation notification is dispatched to `ADMIN`, `CLINICIAN`, and `RESEARCH_LAB`.

6. **Travel Report Submission & Notifications**:
   - Mandatory comment enforced: empty or whitespace-only comments are rejected with `400 Bad Request`.
   - Reports apply only to verified `POSITIVE` cases. Attempts to file reports for negative workers are rejected with `400 Bad Request`.
   - Deduplication: exactly one report per travel record; duplicate submissions return `409 Conflict`.
   - Notification fan-out: submitting a report creates exactly 1 notification each for `ADMIN`, `CLINICIAN`, and `RESEARCH_LAB` with deduplication keys.
