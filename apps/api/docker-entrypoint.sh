#!/bin/sh
set -e

echo "[m3-api] Applying database migrations..."
npm exec -- prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "[m3-api] Seeding database (SEED_ON_START=true)..."
  npm exec -- ts-node -T prisma/seed.ts || echo "[m3-api] Seed skipped/failed (continuing)"
fi

echo "[m3-api] Starting API..."
exec node dist/main.js
