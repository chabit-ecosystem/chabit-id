# Docker Setup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dockerize both chabit-identity and backend-chabit so the stack runs identically on any machine, migrating backend-chabit from SQLite to PostgreSQL in the process.

**Architecture:** Each repo gets an independent `Dockerfile` + `docker-compose.yml` (no shared compose). chabit-identity already has Docker files — only a small env var update is needed. backend-chabit needs full Docker setup from scratch plus a Prisma provider migration.

**Tech Stack:** Docker multi-stage builds (node:22-alpine), PostgreSQL 16-alpine, Prisma ORM (PostgreSQL provider), NestJS, Hono.

**Spec:** `docs/superpowers/specs/2026-03-17-docker-setup-design.md`

---

## Chunk 1: chabit-identity docker-compose.yml update

### Task 1: Add missing env vars to chabit-identity docker-compose.yml

**Files:**
- Modify: `/home/imn0p/chabit/chabit-identity/docker-compose.yml` (line 21–34, `environment` block)

The existing `docker-compose.yml` is missing three env vars added by the auth migration: `WEBHOOK_BACKEND_URL`, `WEBHOOK_SECRET`, and the SMTP block.

- [ ] **Step 1: Open and review the existing docker-compose.yml**

  File: `/home/imn0p/chabit/chabit-identity/docker-compose.yml`

  Current `environment` block ends at `LOG_LEVEL`. We need to add after `LOG_LEVEL`:
  ```yaml
  WEBHOOK_BACKEND_URL: ${WEBHOOK_BACKEND_URL:-}
  WEBHOOK_SECRET: ${WEBHOOK_SECRET:-}
  SMTP_HOST: ${SMTP_HOST:-}
  SMTP_PORT: ${SMTP_PORT:-25}
  SMTP_SECURE: ${SMTP_SECURE:-false}
  SMTP_FROM: ${SMTP_FROM:-noreply@chabit.com}
  ```

- [ ] **Step 2: Apply the edit**

  In `/home/imn0p/chabit/chabit-identity/docker-compose.yml`, add the 6 lines after the `LOG_LEVEL` entry inside the `app.environment` block:
  ```yaml
      LOG_LEVEL: ${LOG_LEVEL:-info}
      WEBHOOK_BACKEND_URL: ${WEBHOOK_BACKEND_URL:-}
      WEBHOOK_SECRET: ${WEBHOOK_SECRET:-}
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-25}
      SMTP_SECURE: ${SMTP_SECURE:-false}
      SMTP_FROM: ${SMTP_FROM:-noreply@chabit.com}
  ```

- [ ] **Step 3: Run tests to make sure nothing broke**

  ```bash
  cd /home/imn0p/chabit/chabit-identity
  npm test
  ```
  Expected: all 162 tests passing.

- [ ] **Step 4: Commit**

  ```bash
  cd /home/imn0p/chabit/chabit-identity
  git add docker-compose.yml
  git commit -m "chore(docker): add WEBHOOK and SMTP env vars to docker-compose"
  ```

---

## Chunk 2: backend-chabit — package.json + Prisma PostgreSQL migration

All backend-chabit tasks work in the `feat/auth-migration` worktree:
**Path:** `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/`

### Task 2: Move `prisma` CLI from devDependencies to dependencies

**Files:**
- Modify: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/package.json`

The runtime Docker stage runs `npm ci --omit=dev`, which strips devDependencies. The `prisma` CLI must be in `dependencies` so `node_modules/.bin/prisma generate` and `node_modules/.bin/prisma migrate deploy` are available at runtime.

- [ ] **Step 1: Edit package.json**

  In `package.json`:
  - Remove `"prisma": "^6.6.0"` from `devDependencies`
  - Add `"prisma": "^6.6.0"` to `dependencies` (alongside `"@prisma/client"`)

  Result in `dependencies`:
  ```json
  "@prisma/client": "^6.6.0",
  "prisma": "^6.6.0",
  ```

- [ ] **Step 2: Re-run npm install to update package-lock.json**

  ```bash
  cd /home/imn0p/backend-chabit/.worktrees/feat/auth-migration
  npm install
  ```
  Expected: package-lock.json updated, no errors.

- [ ] **Step 3: Run tests to confirm nothing broke**

  ```bash
  npm test
  ```
  Expected: same pass/fail count as before (370/418 — the 48 pre-existing failures are unrelated to this change).

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json
  git commit -m "chore(deps): move prisma CLI from devDependencies to dependencies"
  ```

