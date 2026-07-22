# syntax=docker/dockerfile:1
# Combined ClickBit Admin image: runs NestJS API (port 5001) and Next.js web (port 3001)
# in a single container. The web app rewrites /api/* to localhost:5001 so no separate
# public API service is needed.
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm-store-clickbit-admin,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
RUN mkdir -p ./packages/shared/node_modules
COPY --from=deps /app/packages/shared/node_module[s] ./packages/shared/node_modules/
COPY . .
ARG DATABASE_URL
ARG DIRECT_URL
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG JWT_SECRET
ARG API_BASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NODE_ENV=production
ENV DATABASE_URL=$DATABASE_URL DIRECT_URL=$DIRECT_URL SUPABASE_URL=$SUPABASE_URL SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY JWT_SECRET=$JWT_SECRET API_BASE_URL=$API_BASE_URL NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY NODE_ENV=$NODE_ENV
RUN pnpm --filter @clickbit/shared build
RUN pnpm --filter @clickbit/api db:generate
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
COPY --from=builder /app/apps/api/fonts ./apps/api/fonts
ENV FONTS_DIR=/app/apps/api/fonts

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
