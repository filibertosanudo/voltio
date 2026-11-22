# --- deps: installed once, reused by every stage below ---
FROM node:22-alpine AS deps
WORKDIR /app
# @node-rs/argon2's prebuilt binary for Alpine (musl) needs this.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# --- build: generate the Prisma client and compile the app ---
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# No database and no secrets at build time: every page is dynamic
# (app/layout.tsx) and lib/env.ts validates on first use, not at import.
RUN npm run build

# --- migrate: `prisma migrate deploy` needs the CLI and its dependency
# tree, which `output: "standalone"` deliberately leaves out of the runner.
# Reusing the build stage avoids hand-picking that tree.
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# --- seed: demo data. Never part of the app's startup: seeding is a
# command someone runs on purpose.
FROM build AS seed
CMD ["npm", "run", "db:seed"]

# --- worker: the notification queue's long-running process. Needs tsx and
# the full node_modules for the same reason as `migrate`.
FROM build AS worker
USER node
CMD ["npm", "run", "notifications:worker"]

# --- runner: the deployed web image ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Without this the standalone server binds to the container's hostname and
# a healthcheck against 127.0.0.1 never connects.
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache libc6-compat
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# A named volume mounted here inherits this directory's ownership only if it
# exists; otherwise Docker creates the mount point as root and the non-root
# user below cannot save a photo.
RUN mkdir -p /data/media && chown nextjs:nodejs /data/media

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