---

### Task 3: Migrate Prisma provider from SQLite to PostgreSQL

**Files:**
- Modify: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/prisma/schema.prisma`
- Delete: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/prisma/migrations/20260317004912_add_chabit_identity_ref_remove_auth_fields/`
- Delete: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/prisma/migrations/migration_lock.toml`
- Create: new migration via `prisma migrate dev --name init`

**Prerequisite:** A local PostgreSQL instance must be running with:
- Host: `localhost:5432`
- User: `chabit`, Password: `chabit`, DB: `chabit_backend`

If you don't have one running, start it with Docker:
```bash
docker run -d --name pg-chabit-backend \
  -e POSTGRES_USER=chabit \
  -e POSTGRES_PASSWORD=chabit \
  -e POSTGRES_DB=chabit_backend \
  -p 5432:5432 \
  postgres:16-alpine
```

- [ ] **Step 1: Update schema.prisma provider**

  In `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/prisma/schema.prisma`, change:
  ```prisma
  datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL")
  }
  ```
  to:
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```

- [ ] **Step 2: Delete existing SQLite migrations**

  ```bash
  cd /home/imn0p/backend-chabit/.worktrees/feat/auth-migration
  rm -rf prisma/migrations/
  ```

- [ ] **Step 3: Set DATABASE_URL and generate clean PostgreSQL migration**

  Create or update `.env` temporarily for this step:
  ```
  DATABASE_URL=postgresql://chabit:chabit@localhost:5432/chabit_backend
  ```

  Then run:
  ```bash
  npx prisma migrate dev --name init
  ```
  Expected: Prisma creates `prisma/migrations/<timestamp>_init/migration.sql` with the full PostgreSQL DDL. No errors.

- [ ] **Step 4: Verify migration_lock.toml shows postgresql**

  ```bash
  cat prisma/migrations/migration_lock.toml
  ```
  Expected output:
  ```
  # Please do not edit this file manually
  # It should be added in your version-control system (i.e. Git)
  provider = "postgresql"
  ```

- [ ] **Step 5: Run tests (they should still pass since tests use mocks, not real DB)**

  ```bash
  npm test
  ```
  Expected: same count as before. Jest tests use mocked Prisma client — provider change doesn't affect unit tests.

- [ ] **Step 6: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "chore(db): migrate Prisma provider from SQLite to PostgreSQL"
  ```

---

## Chunk 3: backend-chabit — Docker files

### Task 4: Create .dockerignore

**Files:**
- Create: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/.dockerignore`

- [ ] **Step 1: Create .dockerignore**

  Content:
  ```
  node_modules/
  dist/
  *.db
  *.db-journal
  .env
  .env.*
  ```

- [ ] **Step 2: Commit**

  ```bash
  cd /home/imn0p/backend-chabit/.worktrees/feat/auth-migration
  git add .dockerignore
  git commit -m "chore(docker): add .dockerignore"
  ```

---

### Task 5: Create Dockerfile

