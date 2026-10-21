# Office LAN & Docker Development Setup

This guide provides instructions for running and verifying the M3 Malaria Surveillance Platform using Docker Compose on a local Wi-Fi / LAN network.

---

## 1. Prerequisites

- **Docker & Docker Compose** (v2.20+)
- **Node.js** (v20+) & **npm**
- **Python** (3.12+) with virtual environment tools
- **Android Device** with the **Expo Go** app installed (connected to the same Wi-Fi network), or an Android Emulator.

---

## 2. Determining the Host LAN IPv4 Address

On Linux, determine your active local network IP address using:

```bash
# Recommended: get the IP route used for default traffic
ip -4 route get 1.1.1.1 | awk '{print $7}'

# Or list addresses on your primary network interface (e.g., wlp5s0):
ip -4 addr show wlp5s0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```

*(Note: `./scripts/m3s` automatically runs this check on startup.)*

---

## 3. URL Architecture & Port Separation

| Context | FastAPI Backend | PostgreSQL | Web Console | Mobile Expo |
| :--- | :--- | :--- | :--- | :--- |
| **Host Machine** | `http://localhost:8003/api/v1` | `localhost:5432` *(internal only)* | `http://localhost:5173` | `http://localhost:8081` |
| **LAN Devices (Android Phone)** | `http://<LAN_IP>:8003/api/v1` | **BLOCKED (Unreachable)** | `http://<LAN_IP>:5173` | `exp://<LAN_IP>:8081` |
| **Android Emulator** | `http://10.0.2.2:8003/api/v1` | **BLOCKED (Unreachable)** | N/A | `exp://10.0.2.2:8081` |
| **Inside Docker Network** | `http://api:8000/api/v1` | `postgres:5432` | N/A | N/A |

> [!IMPORTANT]
> **PostgreSQL Isolation**: PostgreSQL port `5432` is strictly internal to the Docker network (`m3-compose-net`). It is **never published** to `0.0.0.0` or accessible across the LAN.

---

## 4. Starting and Managing Services

The repository provides the unified management script `./scripts/m3s`:

```bash
# 1. Start all services (Docker PostgreSQL, Docker API on :8003, Web Console on :5173, Metro on :8081)
./scripts/m3s start

# 2. Inspect health, ports, and LAN binding
./scripts/m3s status

# 3. View Expo Go QR code for physical Android scanning
./scripts/m3s qr

# 4. Stream Docker backend logs
./scripts/m3s docker-logs

# 5. Stop host web and mobile background tasks
./scripts/m3s stop

# 6. Stop Docker containers
./scripts/m3s docker-down
```

---

## 5. Health and Database Verification

### Verifying API Health
From the host or any device on the same LAN:
```bash
curl http://<LAN_IP>:8003/health
# Expected response:
# {"status":"healthy","database":"connected","version":"0.1.0"}
```

### Verifying PostgreSQL Health & Volume Persistence
Check container status and database connection:
```bash
docker compose ps
docker compose exec db pg_isready -U m3_compose_user -d m3_compose_dev
```

### Verifying Alembic Migration Head
```bash
docker compose exec api alembic current
# Confirms migration revision matches the latest head (20261025_01)
```

### Verifying PostgreSQL is NOT reachable on LAN
Test from another device or host using the LAN IP:
```bash
nc -z -v -w 2 <LAN_IP> 5432
# Expected: Connection refused or timeout (port is closed to LAN)
```

---

## 6. Dynamic LAN IP Changes

If your router assigns a new DHCP address to your computer (e.g., after reconnecting to Wi-Fi):

1. Run `./scripts/m3s restart` — the script automatically discovers the new IP, regenerates `apps/mobile/expo-qr.png`, and rebinds Metro and Vite.
2. If running standalone commands, update `.env`, `apps/mobile/.env`, and `apps/web/.env`:
   ```bash
   API_BASE_URL=http://<NEW_LAN_IP>:8003/api/v1
   VITE_API_BASE_URL=http://<NEW_LAN_IP>:8003/api/v1
   EXPO_PUBLIC_API_BASE_URL=http://<NEW_LAN_IP>:8003/api/v1
   ```
3. Restart the Docker API container to pick up updated CORS origins:
   ```bash
   docker compose restart api
   ```

---

## 7. Troubleshooting & Recovery

### Container Restart Recovery (Without Data Loss)
> [!CAUTION]
> **NEVER run `docker compose down -v`**. The `-v` flag deletes named volumes and will permanently erase `m3-compose-postgres-data`.

If the API or PostgreSQL container fails to start:
1. Check the logs:
   ```bash
   docker compose logs api
   docker compose logs postgres
   ```
2. Safely restart without removing volumes:
   ```bash
   docker compose restart
   ```
3. Run migrations if necessary:
   ```bash
   docker compose exec api alembic upgrade head
   ```

### Firewall & Network Reachability
If the physical phone cannot reach `http://<LAN_IP>:8003/health`:
1. Check Linux firewall:
   ```bash
   sudo ufw status
   # Allow incoming on ports 8003, 5173, and 8081 if ufw is active
   sudo ufw allow 8003/tcp
   sudo ufw allow 5173/tcp
   sudo ufw allow 8081/tcp
   ```
2. Check router "AP Isolation" / "Client Isolation": ensure devices on Wi-Fi can communicate with each other. Test by pinging the phone's IP from the host: `ping -c 3 <PHONE_IP>`.

### CORS Issues in Web Console
If the browser console displays CORS errors when accessing `http://<LAN_IP>:5173`:
Verify that `API_CORS_ORIGINS` in `.env` includes both `http://localhost:5173` and `http://<LAN_IP>:5173`. Restart the API container after updating.

### Expo & Camera Permissions
- In Expo Go, ensure camera permissions are allowed for scanning contractor QR codes.
- If camera permissions are denied or unavailable on the physical device, the Contractor Site screen provides a manual token entry fallback for worker assignment.

---

## 8. Cleartext HTTP Notice

The mobile configuration in `apps/mobile/app.json` has `android.usesCleartextTraffic: true` enabled to allow HTTP communication with the local Docker API during development. This environment uses synthetic data and must only be operated on private, trusted local networks. Production deployments require TLS termination (HTTPS) with verified certificates.
