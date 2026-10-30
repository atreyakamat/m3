# Architecture

## Overview

The M3 platform is a monorepo with one backend and two frontends that share a
single source of truth for types, validation, questionnaire content, design
tokens, and business rules.

```
                ┌───────────────────────────┐
                │      packages/shared       │
                │  enums · Zod schemas ·     │
                │  questionnaire · tokens ·  │
                │  transfer/screening/status │
                │  business logic            │
                └───────────┬───────────────┘
                 imported by every app
   ┌───────────────┬────────┴───────────┬───────────────┐
   │ apps/api      │ apps/web           │ apps/mobile    │
   │ NestJS REST   │ React + Vite       │ Expo RN (OFF-  │
   │ Prisma + PG   │ worker + contractor│ line-first     │
   │ JWT + RBAC    │ + placeholders     │ worker app)    │
   └──────┬────────┴────────────────────┴───────┬────────┘
          │ REST (/api/v1)                       │ REST + local SQLite outbox
          ▼                                      ▼
     PostgreSQL                             Expo SQLite (Drizzle)
```

## Backend (apps/api)

NestJS 10 with a modular, layered structure. Controllers are thin; business
logic lives in services (and in `@m3/shared` for rules shared with the clients).

```
src/
  auth/        JWT strategy, guards, worker register/login, staff login
  workers/     worker profile, Worker-ID lookup, initial site selection
  sites/       location hierarchy, site search, site master data
  screening/   initial-screening draft/complete (one per worker)
  records/     episodes, diagnostics, prescriptions, symptom reports, follow-ups
  transfers/   the site-transfer workflow (state machine + transactional completion)
  stakeholders/ placeholder dashboards + contractor's own-sites listing
  meta/        health + questionnaire definition
  common/      RBAC guard, audit, idempotency, pagination, exception filter
  prisma/      PrismaService (global)
```

Cross-cutting:
- **Validation**: `nestjs-zod` wraps the shared Zod schemas as DTOs (also feeds Swagger).
- **AuthZ**: `JwtAuthGuard` + `RolesGuard` (`@Roles(...)`). The backend is the
  sole authority — e.g. it resolves the current/destination contractor from the
  site records; a client can never approve on behalf of an unrelated contractor.
- **Errors**: a global `AllExceptionsFilter` returns a consistent JSON shape and
  preserves structured details (e.g. `missingFieldIds`) without leaking internals.
- **API versioning**: URI versioning, everything under `/api/v1`.
- **OpenAPI**: served at `/api/docs` (JSON at `/api/docs-json`), 36 paths.

## Web (apps/web)

React + Vite + react-router. Role-guarded routes; worker portal mirrors the
mobile journey, contractor portal provides the transfer workspace, and the
other five roles get role-coloured placeholder dashboards. Styling is driven
entirely by the shared design tokens.

## Mobile (apps/mobile)

Expo (SDK 52) + Expo Router + TypeScript, **offline-first**. Standalone project
(its own `node_modules`) to isolate the React Native dependency tree; it
consumes `@m3/shared` from source via a Babel/Metro/TS alias. See
`docs/offline-sync.md`.

## Shared (packages/shared)

Compiled to `dist` (CJS + d.ts). Holds `roles`, `enums`, the versioned
`questionnaire` (transcribed from the approved doc), `design/tokens`, Zod
`schemas/*`, and pure `logic/*` (transfer state machine, screening completeness,
malaria-status derivation) — each unit-tested with vitest.
