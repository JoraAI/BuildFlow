# BuildFlow

**Civil Engineering Project Planning & Accounting Platform**
*India's construction industry - built for the field, designed for the boardroom.*

Product by **Jora AI** (jora.co.in) · Hyderabad, India

---

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Mobile:** React Native (Expo SDK 52) · NativeWind 4 · Expo Router · Zustand · React Query
- **Backend:** Node.js 20 · Express · TypeScript · Prisma · PostgreSQL 15 · Redis
- **Shared:** `packages/shared` - Zod schemas, types, enums, constants

## Structure

```
buildflow/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── backend/         # Express + Prisma API
├── packages/
│   └── shared/          # Shared Zod schemas, types, constants
├── docker-compose.yml   # Postgres 15 + Redis 7
├── turbo.json
└── package.json
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Postgres + Redis)
pnpm db:up

# 3. Configure env
cp .env.example .env
# Edit .env - generate JWT secrets:
#   openssl rand -hex 32   (run twice: access + refresh)

# 4. Run database migrations + seed
pnpm db:migrate
pnpm db:seed

# 5. Start everything (backend + mobile)
pnpm dev
```

### Backend

- API: `http://localhost:4000`
- Health: `GET http://localhost:4000/health`

### Mobile

- Metro: `http://localhost:8081`
- Web: `http://localhost:19006`

### Seed Users

| Role        | Email                  | Password     |
| ----------- | ---------------------- | ------------ |
| Owner       | owner@reddyconst.com   | Test@1234    |
| PM          | pm@reddyconst.com      | Test@1234    |
| Supervisor  | site@reddyconst.com    | Test@1234    |
| Accountant  | accounts@reddyconst.com| Test@1234    |

## Common Commands

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Start all apps in dev mode               |
| `pnpm build`     | Build all packages                       |
| `pnpm lint`      | Lint all packages                        |
| `pnpm test`      | Run all tests                            |
| `pnpm test:backend` | Reset isolated test DB + run backend tests |
| `pnpm typecheck` | TypeScript type-check (no emit)          |
| `pnpm db:up`     | Start Postgres + Redis containers        |
| `pnpm db:down`   | Stop containers                          |
| `pnpm db:migrate`| Apply Prisma migrations                  |
| `pnpm db:seed`   | Seed sample data                         |
| `pnpm db:studio` | Open Prisma Studio                       |
| `pnpm format`    | Format all files with Prettier           |

## Implementation Status

- Phase 1 - Foundation & Auth ✅ Complete
- Phase 2 - Project Management (WBS, Tasks, Gantt, BOQ) ✅ Complete
- Phase 2.5 - Cost Estimation (Rate Analysis, Estimates, Export) ✅ Complete
- Phase 3 - Daily Operations & Site Management ✅ Complete
- Phase 4 - Accounting & Finance (GST, TDS, Tally Export) ✅ Complete
- Phase 5 - Notifications, Chatbot & Integrations ✅ Complete
- Phase 6 - Reports, Analytics & Polish 🔄 In Progress

## Running the App

### Web (browser)
cd apps/mobile && npx expo export -p web
npx serve -s dist/

### Native (iOS/Android)
cd apps/mobile && npx expo start

### Backend
cd apps/backend && npx tsx src/server.ts
