# M3 Malaria Surveillance Platform

A malaria surveillance platform for migrant construction workers in Goa. This
repository is a monorepo containing a **complete Worker/Labourer experience**
plus the **Contractor transfer functions**, a tested backend, and placeholder
dashboards for the other stakeholder roles.

> **v2 rebuild.** This is a from-scratch rebuild (NestJS + Prisma backend, Expo
> mobile, React web). The previous stack is archived on the `local-backup` and
> `origin/redundant-v1` branches.

## What is implemented

| Role | Status |
| --- | --- |
| **Worker / Labourer** | ✅ Complete — mobile app + web portal + backend |
| **Contractor** | ✅ Transfer functions only (lookup, initiate, approve/reject) |
| Health Worker, Clinician, Pathologist, Research Lab, Admin | 🔸 Placeholder dashboards (no fabricated data) |

The **mobile app** is the Worker-facing, offline-first application (per
`worker_architecture.md`). The **web portal** mirrors the worker journey and adds
the contractor transfer workspace and the role placeholders.

## Monorepo layout

```
apps/
  api/      NestJS + Prisma REST API (PostgreSQL)   — npm workspace
  web/      React + Vite portal                     — npm workspace
  mobile/   Expo React Native worker app (offline)  — standalone (own node_modules)
packages/
  shared/   types, Zod schemas, questionnaire, design tokens, business logic — npm workspace
docs/       architecture, schema, API, workflows, testing, offline, security, status
docker-compose.yml
```

Business rules that must never diverge (transfer state machine, screening
completeness, malaria-status derivation) live **once** in `packages/shared` and
are consumed by the API, web and mobile.

## Quick start (Docker — recommended)

```bash
cp .env.example .env            # adjust secrets for anything beyond local dev
docker compose up -d --build    # starts postgres, api (migrates+seeds), web
```

- API:       http://localhost:8003/api/v1  (Swagger: http://localhost:8003/api/docs)
- Web portal: http://localhost:5174
- Postgres:  localhost:5544

Seeded demo logins (dev only): worker **phone `9000000001` / PIN `1234`**;
staff `contractor.north`, `contractor.south`, `clinician`, `pathologist`,
`healthworker`, `researchlab`, `admin` — all password **`password123`**.

## Local development (without Docker)

Prerequisites: Node 20+, a PostgreSQL instance.

```bash
npm install                                   # installs shared + api + web workspaces
npm run build:shared                          # build the shared package once
# set DATABASE_URL (see .env.example), then:
npm --workspace @m3/api run prisma:migrate:dev
npm --workspace @m3/api run db:seed
npm run dev:api                               # API on :8003
npm run dev:web                               # web on :5173

# Mobile (standalone — its own install)
cd apps/mobile && npm install --legacy-peer-deps
npx expo start                                # then press 'a' for Android
```

## Tests

```bash
npm run test:shared                 # 24 unit tests (pure business logic)
npm run test:api                    # 31 unit + integration tests (needs Postgres)
npm run test:web                    # 7 component tests
cd apps/mobile && npm test          # 8 component/i18n tests
```

See `docs/testing-strategy.md`. The API integration tests use a dedicated
`m3_test` database.

## Documentation

| Doc | Contents |
| --- | --- |
| [architecture](docs/architecture.md) | system design, module layout |
| [database-schema](docs/database-schema.md) | entities, relations, constraints |
| [api-documentation](docs/api-documentation.md) | endpoints + OpenAPI |
| [worker-workflow](docs/worker-workflow.md) | the worker journey |
| [site-transfer-workflow](docs/site-transfer-workflow.md) | transfer rules & states |
| [testing-strategy](docs/testing-strategy.md) | TDD approach, coverage |
| [offline-sync](docs/offline-sync.md) | offline behaviour, outbox, conflict rules |
| [security](docs/security.md) | security model & assumptions |
| [implementation-status](docs/implementation-status.md) | acceptance criteria & open decisions |

## Open project decisions

Several items require project confirmation and are **not** hard-coded blindly —
see `docs/implementation-status.md`: the `Kushavati` district label, the exact
consent/ethics wording, the preferred-language set (questionnaire lists
Hindi/English/Bengali/Other; the app i18n also offers Marathi), OTP/phone
verification, and symptom-escalation rules.