**Files:**
- Create: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/Dockerfile`

Multi-stage build: builder compiles TypeScript and runs `prisma generate`; runtime installs only prod deps, regenerates the Prisma client, and starts with `migrate deploy`.

Key decisions (see spec for rationale):
- `prisma/` copied before `npm ci` in builder so schema is available for `prisma generate`
- `prisma generate` runs in **both** stages — builder for the build, runtime to regenerate the client against prod `node_modules`
- `node_modules/.bin/prisma` used consistently (avoids `npx` resolution issues)
- `migrate deploy` is idempotent — safe to run on every restart

- [ ] **Step 1: Create Dockerfile**

  ```dockerfile
  # Stage 1: Builder
  FROM node:22-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  COPY prisma/ ./prisma/
  RUN npm ci
  COPY tsconfig*.json ./
  COPY src/ ./src/
  RUN npm run build
  RUN npx prisma generate

  # Stage 2: Runtime
  FROM node:22-alpine AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  COPY package*.json ./
  COPY prisma/ ./prisma/
  RUN npm ci --omit=dev
  RUN node_modules/.bin/prisma generate
  COPY --from=builder /app/dist ./dist
  EXPOSE 3000
  CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
  ```

- [ ] **Step 2: Verify the build succeeds locally**

  ```bash
  cd /home/imn0p/backend-chabit/.worktrees/feat/auth-migration
  docker build -t chabit-backend:test .
  ```
  Expected: build completes without errors. Both stages should succeed.

  If `npm run build` fails during the builder stage, check for TypeScript errors first:
  ```bash
  npm run build
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add Dockerfile
  git commit -m "feat(docker): add multi-stage Dockerfile for NestJS + Prisma"
  ```

---

### Task 6: Create docker-compose.yml

**Files:**
- Create: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/docker-compose.yml`

The compose file brings up a `postgres` service and the `app` service with `depends_on: service_healthy` so the app waits for Postgres before starting.

Secrets that **must match chabit-identity** are passed through from the environment (no defaults — user must set them):
- `JWT_SECRET` — validates tokens issued by chabit-identity
- `WEBHOOK_SECRET` — verifies HMAC signature of registration webhooks

- [ ] **Step 1: Create docker-compose.yml**

  ```yaml
  services:
    postgres:
      image: postgres:16-alpine
      environment:
        POSTGRES_USER: chabit
        POSTGRES_PASSWORD: chabit
        POSTGRES_DB: chabit_backend
      volumes:
        - postgres_data:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U chabit -d chabit_backend"]
        interval: 5s
        timeout: 5s
        retries: 5

    app:
      build: .
      ports:
        - "${PORT:-3000}:3000"
      environment:
        NODE_ENV: production
        PORT: 3000
        DATABASE_URL: postgresql://chabit:chabit@postgres:5432/chabit_backend
        JWT_SECRET: ${JWT_SECRET}
        WEBHOOK_SECRET: ${WEBHOOK_SECRET}
        CHABIT_IDENTITY_URL: ${CHABIT_IDENTITY_URL:-http://localhost:3001}
        STAFF_JWT_SECRET: ${STAFF_JWT_SECRET:-}
        TICKET_SECRET: ${TICKET_SECRET:-}
        BLNK_BASE_URL: ${BLNK_BASE_URL:-http://localhost:5010}
        BLNK_HTTP_TIMEOUT: ${BLNK_HTTP_TIMEOUT:-5000}
        STRIPE_SK_TEST: ${STRIPE_SK_TEST:-}
        STRIPE_WEBHOOK_TEST: ${STRIPE_WEBHOOK_TEST:-}
        REDIS_URL: ${REDIS_URL:-redis://localhost:6379}
        CORS_ORIGIN: ${CORS_ORIGIN:-*}
      depends_on:
        postgres:
          condition: service_healthy

  volumes:
    postgres_data:
  ```

- [ ] **Step 2: Verify compose config is valid**

  ```bash
  cd /home/imn0p/backend-chabit/.worktrees/feat/auth-migration
  docker compose config
  ```
  Expected: prints the resolved config without errors.

- [ ] **Step 3: Commit**

  ```bash
  git add docker-compose.yml
  git commit -m "feat(docker): add docker-compose.yml with postgres service"
  ```

---

### Task 7: Update backend-chabit .env.example

**Files:**
- Modify: `/home/imn0p/backend-chabit/.worktrees/feat/auth-migration/.env.example`

Two changes:
1. Replace `DATABASE_URL="file:./dev.db"` with the PostgreSQL format
2. Add `⚠️ DEBE coincidir` comments on `JWT_SECRET` and `WEBHOOK_SECRET`
3. Add `WEBHOOK_SECRET` and `CHABIT_IDENTITY_URL` entries (missing from current file)

