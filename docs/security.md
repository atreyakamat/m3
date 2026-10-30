# Security & privacy

## Authentication

- Workers authenticate with phone + PIN; staff with username + password.
- **PINs and passwords are hashed with bcrypt** (`bcryptjs`) and never stored or
  logged in plain text. JWTs are signed with `JWT_SECRET` and expire
  (`JWT_EXPIRES_IN`, default 12h).
- Tokens on mobile are kept in Expo **SecureStore** (OS keystore), not plain
  storage.

## Authorization (RBAC)

- Every protected route is guarded by `JwtAuthGuard` + `RolesGuard` with explicit
  `@Roles(...)`. Least privilege: workers reach only their own `/me` data;
  diagnostics/prescriptions are writable only by CLINICIAN/PATHOLOGIST.
- The backend is the **sole authority** for transfer approvals: it derives the
  current/destination contractor from the site records, so a client cannot
  approve on behalf of an unrelated contractor (verified by test).
- Worker profile lookups by contractors expose **minimal** confirmation details
  (name, current site) — not full phone/records.

## Input validation & errors

- All request bodies validated against shared Zod schemas (`nestjs-zod`).
- A central exception filter returns a consistent shape and logs internal errors
  server-side only; it never leaks stack traces to clients.

## Data protection

- Sensitive worker/health data stays in application-private storage (SQLite on
  device; Postgres server-side). Diagnostic records are read-only to workers.
- Malaria status is derived only from authorized diagnostic records; symptom
  absence is never treated as negative.
- **Audit log** records sensitive events (registration, screening completion,
  diagnostics, transfer create/approve/reject/cancel/complete).
- PINs, tokens and health payloads are never written to logs.
- Secrets come from environment variables; `.env.example` is provided and `.env`
  is gitignored. Use HTTPS and strong secrets in any deployed environment.

## Assumptions & remaining approvals

- No compliance certifications are claimed.
- **Consent/ethics**: the consent step is a configurable placeholder — the exact
  approved consent/assent wording must be supplied before production use.
- **OTP / phone verification** and **account recovery** (forgotten PIN / changed
  number) are deferred product/security decisions.
- Database backups, key rotation and transport hardening are deployment-time
  concerns to be finalised for the target environment.
