# syntax=docker/dockerfile:1

# ------------------------------------------------------------------
# Multi-stage build for the Next.js 16 app (standalone output).
#
# `next build` runs generateStaticParams / server components that read
# PostgreSQL, so a database must be reachable AT BUILD TIME. CI provides
# a throwaway Postgres and passes its URL as the DATABASE_URL build arg
# (see .github/workflows/docker.yml). The runtime container connects to
# the real database via the DATABASE_URL env var instead.
# ------------------------------------------------------------------

# ---- deps: install node_modules ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: prisma generate + next build ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DB reachable only during build (CI service container via --network=host)
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
# build-only placeholders so next build doesn't choke on missing auth env
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV AUTH_TRUST_HOST=true
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build
# Self-contained content importer (prisma/content/snapshot.json → database),
# run by the entrypoint on every start.
RUN npm run content:bundle

# ---- runner: minimal standalone image ----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# standalone server + static assets. Media is NOT in the image: it lives in
# /app/storage, a host bind mount in production (see docker-compose.prod.yml),
# so uploads survive every redeploy.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema + migrations + CLI so the entrypoint can run
# `prisma migrate deploy` against the real database on container start
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/dist/content-import.cjs ./scripts/content-import.cjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
ENV STORAGE_DIR=/app/storage
RUN chmod +x docker-entrypoint.sh && chown -R nextjs:nodejs /app/.next \
  && mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
