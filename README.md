# BuildFlow

**Civil Engineering Project Planning & Accounting Platform**
*India's construction industry - built for the field, designed for the boardroom.*

Product by **Jora AI** (jora.co.in) · Hyderabad, India

---

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Mobile:** React Native (Expo SDK 52) · NativeWind 4 · Expo Router · Zustand · React Query
- **Backend:** Node.js 20 · Express · TypeScript · Prisma · PostgreSQL 15 · Redis 7
- **Shared:** `packages/shared` - Zod schemas, types, enums, constants, pricing, subscription limits
- **AI:** OpenAI-compatible LLM proxy with permission-aware prompting

## Structure

```
buildflow/
├── apps/
│   ├── mobile/          # Expo React Native app (web + iOS + Android)
│   ├── backend/         # Express + Prisma API
│   └── mcp-server/      # MCP server for external AI tool access
├── packages/
│   └── shared/          # Shared Zod schemas, types, enums, constants, pricing
├── docs/                # Technical docs, product overview, estimates guide
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

### Ports

| Service        | URL                          |
| -------------- | ---------------------------- |
| Backend API    | `http://localhost:4000`      |
| Health check   | `GET http://localhost:4000/health` |
| Metro bundler  | `http://localhost:8081`      |
| Mobile web     | `http://localhost:19006`     |

## Common Commands

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | Start all apps in dev mode                   |
| `pnpm build`         | Build all packages                           |
| `pnpm lint`          | Lint all packages                            |
| `pnpm test`          | Run all tests                                |
| `pnpm test:backend`  | Reset isolated test DB + run backend tests   |
| `pnpm typecheck`     | TypeScript type-check (no emit)              |
| `pnpm db:up`         | Start Postgres + Redis containers            |
| `pnpm db:down`       | Stop containers                              |
| `pnpm db:migrate`    | Apply Prisma migrations                      |
| `pnpm db:seed`       | Seed sample data (NH-45 project + lifecycle) |
| `pnpm db:studio`     | Open Prisma Studio                           |
| `pnpm format`        | Format all files with Prettier               |

**Deploying for testing?** See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) (Vercel + Render + Neon + Upstash).

---

## Feature Highlights

### Estimation & BOQ
- **Composite Rate Analysis** library (119 RAs - PCC, RCC, plastering, painting, etc.) with material/labour/equipment components
- **Estimate builder**: Multi-section estimates with margins (overhead, contingency, profit), DRAFT → REVIEWED → APPROVED workflow
- **Estimate → BOQ conversion**: Items linked bidirectionally; project budget auto-updated
- **BOQ with Sections & Categories**: View toggle between section grouping and category grouping (MATERIAL, LABOUR, EQUIPMENT, SUBCONTRACTOR)

### Procurement & Inventory
- Full **Indent → PO → GRN → Stock** chain with stock movements (IN/OUT/ADJUST)
- **Auto-generated indents** from estimate conversion and change orders
- **Vendor bills** with AI-assisted extraction from PDF/images
- **Project + regional material pricing** with rate variance alerts

### Subcontracting
- **Work orders** (DRAFT → ACTIVE → COMPLETED) with contract lines, retention %, advance recovery
- **Measurement sheets** (DRAFT → SUBMITTED → APPROVED/REJECTED) with automatic bill creation on approval
- **GC-supplied material issues** with stock deduction and BOQ linkage
- **Retention release** bills on WO completion

### Accounting & Finance
- **Invoices**: Standard, Running Account (RA), and Milestone types
- **GST**: Auto CGST/SGST (intra-state) or IGST (inter-state) split
- **TDS**: Vendor and subcontractor TDS deduction
- **Tally XML export** with configurable ledger mapping
- **RA billing** with cumulative quantities, retention, and measurement book PDFs

### Planning & Daily Operations
- **WBS + CPM scheduling** with FS/SS/FF/SF dependencies and lag
- **Daily reports**: Weather, site status, work done, material usage, task progress
- **Attendance** with geo-fencing (check-in/out with distance from site)
- **BOQ measurement posting** from daily report material usage

### Proposals & Change Orders
- **Pre-construction proposals** with temporary projects, DRAFT → WON/LOST workflow
- **Change orders/variations** with schedule impact (days), cost impact, and BOQ quantity adjustments
- Auto-generated procurement indents for variation material demands

