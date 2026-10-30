# Multi-stage build for the M3 NestJS API (monorepo context = repo root).
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
# Workspace manifests first for better layer caching.
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN npm install --no-audit --no-fund --ignore-scripts
# Sources
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @m3/shared \
  && npm exec --workspace @m3/api -- prisma generate \
  && npm run build --workspace @m3/api

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 8003
CMD ["sh", "docker-entrypoint.sh"]