- [ ] **Step 1: Update .env.example**

  Replace the existing content with:
  ```env
  # Entorno de la aplicación
  enviroment=dev                             # dev | test | prod
  PORT=3000                                  # Puerto HTTP donde levanta Nest

  # Base de datos (PostgreSQL)
  DATABASE_URL=postgresql://chabit:chabit@localhost:5432/chabit_backend

  # Autenticación y tokens
  # ⚠️  DEBE coincidir con JWT_SECRET de chabit-identity
  JWT_SECRET=changeme-jwt-secret
  STAFF_JWT_SECRET=changeme-staff-secret     # Secreto para JWT de staff
  TICKET_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # Hex de 64 chars para firmar tickets

  # Integración con chabit-identity
  CHABIT_IDENTITY_URL=http://localhost:3001  # URL donde corre chabit-identity
  # ⚠️  DEBE coincidir con WEBHOOK_SECRET de chabit-identity
  WEBHOOK_SECRET=change-me-in-production

  # Blockchain
  RPC_URL=http://localhost:20001             # RPC al nodo EVM que se usa
  TX_CONFIRMATIONS=2                         # Confirmaciones mínimas antes de aceptar tx
  PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
  PUBLIC_KEY=0x0000000000000000000000000000000000000000
  CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
  CONTRACT_ADDRESS_ERC_721=0x0000000000000000000000000000000000000000
  CONTRACT_ADDRESS_TICKET=0x0000000000000000000000000000000000000000
  TOKEN_USDT=0x0000000000000000000000000000000000000000
  TOKEN_USDG=0x0000000000000000000000000000000000000000

  # Stripe
  STRIPE_PK_TEST=pk_test_xxx                 # Publishable key de pruebas
  STRIPE_SK_TEST=sk_test_xxx                 # Secret key de pruebas
  STRIPE_WEBHOOK_TEST=whsec_xxx              # Secret del endpoint de webhook

  # Blnk / ledger
  BLNK_BASE_URL=http://localhost:5010        # Endpoint base del core/ledger
  BLNK_HTTP_TIMEOUT=5000                     # Timeout en ms para requests a Blnk
  BLNK_SYSTEM_ACCOUNT_ARS=system_account_ARS
  GENERAL_LEDGER=ldg_xxx
  CUSTOMER_LEDGER=ldg_xxx
  SYSTEM_ACCOUNT_USD=bln_xxx
  SYSTEM_ACCOUNT_ETH=bln_xxx
  SYSTEM_ACCOUNT_USDT=bln_xxx
  SYSTEM_ACCOUNT_ARS_TEST=bln_xxx

  # Redis
  REDIS_URL=redis://localhost:6379           # URL de conexión a Redis

  # Correo
  MAIL_FROM="Chabit <no-reply@chabit.local>"
  MAIL_SENDMAIL_PATH=/usr/sbin/sendmail
  ```

- [ ] **Step 2: Commit**

  ```bash
  cd /home/imn0p/backend-chabit/.worktrees/feat/auth-migration
  git add .env.example
  git commit -m "docs: update .env.example for PostgreSQL and add shared secret warnings"
  ```

---

## Final verification

After all tasks:

- [ ] **chabit-identity**: `npm test` → 162/162 passing
- [ ] **backend-chabit**: `npm test` → same count as before (pre-existing failures unchanged)
- [ ] **backend-chabit**: `docker build -t chabit-backend:test .` → builds cleanly
- [ ] **chabit-identity**: `docker compose config` → no errors
- [ ] **backend-chabit**: `docker compose config` → no errors

---

## Shared secrets reminder

These must be **identical** across both services or the system silently breaks:

| Variable | Effect if mismatched |
|----------|---------------------|
| `JWT_SECRET` | backend-chabit rejects all tokens (401 on every authenticated request) |
| `WEBHOOK_SECRET` | backend-chabit rejects all registration webhooks (wallet never created) |