### Portals
- **Client portal**: Token-based access for clients to view project progress, invoices, and RA bills
- **Subcontractor portal**: Token-based access for subcontractors to view work orders and measurements

### Subscription & Plan Limits (SUB-PLAN1 + INVENTORY_PRODUCT)
- **Plan tiers**: INVENTORY (1 store / 10 users), STARTER (3 projects / 5 users), PROFESSIONAL (25 / 25), ENTERPRISE (unlimited, contact sales)
- **Prices (ex-GST)**: INVENTORY ₹499/mo · STARTER ₹1,999/mo · PROFESSIONAL ₹4,999/mo · ENTERPRISE custom
- **Inventory product**: separate signup path (`?product=inventory`) → hidden default `STORE` project, inventory-only shell (Stock | Materials | Procurement | Invoices | Bills | Settings), `INVENTORY_MANAGER` role with material catalog create + stock issue
- **Enforcement**: 402 on project create and user invite when limit reached
- **Trial**: STARTER limits apply during TRIAL (INVENTORY keeps 1-store limits on trial)
- **Billing UI**: Shows "X of Y projects/users used" on billing screen

### AI Assistant
- **Permission-aware prompting**: System prompt reflects the caller's actual permissions
- **Tool capabilities**: List/create resources, rate analyses, estimates, bills, invoices, projects, BOQ
- **MCP server**: External AI tool access with scoped permissions
- **Marketing assistant**: Pre-login product guide with pricing from shared constants

### PDF Reports (12 types)
- Estimate, Measurement Book, Abstract Sheet, BOQ vs Actual, P&L, Progress
- Subcontract Measurement Book, Subcontract Abstract Sheet
- Report branding (logo, colors) with watermark
- Excel export for estimates

---

## Documentation

| Document | Purpose |
|----------|---------|
| [TECHNICAL_OVERVIEW.md](./docs/TECHNICAL_OVERVIEW.md) | Engineering reference: architecture, data model, request lifecycle |
| [PRODUCT_OVERVIEW.md](./docs/PRODUCT_OVERVIEW.md) | Non-technical, business-facing overview |
| [ESTIMATES.md](./docs/ESTIMATES.md) | Deep dive on estimation domain logic |
| [CROSS_MODULE_INTEGRATION.md](./docs/CROSS_MODULE_INTEGRATION.md) | Write/read/invalidation map across modules |

---

## Implementation Status

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation & Auth (multi-tenant, roles, JWT) | ✅ Complete |
| 2 | Project Management (WBS, Tasks, Gantt/CPM, BOQ) | ✅ Complete |
| 2.5 | Cost Estimation (Rate Analysis, Estimates, Export) | ✅ Complete |
| 3 | Daily Operations & Site Management | ✅ Complete |
| 4 | Accounting & Finance (GST, TDS, Tally Export, RA Billing) | ✅ Complete |
| 5 | Notifications, Chatbot & Integrations | ✅ Complete |
| 6 | Reports, Analytics & Polish | ✅ Complete |

### Platform Expansion (delivered)
Proposals · Change Orders/Variations · RA Billing · Procurement (Indent→PO→GRN→Stock) · Subcontractors · Material pricing regions · Progress/Materials workflow · Cross-module integration · Client + Subcontractor portals · Bill retention release · Subscription plan enforcement · AI assistant with MCP

---

## Running the App

### Web (browser)
```bash
cd apps/mobile && npx expo export -p web
npx serve -s dist/
```

### Native (iOS/Android)
```bash
cd apps/mobile && npx expo start
```

### Backend only
```bash
cd apps/backend && npx tsx src/server.ts
```

---

## Testing

```bash
# Backend: reset test DB + run all tests
pnpm test:backend

# Or run directly (test DB must be seeded first)
SEED_ALLOW_TRUNCATE=1 pnpm --filter @buildflow/backend db:seed
pnpm --filter @buildflow/backend test
```

The test suite includes **134 integration tests** covering all modules with an isolated test database.

---

---

<p align="center">
  <strong>A product of <a href="https://jora.co.in">Jora AI</a></strong><br/>
  Hyderabad, India
</p>
