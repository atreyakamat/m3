# Multi-stage build for the M3 web portal (monorepo context = repo root).
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:8003/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Workspace manifests first (better layer caching).
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN npm install --no-audit --no-fund --ignore-scripts
# Sources needed to build shared + web
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @m3/shared \
  && npm run build --workspace @m3/web

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
