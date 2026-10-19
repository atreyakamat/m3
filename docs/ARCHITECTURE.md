# Architecture

```
Expo Go mobile ─┐                         ┌─ PostgreSQL (private Docker network)
                ├─ HTTPS in production ─ FastAPI / OpenAPI ─ Alembic + SQLAlchemy
Vite web LAN ───┘                         └─ audit events and session records
```

`apps/mobile` is Expo Router + TypeScript. It uses Expo SQLite only for the signed-in user’s viewing cache and Expo SecureStore for the access token. It has no outbox and never queues writes. `apps/web` is a separate React/Vite office console. Both clients use `/api/v1`; neither knows database credentials.

`services/api` owns validation, role checks, patient record access, session validity, audit events, and persistence. PostgreSQL is authoritative. The API emits OpenAPI at `/docs` and `/openapi.json`. Docker Compose publishes API port 8000 for local/LAN use but keeps Postgres un-published within its Docker network.

The deployment defaults to HTTP only for isolated synthetic local development. A real-data LAN installation requires approved TLS/reverse-proxy and network design. API CORS and mobile API URL are environment configuration, never a hard-coded phone `localhost` address.
