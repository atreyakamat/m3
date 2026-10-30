# @m3/web — M3 Malaria Surveillance Web Portal

React + TypeScript + Vite portal for the worker journey, contractor transfer
functions, and placeholder dashboards for the other stakeholder roles. Shares
the design tokens, enums, Zod schemas and questionnaire definition from
`@m3/shared`.

## Scripts (run from the repo root)

```bash
npm run dev --workspace @m3/web        # Vite dev server on :5173
npm run typecheck --workspace @m3/web  # tsc --noEmit
npm run test --workspace @m3/web       # vitest component tests
npm run build --workspace @m3/web      # typecheck + production build -> dist/
```

## Configuration

- `VITE_API_BASE_URL` — API base URL (default `http://localhost:8003/api/v1`).

## Docker

Built from the repo root as the context:

```bash
docker build -f apps/web/Dockerfile --build-arg VITE_API_BASE_URL=http://localhost:8003/api/v1 -t m3-web .
docker run -p 5173:80 m3-web
```

Or via the root `docker-compose.yml` (`web` service), which builds and serves
the portal behind nginx with an SPA fallback.

## Demo accounts

- Worker: phone `9000000001`, PIN `1234`
- Contractors: `contractor.north` / `contractor.south` (password `password123`)
- Placeholder roles: `healthworker`, `clinician`, `pathologist`, `researchlab`, `admin` (password `password123`)
