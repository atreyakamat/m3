# M3 Platform — Startup Guide

Written in Simplified Technical English (ASD-STE100): short sentences, one
instruction per step, active voice, present tense.

This guide tells you how to start the backend and the web app on a new machine.
Then it points you to `mobile.md` to build and test the Android Worker app.

---

## 1. Purpose

You start the M3 platform on one machine ("the host machine"). The host machine
runs PostgreSQL, the NestJS API, and the React web app in Docker. A physical
Android phone connects to the API over the local network.

## 2. Prerequisites

Install this software on the host machine:

| Software | Use |
| --- | --- |
| Docker Engine 24+ | runs the database, API, and web app |
| Docker Compose v2 | orchestrates the containers |
| Git | gets the project (or use a copied folder) |

You do not need Node.js to run the platform with Docker. You need Node.js only
for local development without Docker (Section 9) and for the mobile build
(`mobile.md`).

## 3. Get the project

Copy the whole repository to the host machine. Use Git or a file transfer.

```bash
# example with Git
git clone <REPO_URL> m3
cd m3
```

Do not copy `node_modules`, `dist`, or `.env` from another machine. The build
creates them on the host machine.

## 4. Configure the environment

1. Create the environment file from the template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`. For local testing the defaults work. For any shared or real
   deployment, change the secrets:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET` (use 32 characters or more)
   - `BOOTSTRAP_SECRET`

3. Keep `.env` private. Do not commit `.env`.

## 5. Start the backend and the web app

```bash
docker compose up -d --build
```

The command does these tasks:

1. It starts PostgreSQL.
2. It builds and starts the API.
3. The API applies the database migrations.
4. The API seeds demo data (`SEED_ON_START=true`).
5. It builds and starts the web app behind nginx.

Wait until the containers are healthy:

```bash
docker compose ps
```

## 6. Verify the platform

```bash
curl http://localhost:8003/api/v1/meta/health      # must return {"status":"ok",...}
```

Open these pages in a browser on the host machine:

| Service | URL |
| --- | --- |
| API health | http://localhost:8003/api/v1/meta/health |
| API docs (Swagger) | http://localhost:8003/api/docs |
| Web portal | http://localhost:5174 |

> The web port is `5174`. Change `WEB_PORT` in `.env` if the port is in use.
> The API port is `8003`. The database port is `5544`.

## 7. Seeded demo accounts

Use these accounts for development and testing only.

| Role | Login | Secret |
| --- | --- | --- |
| Worker | phone `9000000001` | PIN `1234` |
| Contractor (North) | user `contractor.north` | `password123` |
| Contractor (South) | user `contractor.south` | `password123` |
| Clinician | user `clinician` | `password123` |
| Pathologist | user `pathologist` | `password123` |
| Health Worker | user `healthworker` | `password123` |
| Research Lab | user `researchlab` | `password123` |
| Admin | user `admin` | `password123` |

## 8. Build and test the mobile app

1. Confirm the backend runs (Section 6).
2. Find the LAN IP of the host machine:
   - Linux/macOS: `hostname -I` or `ipconfig getifaddr en0`
   - Windows: `ipconfig` (use the active IPv4 address)
3. Open `mobile.md`.
4. Follow `mobile.md` to set `EXPO_PUBLIC_API_BASE_URL`, build the APK, install
   it, and test the Worker workflows on a physical Android phone.

The phone and the host machine must use the same Wi-Fi network.

## 9. Local development without Docker (option)

Use this only for development. You need Node.js 20+ and a PostgreSQL instance.

```bash
npm install                                   # shared + api + web workspaces
npm run build:shared
# set DATABASE_URL in your environment (see .env.example), then:
npm --workspace @m3/api run prisma:migrate:dev
npm --workspace @m3/api run db:seed
npm run dev:api                               # API on :8003
npm run dev:web                               # web on :5173
```

## 10. Run the automated tests (option)

```bash
npm run test:shared                 # 24 tests
npm run test:api                    # 31 tests (needs PostgreSQL)
npm run test:web                    # 7 tests
cd apps/mobile && npm test          # 8 tests
```

The API tests use a separate `m3_test` database. See `docs/testing-strategy.md`.

## 11. Stop and reset

```bash
docker compose stop                 # stop the containers
docker compose down                 # stop and remove the containers
docker compose down -v              # also delete the database volume (full reset)
```

> `down -v` deletes all data. Use it only for a clean restart.

## 12. Troubleshooting

| Problem | Fix |
| --- | --- |
| A port is in use | Change `WEB_PORT`, `PORT`, or `POSTGRES_PORT` in `.env`; start again |
| The API cannot reach the database | Wait for the `db` container to be healthy; check `docker compose logs db` |
| The API shows migration errors | Run `docker compose logs api`; confirm `DATABASE_URL`; try `docker compose down -v` then `up` |
| The phone cannot reach the API | Confirm the same Wi-Fi; use the LAN IP, not `localhost`; see `mobile.md` Section 6 |
