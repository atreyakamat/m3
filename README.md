# M3 Malaria Surveillance Platform

M3 is a synthetic-data prototype for malaria surveillance coordination among migrant construction workers in Goa. It provides an Expo Go-compatible mobile app, a separate React web console, and a FastAPI/PostgreSQL backend. It is not approved for clinical, research, or production use.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/mobile` | Expo Router / React Native mobile app, read-only offline cache |
| `apps/web` | Vite/React office-LAN console |
| `services/api` | FastAPI, SQLAlchemy models, Alembic migration, seed and tests |
| `infra/docker` | Reserved for future reverse proxy/TLS deployment assets |
| `docs` | Architecture, security, setup, decisions and test plan |

## Quick start

### One-Command Unified Startup (`m3s` & `m3i`)

From the `m3` repository directory (or anywhere on your machine), run:

```bash
# Start all background services (FastAPI on 8001, Vite on 5173, Expo on 8081)
m3s

# Inspect and stream real-time logs from all services with color-coded tags
m3i

# Additional commands:
m3s status       # Check health and ports of all background services
m3s restart      # Restart all services
m3s stop         # Shut down all background services
m3i api          # Stream only Backend API logs
m3i web          # Stream only Web Console logs
m3i mobile       # Stream only Mobile Expo logs
```

---

### Manual / Containerized Start

Prerequisites: Docker Compose, Python 3.12 for local API tests, Node 20+ / npm, and an Android phone with Expo Go for device testing. Commands marked **not executed in this environment** must be run on the office host.

```sh
cp .env.example .env
# Edit .env: replace all CHANGE_ME values and OFFICE_LAN_IP (prefer the host's Tailscale IP from `tailscale ip -4`; see docs/EXPO_GO.md).
# Note: On hosts where port 8000 is occupied by an existing daemon (e.g., portainer),
# use port 8001 for the FastAPI service:
# API_BASE_URL=http://<HOST_IP>:8001/api/v1
docker compose up -d --build
# Or run with the local virtual environment:
# cd services/api && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
curl http://<HOST_IP>:8001/health
```

Compose automatically runs `alembic upgrade head` before API startup. To run it explicitly:

```sh
docker compose run --rm api alembic upgrade head
```

The synthetic seed command prints the development-only demo accounts (`+919000000001`–`+919000000007`, PIN `2468`), covering all seven PRD roles (`worker`, `clinician`, `pathologist`, `health_worker`, `research_lab`, `contractor`, `admin`). Do not use those accounts or PIN in any non-synthetic setting. For a first non-seed account, generate a bootstrap secret in `.env`, then call the internal `/api/v1/bootstrap/users` endpoint with that secret in `X-Bootstrap-Secret`; examples appear in OpenAPI `/docs`. Do not put the secret in a mobile or web client.

### Web console

```sh
cd apps/web
npm install
npm run lint
npm run build
VITE_API_BASE_URL=http://<HOST_IP>:8001/api/v1 npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://<HOST_IP>:5173` from an approved LAN device. It signs in against the API and shows only authorized data.

### Mobile in Expo Go

```sh
cd apps/mobile
npm install
npx expo install --check
npx expo-doctor
npm run typecheck
REACT_NATIVE_PACKAGER_HOSTNAME=<HOST_IP> EXPO_PUBLIC_API_BASE_URL=http://<HOST_IP>:8001/api/v1 npx expo start --lan
```

Scan the QR code in Expo Go. Never use `localhost` as the mobile API address: it would target the phone. The first screen also supports synthetic demo launch without an API, and includes full read-only cached worker browsing when offline. See [Expo Go setup](docs/EXPO_GO.md) and [LAN setup](docs/LAN_SETUP.md).

### Automated verification suites

```sh
# Backend authorization, RBAC, screening, questionnaire and workflow tests (44 passed)
cd services/api && PYTHONPATH=. .venv/bin/pytest tests/ -v

# Full LAN API and Core Flow Verification across all 7 PRD roles
python3 scripts/verify_e2e_lan.py

# Offline Caching & Draft Retention Spec Verification
python3 scripts/verify_offline_cache.py

# Mobile client TypeScript compilation
cd apps/mobile && npm run typecheck
```

### Database backup and restore

```sh
set -a; . ./.env; set +a
./scripts/backup-db.sh
./scripts/restore-db.sh backups/m3-YYYYMMDD-HHMMSS.sql.gz
```

These scripts are for a controlled test only until encryption, access control, retention, and a restore drill are approved. Do not remove the `m3-postgres` Docker volume unless you explicitly intend to destroy its database.

## Troubleshooting

- `health` fails: run `docker compose logs api db` or check if port 8000 is occupied (`ss -tulpn | grep 8000`). If occupied, use port 8001.
- Phone cannot connect: verify same Wi-Fi/VPN, host firewall TCP 8001, API listening on host (0.0.0.0), and use the host LAN IP in `EXPO_PUBLIC_API_BASE_URL`.
- Browser CORS error: set `API_CORS_ORIGINS` to the exact `http://HOST:5173` web origin and recreate or reload the API.
- Login fails: phone normalizes to `+91` for a ten-digit Indian number; use a provisioned synthetic account.
- Expo package mismatch: run `npx expo install`, not a blind version upgrade.

## Documentation

Read [project understanding](docs/PROJECT_UNDERSTANDING.md), [architecture](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), [security and privacy](docs/SECURITY_AND_PRIVACY.md), [decisions](docs/DECISIONS.md), and [testing](docs/TESTING.md) before using the prototype.

## Signed APK path later

Keep Expo Go as the daily development target. When key custody and distribution are approved, configure an EAS or local Android release profile outside source control, inject no secrets into JavaScript, build a signed APK, retain the keystore with the designated custodian, test install/update/rollback on pilot devices, and document its checksum/version. Do not generate or claim a signed APK without those credentials and approval.
