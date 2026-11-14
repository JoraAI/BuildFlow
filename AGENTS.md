# AGENTS.md

## Cursor Cloud specific instructions

BuildFlow is a Turborepo + pnpm monorepo. Standard commands live in `README.md` and the
per-package `package.json` scripts; the notes below only cover non-obvious, durable
caveats for running/testing in the cloud VM. The startup update script already runs
`pnpm install` + `pnpm --filter @buildflow/backend db:generate`, so you normally only need
to start infra and the app.

### Services

- **Infra (Postgres 15 + Redis 7):** `pnpm db:up` (= `docker compose up -d`). Required by the
  backend, migrations, seed, and tests.
- **Backend API** (`@buildflow/backend`, Express + Prisma): `pnpm --filter @buildflow/backend dev`
  → http://localhost:4000 (health: `GET /health`, API under `/api`). Reads the repo-root `.env`.
- **Mobile web** (`@buildflow/mobile`, Expo / React Native Web): `cd apps/mobile && npx expo start --web --port 8081`
  → http://localhost:8081. Defaults its API base to `http://localhost:4000/api`, so start the backend first.
- `@buildflow/mcp-server` is a secondary app and is not needed to run the product.

### Docker in this VM

Docker is installed but not managed by systemd. If `docker info` fails, start the daemon
manually (it keeps the containers' lifecycle): run `sudo dockerd` in a background/tmux shell.
The daemon is configured for this VM with `storage-driver: fuse-overlayfs` and
`features.containerd-snapshotter: false` in `/etc/docker/daemon.json`, and iptables is set to
`iptables-legacy`. If the `ubuntu` user gets permission errors on the socket, run
`sudo chmod 666 /var/run/docker.sock`.

### Env / Prisma wiring (non-obvious)

- Copy `.env.example` → `.env` at the **repo root** and set `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
  (`openssl rand -hex 32`). The backend walks up from `apps/backend` to find the root `.env`.
- Prisma CLI commands (`db:migrate`, `db:seed`, etc.) run with CWD `apps/backend` and do **not**
  walk up, so they need a `.env` there. A gitignored symlink `apps/backend/.env → ../../.env`
  makes the documented `pnpm db:migrate` / `pnpm db:seed` work. Recreate it if missing:
  `ln -sf ../../.env apps/backend/.env`.

### Seed hangs after completing (important gotcha)

`pnpm db:seed` fully commits all data and prints `✅ Seed complete.` but then **never exits**:
the seed imports the API's Redis-backed cache util, which opens an ioredis connection that keeps
the event loop alive. Wait for the `Seed complete` log, then kill the seed process by PID.
Because `prisma migrate reset` runs the seed, `pnpm db:reset` and `pnpm test:backend` hang the
same way at the seed step.

To run the backend test suite (which normally uses `pnpm test:backend`):
1. `cd apps/backend && DATABASE_URL="postgresql://buildflow:buildflow@localhost:5432/buildflow_test?schema=public" pnpm exec prisma migrate reset --force --skip-seed`
2. Seed it to completion, then kill the (hung) seed process by PID once `Seed complete` prints.
3. `pnpm --filter @buildflow/backend test` (jest uses `--forceExit`, so it exits cleanly).

Seed logins: `owner@reddyconst.com` / `Test@1234` (also `pm@`, `site@`, `accounts@reddyconst.com`);
platform admin `admin@buildflow.com` / `Admin@1234`.

### Known pre-existing failures (not environment problems)

- **Tests:** on a clean seed, 75 pass / 12 fail (suites: `material-rate`, `material-rate-variance`,
  `procurement`, `daily-report`, `estimate-links`). These are business-logic/value mismatches, not
  infra/connection issues.
- **Lint:** `pnpm lint` fails early because `@buildflow/shared` has no ESLint config (its `eslint .`
  matches no files) and `@buildflow/mobile` extends the uninstalled `eslint-config-expo`. Backend lint
  runs: `pnpm --filter @buildflow/backend lint` (it reports pre-existing lint errors).
- **Build:** `@buildflow/mcp-server` has pre-existing TypeScript errors; `shared`, `backend`, and
  `mobile` build fine (`pnpm --filter @buildflow/backend build`).

### Host tooling note

`scripts/ensure-test-db.sh` / `scripts/test-backend.sh` shell out to a host `psql`, so
`postgresql-client` must be installed on the VM (it is in the current snapshot).
