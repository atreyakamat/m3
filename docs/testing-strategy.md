# Testing strategy

Development followed a test-driven approach: the shared business rules and the
backend workflows were specified as tests, then implemented until green.

## Where tests live

| Package | Runner | What | Count |
| --- | --- | --- | --- |
| `packages/shared` | vitest | pure business logic: transfer state machine, screening completeness, malaria-status derivation | 24 |
| `apps/api` (unit) | jest | RBAC guard | 4 (within 31) |
| `apps/api` (e2e) | jest + supertest (real Postgres `m3_test`) | auth/identity, screening, records, transfers, authorization | 27 (within 31) |
| `apps/web` | vitest + Testing Library | status chip, questionnaire renderer, login validation | 7 |
| `apps/mobile` | jest-expo + RN Testing Library | i18n parity, status chips, questionnaire renderer (incl. `showIf`) | 8 |

**Total: 70 passing.**

## Running

```bash
npm run test:shared
npm run test:api     # requires Postgres; migrates m3_test automatically (globalSetup)
npm run test:web
cd apps/mobile && npm test
```

The API e2e harness (`apps/api/test/setup`) boots the real Nest app, applies
migrations to `m3_test`, and truncates all tables between tests for isolation.
No production data is used.

## Coverage of the acceptance-critical cases

- **Success + failure + boundary**: registration validation, wrong PIN, missing
  required screening fields, consent gate.
- **Identity**: new registration, duplicate-phone rejection (no duplicate record),
  returning-worker recognition.
- **Screening**: draft save/resume, complete-once, no revert-to-draft.
- **Transfers**: worker-initiated (both approvals), contractor-initiated (worker +
  current contractor, no extra destination approval), rejection, cancellation,
  one-pending rule, **concurrent approvals** (single active assignment),
  unrelated-contractor rejection.
- **Authorization**: unauthenticated 401, worker→contractor-endpoint 403,
  placeholder-role→worker-endpoint 403, worker cannot create diagnostics.
- **Records**: malaria status stays `NO_RESULT` after a symptom report and only
  becomes `POSITIVE` from an authorized diagnostic; current-vs-history
  prescriptions; symptom-report idempotency.
- **Offline (mobile)**: sync service maps outbox entities to endpoints and
  carries idempotency keys (transfer approvals are deliberately excluded).

## Not automated here

Full device/emulator runs of the Expo app and a browser E2E of the web portal
require a UI runtime not available in CI here; the mobile app is verified by
typecheck + component tests, and the web portal by typecheck + component tests +
production build.
