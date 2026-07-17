# syntax=docker/dockerfile:1
# Combined ClickBit Admin image: runs NestJS API (port 5001) and Next.js web (port 3001)
# in a single container. The web app rewrites /api/* to localhost:5001 so no separate
# public API service is needed.
FROM node:22-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace definitions and lockfile first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source and build both apps
COPY . .
RUN pnpm --filter @clickbit/api build
RUN pnpm --filter @clickbit/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    API_PORT=5001

# API artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Web artifacts (standalone layout preserves apps/web path)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Shared packages and root workspace deps
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Entrypoint script starts both services
COPY start.js ./start.js

EXPOSE 5001 3001
CMD ["node", "./start.js"]
