# BuildFlow - Technical Overview

**For developers, engineers, DevOps, and anyone extending or maintaining BuildFlow.**

This document is the engineering reference for the BuildFlow codebase: architecture, data model, request lifecycle, auth, multi-tenancy, the mobile app, integrations, environment, and every cross-module flow. It is intentionally exhaustive so a new engineer can navigate the system without reverse-engineering it.

Companion documents:
- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md) - non-technical, business-facing
- [BUSINESS_GUIDE.md](./BUSINESS_GUIDE.md) - onboarding, roles, pricing, support
- [ESTIMATES.md](./ESTIMATES.md) - deep dive on the estimation domain
- [CROSS_MODULE_INTEGRATION.md](./CROSS_MODULE_INTEGRATION.md) - write/read/invalidation map

---

## Table of contents

1. [Product in one paragraph](#1-product-in-one-paragraph)
2. [Monorepo layout & tooling](#2-monorepo-layout--tooling)
3. [Tech stack & versions](#3-tech-stack--versions)
4. [Backend architecture](#4-backend-architecture)
5. [Request lifecycle & middleware](#5-request-lifecycle--middleware)
6. [Multi-tenancy & data isolation](#6-multi-tenancy--data-isolation)
7. [Authentication & authorization](#7-authentication--authorization)
8. [Data model (all domains)](#8-data-model-all-domains)
9. [Shared package contract](#9-shared-package-contract)
10. [Mobile architecture](#10-mobile-architecture)
11. [Integrations architecture](#11-integrations-architecture)
12. [Background jobs & queues](#12-background-jobs--queues)
13. [Cross-module flows (detailed)](#13-cross-module-flows-detailed)
14. [Environment configuration](#14-environment-configuration)
15. [Local development & commands](#15-local-development--commands)
16. [Testing strategy](#16-testing-strategy)
17. [API conventions & error envelope](#17-api-conventions--error-envelope)
18. [Conventions, money, and audit](#18-conventions-money-and-audit)
19. [Implementation status](#19-implementation-status)
20. [Glossary](#20-glossary)

---

## 1. Product in one paragraph

BuildFlow is a **multi-tenant SaaS platform for Indian civil-engineering and construction firms**. It unifies **estimation, BOQ, planning (WBS/CPM), daily site operations, procurement, subcontracting, accounting (GST/TDS/RA billing/Tally export), an AI assistant, client & subcontractor portals, and platform administration** into one system. The same codebase runs as a React Native (Expo) app on **web, iOS, and Android**, backed by an Express + Prisma + PostgreSQL + Redis API. It is built by **Jora AI** (Hyderabad).

---

## 2. Monorepo layout & tooling

BuildFlow is a **pnpm + Turborepo monorepo**. The root `package.json` defines orchestration scripts; `turbo.json` defines the task pipeline; `pnpm-workspace.yaml` declares the workspaces.

```
buildflow/
├── apps/
│   ├── backend/            # @buildflow/backend - Express + Prisma API
│   └── mobile/             # @buildflow/mobile - Expo React Native app
├── packages/
│   └── shared/             # @buildflow/shared - Zod schemas, types, enums, constants
├── docs/                   # Markdown documentation (this file lives here)
├── scripts/                # test-backend.sh, ensure-test-db.sh
├── docker-compose.yml      # Postgres 15 + Redis 7 for local dev
├── turbo.json              # Turbo task pipeline
├── pnpm-workspace.yaml     # workspace declarations
├── .env / .env.example     # environment (loaded from repo root)
└── package.json            # root scripts (dev, build, lint, test, db:*)
```

### Workspaces

| Workspace | Package name | Purpose |
|-----------|--------------|---------|
| `apps/backend` | `@buildflow/backend` | REST API, business logic, Prisma, jobs |
| `apps/mobile` | `@buildflow/mobile` | Expo Router app (web + native) |
| `packages/shared` | `@buildflow/shared` | Zod validators, TS types, enums, constants, pricing utils |

### `turbo.json` pipeline

| Task | Behavior |
|------|----------|
| `build` | `dependsOn: ["^build"]` - builds dependencies first; outputs `dist/**` |
| `dev` | `persistent: true`, not cached - runs all workspaces concurrently |
| `lint` | Runs after `^build` |
| `test` | Runs after `^build`; outputs `coverage/**` |
| `typecheck` | Runs after `^build` |
| `clean` | Not cached |

`globalDependencies: [".env"]` means changing `.env` invalidates all caches. `globalEnv: ["NODE_ENV"]`.

### Tooling notes

- **pnpm overrides** (`package.json` > `pnpm.overrides`) pin the entire `metro` family to `0.80.12` and NativeWind/Reanimated to known-good versions to avoid Expo SDK 52 resolution conflicts.
- **`onlyBuiltDependencies`** allows Prisma and esbuild native builds.
- **Prettier** config lives at the root (`.prettierrc`, `.prettierignore`); `pnpm format` formats the whole repo.

---

## 3. Tech stack & versions

| Layer | Technology | Version / detail |
|-------|-----------|------------------|
| Runtime | Node.js | `>= 20.0.0` |
| Package manager | pnpm | `10.24.0` |
| Orchestrator | Turborepo | `^2.0.3` |
| **Backend** | | |
| Web framework | Express | layered routes/controllers/services |
| ORM | Prisma | `@prisma/client`, Postgres provider |
| DB | PostgreSQL | 15 (Docker) |
| Cache/queue | Redis | 7 (Docker) |
| Validation | Zod | shared schemas from `@buildflow/shared` |
| Auth | JWT (access + refresh) + bcrypt | access 15m, refresh 7d |
| Logging | Winston + Morgan | morgan streams into winston |
| Security | Helmet, CORS, express-rate-limit | |
| Files | AWS S3 (presigned URLs) | default + company BYOK |
| Queue | BullMQ (Redis-backed) | `lib/queue.ts` |
| Payments | Razorpay + Stripe | HMAC webhook verification |
| Messaging | Twilio (WhatsApp + SMS) | |
| AI | OpenAI-compatible LLM proxy | BYOK supported |
| **Mobile** | | |
| Framework | React Native (Expo) | SDK 52 |
| Routing | Expo Router | file-based, groups |
| Styling | NativeWind 4 + Tailwind | `tailwind.config.js` |
| State | Zustand | `stores/` |
| Server state | React Query (TanStack) | offline-first stale times |
| Storage | expo-secure-store, expo-file-system | tokens + downloads |
| Maps (optional) | react-native-maps + expo-location | web shims provided |
| **Shared** | | |
| Language | TypeScript | `^5.4.5` |

---

## 4. Backend architecture

The backend lives in `apps/backend/src/` and follows a strict **layered architecture**:

```
HTTP request
  → app.ts (helmet, cors, compression, morgan, rateLimiter)
  → routes/*.routes.ts          (URL mounting, validation, auth guards)
  → controllers/*.controller.ts (HTTP glue: parse req, call service, send response)
  → services/*.service.ts       (business logic, Prisma calls, cross-module side-effects)
  → lib/prisma.ts               (Prisma client with ALS auto-scoping)
  → PostgreSQL
```

### `app.ts` - the composition root

`src/app.ts` builds the Express app **without calling `listen()`** (so supertest can import it in tests). `src/server.ts` is what actually binds the port.

Key ordering in `app.ts`:

1. `helmet()`, `cors()` (origin from `CORS_ORIGIN` comma list), `compression()`.
2. **Raw-body capture for webhooks** *before* JSON parsing:
   - `/api/webhooks/razorpay`, `/api/webhooks/saas`, `/api/webhooks/stripe` use `express.raw({ type: '*/*' })` so the HMAC signature can be verified against the exact bytes.
3. `express.json({ limit: '1mb' })` + `express.urlencoded()`.
4. `morgan` HTTP logging streamed into Winston (skips `/health`).
5. `/health` mounted **before** the global rate limiter.
6. `/api` gets `apiLimiter`.
7. All feature routers mounted under `/api/*`.
8. `notFoundHandler` + `errorHandler` mounted last.

### Route mounting map (`app.ts`)

| Mount path | Router | Scope |
|-----------|--------|-------|
| `/health` | `healthRouter` | Unauthenticated |
| `/api/auth` | `authRouter` | Login, refresh, invites, company registration |
| `/api/projects` | `projectRouter`, `taskRouter`, `boqRouter`, `reportRouter`, `invoiceProjectRouter`, `billProjectRouter`, `changeOrderRouter`, `procurementRouter`, `subcontractProjectRouter`, `portalProjectRouter` | Project-scoped (`/:id/...`) |
| `/api/tasks` | `taskDetailRouter` | Task CRUD by id |
| `/api/resources` | `resourceRouter` | Company resource/material library |
| `/api/boq` | `boqDetailRouter` | BOQ items by id |
| `/api/rate-analysis` | `rateAnalysisRouter` | Rate analysis library |
| `/api` | `estimateRouter`, `financialReportRouter`, `paymentRouter` | Mixed project + company endpoints |
| `/api/reports` | `reportDetailRouter` | Daily report by id |
| `/api/invoices` | `invoiceRouter` | Invoice by id |
| `/api/bills` | `billRouter` | Bill by id |
| `/api/chatbot` | `chatbotRouter` | AI assistant |
| `/api/notifications` | `notificationRouter` | In-app notifications |
| `/api/reports/pdf` | `pdfReportRouter` | 12 PDF report downloads |
| `/api/analytics` | `analyticsRouter` | OWNER dashboard |
| `/api/settings` | `settingsRouter` | Company profile, users, audit, integrations, billing, material prices, rate regions, tickets |
| `/api/platform` | `platformRouter` | BuildFlow internal admin |
| `/api/subcontractors` | `subcontractorRouter` | Subcontractor directory |
| `/api/portal` | `portalPublicRouter` | Public client portal `/:token` |
| `/api/portal/sub` | `subPortalPublicRouter` | Public subcontractor portal |
| `/api/proposals` | `proposalRouter` | Pre-project quoting |

### Directory structure (`apps/backend/src/`)

| Folder | Responsibility |
|--------|----------------|
| `config/` | `env.ts` (Zod-validated env), `logger.ts` (Winston) |
| `lib/` | `prisma.ts`, `redis.ts`, `als.ts` (AsyncLocalStorage), `s3.ts`, `queue.ts` (BullMQ) |
| `middleware/` | `auth.ts`, `validate.ts`, `audit.ts`, `rateLimiter.ts`, `error.ts` |
| `routes/` | Express routers (one per domain) |
| `controllers/` | HTTP handlers |
| `services/` | Business logic (the largest folder) |
| `utils/` | `jwt.ts`, `password.ts`, `errors.ts` (`ApiError`), `response.ts` (`ok`/`fail`), `audit.ts`, `geo.ts`, `cache.ts` |
| `types/` | `express.d.ts` (augments `Request` with `user`) |
| `jobs/` | `notification.worker.ts`, `subscription.cron.ts` |
| `__tests__/` | `setup.ts`, `unit/`, `integration/`, `__mocks__/` |
| `prisma/` | `schema.prisma`, `seed.ts`, `migrations/` |

### Services inventory (one per domain)

`analytics, attendance, auth, bill, boq, change-order, chatbot, daily-report, estimate, estimate-export, export-zip, financial-report, gst, integration, invite, invoice, material-demand, material-rate, material-rate-alert, material-rate-variance, notification, ops-notification, payment, pdf-report, platform, portal, procurement, project, project-material-rate, project-member, proposal, rate-analysis, rate-region, report-schedule, resource, saas-billing, settings, subcontract, subcontract-portal, subscription, task, tally, ticket, twilio`.

> **Pattern:** services never touch `req`/`res`. They take typed arguments, call Prisma, and throw `ApiError` on failure. Cross-module side effects (e.g. payment → journal entry) are invoked from within services.

---

## 5. Request lifecycle & middleware

A typical authenticated, validated, audited request flows through these middleware in order:

```
helmet → cors → compression → rawBody(json) → morgan
  → apiLimiter (global, on /api)
  → router-level: authenticateToken → [optionalAuth] → requireRole(...) → validate({ body, query, params })
  → controller (calls service)
  → audit (writes AuditLog)  [on mutating routes]
  → errorHandler (catches ApiError, ZodError, Prisma errors)
```

### Middleware reference

| Middleware | File | Purpose |
|-----------|------|---------|
| `authenticateToken` | `middleware/auth.ts` | Verifies access JWT, checks Redis blacklist, sets `req.user`, runs downstream inside `companyALS` |
| `optionalAuth` | `middleware/auth.ts` | Attaches `req.user` if a valid token exists, never 401s (used on public routes that personalize when logged in) |
| `requireRole(...roles)` | `middleware/auth.ts` | Role guard; must follow `authenticateToken` |
| `validate({ body, query, params })` | `middleware/validate.ts` | Parses with Zod schemas; on failure → `ApiError.validation(details)` (422) |
| `apiLimiter` / auth limiter | `middleware/rateLimiter.ts` | `express-rate-limit`; auth routes have a stricter limiter |
| `audit` | `middleware/audit.ts` | Writes `AuditLog` for mutating actions (old/new values, ip) |
| `errorHandler` / `notFoundHandler` | `middleware/error.ts` | Converts every thrown error into the standard envelope |

### Standard response envelope

All JSON responses (see `utils/response.ts`) use:

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }

// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field": "email", "message": "Invalid email" }] } }
```

`apiFetch` (mobile) unwraps `data`; `apiFetchList` returns `{ data, meta }`.

### Error mapping (`error.ts`)

| Source | Result |
|--------|--------|
| `ZodError` | `VALIDATION_ERROR` 422 with field details |
| `ApiError` | Pass-through with its status/code |
| Prisma `P2002` (unique) | `CONFLICT` 409; friendly messages for `po_number` / `grn_number` |
| Prisma `P2025` (not found) | `NOT_FOUND` 404 |
| Prisma `P2003` (FK) | `VALIDATION_ERROR` 422 ("Referenced record does not exist") |
| Prisma validation error | `VALIDATION_ERROR` 422 |
| Payload too large | `VALIDATION_ERROR` 422 ("File too large max 10MB") |
| Malformed JSON | `BAD_REQUEST` 400 |
| Unknown | logged with stack; 500 (generic in production, message in dev) |

---

## 6. Multi-tenancy & data isolation

BuildFlow is **multi-tenant by `companyId`**. Every tenant-scoped model has a `companyId` column. Isolation is enforced by **two complementary mechanisms**:

### 6.1 Prisma auto-scoping via AsyncLocalStorage

`lib/prisma.ts` registers a `$use` middleware that reads the **company ALS store** (set by `authenticateToken`) and **auto-injects `companyId`** into `where` for read actions on tenant models:

```ts
const TENANT_SCOPED_MODELS = new Set([
  'User', 'Project', 'Resource', 'RateAnalysis', 'MaterialPriceHistory',
  'RateRegion', 'Invoice', 'Bill', 'JournalEntry', 'ChatMessage',
  'AuditLog', 'Estimate',
]);
const READ_ACTIONS = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy']);
```

This means a service calling `prisma.project.findMany({})` inside a request will only ever return the caller's company's projects. The store is set by `companyALS.run({ companyId, userId }, () => next())` in `authenticateToken`.

### 6.2 Explicit checks

For models **not** in the auto-scope set (e.g. `BOQItem`, `Task` - which inherit tenancy through `projectId`), services explicitly verify ownership (load the parent project and compare `companyId`). Write actions (`create`, `update`, `delete`) are **not** auto-scoped, so services must pass `companyId` explicitly.

### 6.3 ALS context

`lib/als.ts` exposes:

- `companyALS` - the `AsyncLocalStorage<CompanyContext>` instance
- `runInCompanyContext(ctx, fn)` - used by jobs/cron to run code "as" a company
- `getCompanyId()` - throws if called outside a request context

---

## 7. Authentication & authorization

### 7.1 Two auth systems

| System | Model | Used by | Login route |
|--------|-------|---------|-------------|
| Company auth | `User` (role: OWNER/PM/SUPERVISOR/ACCOUNTANT) | Construction company staff | `/api/auth/login` |
| Platform auth | `PlatformAdmin` | BuildFlow/Jora AI staff | `/api/platform/login` |

Both issue JWTs but with different claims and secrets.

### 7.2 JWT design (`utils/jwt.ts`)

- **Access token**: `JWT_ACCESS_SECRET`, default expiry `15m`, claim `type: 'access'`, includes `sub`, `companyId`, `role`, `tid` (token id).
- **Refresh token**: `JWT_REFRESH_SECRET`, default expiry `7d`, claim `type: 'refresh'`.
- Secrets must be `>= 16` chars (env validation).
- **Blacklist**: access tokens are revocable via Redis (`lib/redis.ts` `isTokenBlacklisted`) keyed by `tid` - used on logout/password change.

### 7.3 Password hashing

`utils/password.ts` uses bcrypt with `BCRYPT_COST` (default 12, range 8-15).

### 7.4 Invite-based onboarding

`UserInvite` stores `tokenHash` (not raw tokens), `role`, `expiresAt` (default `INVITE_TOKEN_EXPIRES_DAYS` = 7). The owner invites; the invitee consumes a token at signup. `@@unique([companyId, email])` prevents duplicate pending invites.

### 7.5 Company registration

Controlled by `ALLOW_PUBLIC_COMPANY_REGISTRATION` (default `true`). On registration a company is created with `subscriptionStatus = TRIAL` and `trialEndsAt = now + TRIAL_DAYS` (default 14).

### 7.6 Role enforcement

- **Server**: `requireRole('OWNER', 'PM')` guards routes.
- **Client**: `ROLE_TABS` (in `apps/mobile/constants/index.ts`) maps each role to visible tabs.

| Role | Tabs (mobile) |
|------|---------------|
| `OWNER` | dashboard, projects, proposals, planning, reports, accounting, settings |
| `PM` | dashboard, projects, proposals, planning, reports, accounting |
| `SUPERVISOR` | dashboard, projects, reports |
| `ACCOUNTANT` | dashboard, accounting, reports |

`notifications` is universal (all roles); `chat` is overlay-only (FAB, not in nav).

### 7.7 Mobile token refresh (`lib/api-client.ts`)

The mobile client stores access + refresh tokens in `expo-secure-store`. On a `401` (non-auth route) it:
1. Sets `isRefreshing`, calls `refreshAccessToken()` → `POST /auth/refresh`.
2. Queues concurrent 401s into `failedQueue`; once refreshed, `processQueue(token)` replays them.
3. On refresh failure → `useAuthStore.logout()` and `SESSION_EXPIRED` error.

---

## 8. Data model (all domains)

The schema (`apps/backend/prisma/schema.prisma`) defines **~40 models** across 9 domains. All money fields use `@db.Decimal(14, 2)` (rates `Decimal(12, 2)`, quantities `Decimal(12, 3)`). UUIDs everywhere (`@db.Uuid`).

### 8.1 Identity & tenancy

| Model | Notes |
|-------|-------|
| `Company` | Tenant root. GSTIN unique. Holds `subscriptionPlan`, `subscriptionStatus`, `trialStartsAt/EndsAt`, `saasPaymentRef`. |
| `User` | `companyId`, `role`, `passwordHash`, `notificationPrefs` (JSON), `isActive`. Many back-relations to authored/approved entities. |
| `UserInvite` | Token-hash invite flow; `@@unique([companyId, email])`. |
| `CompanyIntegration` | Per-company provider settings (JSON). `@@unique([companyId, provider])`. |
| `SupportTicket` | Company + platform scoped (`TicketScope`); categories incl. `INTEGRATION_SETUP`, `BILLING`, `BUG`. |
| `PlatformAdmin` / `PlatformAuditLog` | BuildFlow internal staff + their audit trail. |

**Enums**: `Role`, `SubscriptionPlan` (STARTER/PROFESSIONAL/ENTERPRISE), `SubscriptionStatus` (TRIAL/ACTIVE/PAST_DUE/CANCELLED/EXPIRED), `TicketCategory`, `TicketStatus`, `TicketScope`, `IntegrationProvider` (TWILIO/RAZORPAY/STRIPE/TALLY/GOOGLE_MAPS/LLM/S3).

### 8.2 Projects & planning

| Model | Notes |
|-------|-------|
| `Proposal` | Pre-project quote. Has a **temporary** `Project` (`isTemporary=true`); on win, `promotedProjectId` links the real project. Status: DRAFT→IN_REVIEW→APPROVED→SENT→WON/LOST/ARCHIVED. |
| `Project` | `type` (HEAVY/LARGE/MID/mini), `status`, `budget` Decimal, geo (`locationLat/Lng/Address`), `rateRegionId`, soft delete (`isDeleted`), `proposalId`. |
| `ProjectMember` | Project-scoped access (`@@unique([projectId, userId])`). |
| `WBSItem` | Self-referential (`parentId`) hierarchy with `code`, `level`, `orderIndex`. |
| `Task` | `wbsId`, dates, `durationDays`, `progressPct`, `status` (NOT_STARTED/IN_PROGRESS/COMPLETED/DELAYED/ON_HOLD), `constraintType` (ASAP/ALAP/MUST_*), `isMilestone`. |
| `TaskPredecessor` | Dependencies with `type` (FS/SS/FF/SF) + `lagDays`. |
| `TaskResource` | Planned resource allocation per task (`quantity`, `rate`, `totalCost`). |

**CPM scheduling**: `services/cpm.service.ts` computes critical path from tasks + predecessors + constraints.

### 8.3 Resources, rate analysis & pricing

| Model | Notes |
|-------|-------|
| `Resource` | Company material/labour/equipment/subcontractor library. `unit`, `rate`, `gstRate`, `hsnSacCode`, `brandOrSpec`, `category`, `imageUrl`. Soft delete. |
| `RateAnalysis` | Composite rate (e.g. "RCC M25") built from components. `stale` flag recomputed when component rates change. |
| `RateAnalysisComponent` | Links to `Resource` (or `miscName`) with `quantityPerUnit`. |
| `MaterialPriceHistory` | Effective-dated rate changes (audit trail). |
| `RateRegion` / `RegionalMaterialRate` | Location-aware pricing. Region→resource→rate→effectiveDate. |
| `ProjectMaterialRate` | Project-specific overrides (`@@unique([projectId, resourceId])`). |

### 8.4 Estimation & BOQ

| Model | Notes |
|-------|-------|
| `Estimate` | `version`, `status` (DRAFT/REVIEWED/APPROVED/REJECTED/SUPERSEDED), full cost breakdown (material/labour/equipment/subcontractor/misc), margins (`overheadPct`, `contingencyPct`, `profitMarginPct`), `grandTotal`. |
| `EstimateSection` | Group of items (e.g. Substructure, Finishing). |
| `EstimateItem` | qty × rate; optional `resourceId` / `rateAnalysisId`; `type` CostType; optional `wbsItemId`. Has a 1:1 `BOQItem` back-relation after conversion. |
| `BOQItem` | Working quantity schedule. `executedQty`, `procuredQty`, `isSuperseded`, `estimateItemId` link. |

See [ESTIMATES.md](./ESTIMATES.md) for the full estimation domain logic.

### 8.5 Daily operations

| Model | Notes |
|-------|-------|
| `DailyReport` | `@@unique([projectId, reportDate])`, `siteStatus`, `workDone`, `issues`, `photos[]`, `workersCount`. |
| `MaterialUsage` | Material consumed in a report; optional `taskId`/`boqItemId`; `boqMeasurementPosted` flag prevents double-posting. |
| `DailyReportTaskUpdate` | Progress updates linked to tasks. |
| `BoqMeasurement` | Measured quantities (audit-grade); `recordedBy`. |
| `Attendance` | Geo-fenced check-in/out: `checkInLat/Lng`, `distanceFromSite` (m), `withinFence`. |

### 8.6 Accounting

| Model | Notes |
|-------|-------|
| `Invoice` | `invoiceType` (STANDARD/RUNNING_ACCOUNT/MILESTONE), full GST split (cgst/sgst/igst), TDS, RA fields (`raSequence`, `previousCertifiedTotal`, `currentCertifiedTotal`, `cumulativeCertifiedTotal`), retention. |
| `InvoiceLineItem` | Per-line GST, HSN, RA cumulative quantities, `certifiedAmount`. |
| `Bill` | Vendor bills; `category` (MATERIAL/LABOUR/EQUIPMENT/SUBCONTRACTOR/OTHER), TDS, `retentionAmount`, `advanceRecoveryAmount`, `paidAmount`, `isRetentionRelease`. Links to PO / work order / measurement. |
| `JournalEntry` | Double-entry records; auto-created on payment events. |

**GST logic** in `services/gst.service.ts`: intra-state → CGST+SGST split; inter-state → IGST. **Tally export** in `services/tally.service.ts` builds Tally-Prime import XML (`GET /api/projects/:id/financials/export-tally`) using per-company ledger names (`CompanyIntegration` `TALLY`, including Retention / Advance Recovery) with `TALLY_LEDGER_MAP` env fallback. In-app download: Project Accounting and Reports Hub → **Export to Tally**.

### 8.7 Procurement & inventory

Full **Indent → PO → GRN → Stock** chain:

| Model | Notes |
|-------|-------|
| `MaterialRequisition` (Indent) | `status` ApprovalStatus, `sourceType/sourceRef` for traceability. |
| `MaterialRequisitionLine` | `resourceId`, `quantity`, `expectedRate`, `rateSource`, optional `boqItemId`. |
| `PurchaseOrder` | `poNumber` unique per company, `vendorName`, `totalAmount`. |
| `PurchaseOrderLine` | qty/rate/amount per resource. |
| `GoodsReceiptNote` (GRN) | `grnNumber` unique, `receivedDate`. |
| `GoodsReceiptLine` | Received quantities. |
| `StockLocation` / `StockBalance` / `StockMovement` | Per-site/per-company stock with IN/OUT/ADJUST movements. |

### 8.8 Subcontractors

| Model | Notes |
|-------|-------|
| `Subcontractor` | Directory; `defaultTdsRate`. |
| `SubcontractWorkOrder` | `woNumber`, `contractValue`, `retentionPct`, `advanceAmount`, `status` (DRAFT/ACTIVE/COMPLETED/CANCELLED), `retentionReleasedAt`. |
| `SubcontractWorkOrderLine` | Contract lines with `contractQty`. |
| `SubcontractMeasurement` | Periodic measurement sheet; ApprovalStatus; on approval → auto-creates a `Bill`. |
| `SubcontractMeasurementLine` | Measured quantities; `boqMeasurementPosted`. |

### 8.9 Portals

| Model | Notes |
|-------|-------|
| `ClientPortalAccess` | Token-hash, `scopes[]`, `expiresAt`. Public route `/api/portal/:token`. |
| `SubcontractorPortalAccess` | Same pattern for subcontractors; `/api/portal/sub/:token`. |

### 8.10 Platform & reporting

| Model | Notes |
|-------|-------|
| `Notification` | Per-user; `type`, `referenceId`, `isRead`. |
| `AuditLog` | `entityType/entityId`, `oldValue/newValue` (JSON), `ipAddress`. |
| `ReportSchedule` | Cron-based scheduled reports (`GST_SUMMARY`, `TDS_REPORT`, `COMPANY_DASHBOARD`, `PROJECT_PL`). |
| `ChatMessage` | AI assistant history; `isBot`, optional `projectId`. |
| `PlatformAuditLog` | BuildFlow staff actions on companies. |

---

## 9. Shared package contract

`packages/shared` is the **single source of truth** for types and validation shared by frontend and backend. Both import `@buildflow/shared`.

### Exports (`src/index.ts`)

```ts
export * from './enums';        // Role, ProjectType, statuses, etc.
export * from './types';        // DTO interfaces (AuthUser, etc.)
export * from './validators';   // Zod schemas (loginSchema, projectSchema, ...)
export * from './constants';    // Shared constants
export * from './pricing';      // Pricing rules
export * from './utils/date';   // Date helpers
```

Plus standalone utilities:

| Function | Purpose |
|----------|---------|
| `formatINR(n)` | Indian grouping: `₹1,23,456.78` |
| `formatINRCompact(n)` | `₹1.2L`, `₹3.4Cr`, `₹12.5K` |
| `numberToWords(n)` | "One Lakh Twenty Thousand Rupees Only" (for invoices) |
| `round2(n)` | GST-safe 2-decimal rounding |

### Validators (`src/validators/`)

`auth.ts, common.ts, project.ts, task.ts, boq.ts, resource.ts, estimate.ts, report.ts, accounting.ts, chat.ts, settings.ts` - each exporting Zod schemas reused by the backend `validate()` middleware and the mobile forms.

---

## 10. Mobile architecture

The mobile app is a **single Expo Router codebase** that runs on web, iOS, and Android. Directory: `apps/mobile/`.

### 10.1 Route groups (`app/`)

| Group | Purpose | Auth |
|-------|---------|------|
| `(public)/` | Marketing: landing (`index`), `pricing`, `about` | None |
| `(auth)/` | `login`, `forgot-password`, `signup/` (company + invite) | None |
| `(app)/` | The main authenticated app (role-aware) | Required |
| `platform/` | BuildFlow internal admin console | Platform admin |
| `portal/` | Public client portal `/[token]` + `sub/[token]` | Token |

### 10.2 Role-aware navigation (`(app)/_layout.tsx`)

- Reads `useAuthStore` for `user` + `isAuthenticated`; redirects to `/login` if unauthenticated.
- Desktop (`useViewport().isDesktop`): renders `AppSidebar` (grouped nav) + `AppTopBar` + `AppDesktopFooter`.
- Mobile: renders `AppMobileHeader` + `AppTabBar` (primary tabs: dashboard, projects, planning, reports; overflow in a menu).
- Tabs are filtered via `getAllowedTabs(role)`; `HIDDEN_TAB_SCREENS` hides nested detail routes from the tab navigator.
- `AssistantFab` + `AssistantOverlay` render globally (the AI assistant); `/chat` redirects to dashboard and closes the overlay.
- `OfflineBanner` shows connectivity status.

### 10.3 Navigation config (`constants/navigation.ts`)

- `TAB_CONFIG` - label/icon/href per tab.
- `NAV_GROUPS` - sidebar grouping (Workspace / Operations / Finance / Alerts / Admin).
- `getBreadcrumbs()` - builds the top-bar breadcrumb trail (handles `returnTo` for nested project routes).
- `BRAND_IMAGES` - Unsplash hero images (sidebar texture, login, dashboard, planning).

### 10.4 State management (`stores/`)

| Store | Purpose |
|-------|---------|
| `auth.store.ts` | Auth state, login/logout, user |
| `app.store.ts` | Global UI state |
| `assistant.store.ts` | Assistant overlay open/close |
| `estimation.store.ts` | Estimate wizard multi-step state |
| `offline-queue.store.ts` | Offline mutation queue |
| `onboarding.store.ts` | First-run onboarding |
| `platform.store.ts` | Platform admin state |

### 10.5 Data fetching (`services/*.queries.ts`)

Each domain has a queries file exposing **React Query hooks** (`useProjects`, `useCreateInvoice`, etc.) built on `apiFetch`/`apiFetchList`. Stale times are tiered (`constants/index.ts`): project list 5m, tasks 2m, resources/rate-analysis 1h, user profile 30m.

### 10.6 Offline-first design

- React Query caches serve stale data when offline (`OfflineBanner` indicates status).
- `offline-queue.store.ts` + `offline-sync.service.ts` queue mutations and replay on reconnect.
- `lib/project-query-invalidation.ts` centralizes invalidation bundles (see [CROSS_MODULE_INTEGRATION.md](./CROSS_MODULE_INTEGRATION.md)).

### 10.7 Downloads

`apiDownload()` handles PDF/Excel/Zip/JSON exports: web → browser download; native → `expo-file-system` write. Token refresh + 401 retry is built in.

### 10.8 Platform-specific shims

`shims/` provides web fallbacks for `react-native-maps`, `expo-location`, `expo-secure-store`, `expo-file-system` so the web build compiles.

---

## 11. Integrations architecture

BuildFlow distinguishes **company-owned integrations** from **platform services**. This is a business-critical distinction (see [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)).

### 11.1 Company-owned integrations (`CompanyIntegration`)

Stored per-company (`@@unique([companyId, provider])`) with settings JSON. Providers (`IntegrationProvider` enum):

| Provider | Use | Env vars (optional) |
|----------|-----|---------------------|
| `TWILIO` | WhatsApp + SMS to the company's clients | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM` |
| `RAZORPAY` | Indian client invoice payments | `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| `STRIPE` | International client payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `TALLY` | Ledger mapping for Tally XML export | `TALLY_LEDGER_MAP` |
| `GOOGLE_MAPS` | Site location, navigation, attendance | `GOOGLE_MAPS_API_KEY` |
| `LLM` | BYOK AI assistant | `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` |
| `S3` | BYOK file storage | `AWS_*` |

### 11.2 Platform services (BuildFlow-owned)

- **SaaS subscription billing**: `SAAS_RAZORPAY_*` / `SAAS_STRIPE_*` - charges companies for their BuildFlow plan (separate from client-payment integrations).
- **Default LLM**: `gpt-4o-mini` unless overridden.
- **Default S3**: `AWS_S3_BUCKET` (default `buildflow-dev`).
- **Ops alerts**: `INTERNAL_OPS_EMAIL` / `INTERNAL_OPS_WEBHOOK_URL` for new trials / expiring subscriptions.

### 11.3 Webhook verification

Webhook routes capture the **raw body** before JSON parsing (see [§4](#4-backend-architecture)) so HMAC signatures can be verified against exact bytes. Endpoints:

- `/api/webhooks/razorpay` - client invoice payments
- `/api/webhooks/saas` - BuildFlow subscription payments
- `/api/webhooks/stripe` - international client payments

---

## 12. Background jobs & queues

| File | Purpose |
|------|---------|
| `lib/queue.ts` | BullMQ queue(s) on Redis |
| `jobs/notification.worker.ts` | Processes notification dispatch (Expo push, WhatsApp, SMS) |
| `jobs/subscription.cron.ts` | Trial expiry checks (sends reminders at 7/3/1 days), auto-EXPIRED status |
| `services/plan-enforcement.service.ts` | SUB-PLAN1: Enforces `PLAN_LIMITS` (maxProjects, maxUsers) on project create (`project.service.ts`) + user invite (`invite.service.ts`) — 402 on limit reached. Trial uses STARTER limits. |
| `services/report-schedule.service.ts` | Cron-driven report generation (`ReportSchedule`) |

Jobs run within `runInCompanyContext()` so the ALS-based Prisma scoping applies.

---

## 13. Cross-module flows (detailed)

These are the end-to-end flows that span multiple services. Each lists the **write path**, **read/summary path**, and **invalidation** (from [CROSS_MODULE_INTEGRATION.md](./CROSS_MODULE_INTEGRATION.md)).

### 13.1 Estimate → BOQ conversion

1. PM builds estimate (DRAFT) → submits (REVIEWED) → Owner approves (APPROVED).
2. Owner **Converts to BOQ** (`boq.service.convertToBOQ`):
   - Archives existing BOQ lines (`isSuperseded = true`).
   - Creates one `BOQItem` per `EstimateItem` (links `estimateItemId`).
   - Updates `Project.budget = estimate.grandTotal`.
3. Any prior APPROVED estimate on the project → `SUPERSEDED`.

### 13.2 Invoice payment

- **Write**: `invoice.service.recordPayment` → `Invoice.paidAmount` (+ status → PAID).
- **Read**: Project P&L, analytics revenue.
- **Invalidation**: Accounting + project summary.
- **Side effect**: `JournalEntry` created when integrations active.

### 13.3 Bill payment

- **Write**: `bill.service.recordBillPayment` → `Bill.paidAmount`.
- **Read**: work-order `paidTotal`, project `paidSpend`.
- **Invalidation**: `invalidateBillPaymentImpact(projectId)`.

### 13.4 Subcontractor certification

- **Write**: `approveMeasurement` → creates `Bill` (with retention) on the measurement.
- **Read**: WO summary `retentionHeld`, `paidTotal`.
- **Invalidation**: Subcontract + BOQ.

### 13.5 Work order completion

- **Write**: `updateWorkOrder(COMPLETED)` → generates retention-release `Bill`.
- **Read**: WO summary `retentionReleased`.
- **Invalidation**: Subcontract + accounting.

### 13.6 Change order (variation) approval

- **Write**: `change-order` approve → updates BOQ + linked WO value.
- **Read**: WO summary `variationTotal`.
- **Invalidation**: `invalidateChangeOrderImpact`.

### 13.7 Procurement GRN

- **Write**: GRN → `StockMovement` (IN) → updates `StockBalance` → `BOQItem.procuredQty`.
- **Read**: BOQ `procuredQty`.
- **Invalidation**: Procurement + BOQ.

### 13.8 Daily report → BOQ measurement

- Daily report `MaterialUsage` (when `boqItemId` set) posts a `BoqMeasurement` (guarded by `boqMeasurementPosted` flag).
- This updates `BOQItem.executedQty` - **independent** of subcontract certification (separate paths).

### 13.9 Proposal → Project

- Proposal creates a **temporary** `Project` (`isTemporary = true`) for quoting.
- On WON, `promote` creates the real project (`isTemporary = false`) and links `promotedProjectId` / `Project.proposalId`.

### 13.10 RA (Running Account) billing

- `Invoice` with `invoiceType = RUNNING_ACCOUNT`, `raSequence`, cumulative quantities on `InvoiceLineItem` (`previousQty`, `currentQty`, `cumulativeQty`, `certifiedAmount`).
- `retentionPct` / `retentionAmount` held back.
- PDF export produces RA bill + measurement book.

### Spend semantics (project summary)

| Field | Definition |
|-------|------------|
| `committedSpend` | Σ `bill.total` for APPROVED/PAID bills |
| `paidSpend` | Σ `bill.paidAmount` for APPROVED/PAID bills |
| `budgetUtilizationPct` | `committedSpend / budget` |

---

## 14. Environment configuration

`apps/backend/src/config/env.ts` validates all env vars with Zod and throws on invalid config. The loader walks up from CWD to find `.env` (monorepo root).

### Required

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | Postgres URL |
| `JWT_ACCESS_SECRET` | ≥ 16 chars |
| `JWT_REFRESH_SECRET` | ≥ 16 chars |

### Defaults

| Var | Default |
|-----|---------|
| `NODE_ENV` | `development` |
| `PORT` | `4000` |
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `BCRYPT_COST` | `12` |
| `CORS_ORIGIN` | `http://localhost:8081` |
| `RATE_LIMIT_AUTH_MAX` / window | `10` / `900000ms` (15 min) |
| `RATE_LIMIT_API_MAX` / window | `200` / `60000ms` (1 min) |
| `AWS_REGION` | `ap-south-1` |
| `AWS_S3_BUCKET` | `buildflow-dev` |
| `S3_PRESIGN_EXPIRY_SECONDS` | `900` (15 min) |
| `LLM_MODEL` | `gpt-4o-mini` |
| `ALLOW_PUBLIC_COMPANY_REGISTRATION` | `true` |
| `INVITE_TOKEN_EXPIRES_DAYS` | `7` |
| `APP_PUBLIC_URL` | `http://localhost:8081` |
| `TRIAL_DAYS` | `14` |

### Optional (integrations)

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `TALLY_LEDGER_MAP`, `TWILIO_*`, `RAZORPAY_*`, `STRIPE_*`, `GOOGLE_MAPS_API_KEY`, `LLM_API_URL`, `LLM_API_KEY`, `EXPO_ACCESS_TOKEN`, `INTERNAL_OPS_EMAIL`, `INTERNAL_OPS_WEBHOOK_URL`, `SAAS_RAZORPAY_*`, `SAAS_STRIPE_*`.

`LOG_LEVEL`: `error | warn | info | debug | verbose` (default `info`).

---

## 15. Local development & commands

### First-time setup

```bash
pnpm install           # install all workspace deps
pnpm db:up             # docker compose up -d (Postgres 15 + Redis 7)
cp .env.example .env   # then edit: openssl rand -hex 32 (twice) for JWT secrets
pnpm db:migrate        # prisma migrate deploy
pnpm db:seed           # seed demo data
pnpm dev               # turbo run dev (backend + mobile concurrently)
```

### Ports

| Service | URL |
|---------|-----|
| Backend API | `http://localhost:4000` |
| Health | `GET http://localhost:4000/health` |
| Metro bundler | `http://localhost:8081` |
| Mobile web | `http://localhost:19006` |

### Root scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm test:backend` | Reset isolated test DB + run backend tests (`scripts/test-backend.sh`) |
| `pnpm typecheck` | TypeScript type-check (no emit) |
| `pnpm db:up` / `db:down` | Start/stop Postgres + Redis |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed sample data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm format` / `format:check` | Prettier write/check |

### Seed users

**Password for all tenant users:** `Test@1234`

#### Construction — Reddy Constructions Pvt Ltd (PROFESSIONAL)

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@reddyconst.com` | `Test@1234` |
| PM | `pm@reddyconst.com` | `Test@1234` |
| DPM | `dpm@reddyconst.com` | `Test@1234` |
| QC | `qc@reddyconst.com` | `Test@1234` |
| Mechanical Manager | `mechanical@reddyconst.com` | `Test@1234` |
| Store Incharge | `store@reddyconst.com` | `Test@1234` |
| Weighbridge | `weighbridge@reddyconst.com` | `Test@1234` |
| Site Supervisor | `site@reddyconst.com` | `Test@1234` |
| Accountant | `accounts@reddyconst.com` | `Test@1234` |

Login: main app `/login` → construction dashboard / projects.

#### Inventory — Hyderabad Building Materials (INVENTORY plan)

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@hydmaterials.com` | `Test@1234` |
| Inventory Manager | `manager@hydmaterials.com` | `Test@1234` |

Login: main app `/login` → redirects to **`/inventory`** shell (Stock, Materials, Procurement, Invoices, Bills, Settings). Seed includes 4 materials with opening stock.

#### Platform admin

| Role | Email | Password |
|------|-------|----------|
| Platform admin | `admin@buildflow.com` | `Admin@1234` |

Use **`/platform/login`** (not the main company login).

### Running specific targets

```bash
# Backend only
cd apps/backend && npx tsx src/server.ts

# Mobile web build
cd apps/mobile && npx expo export -p web && npx serve -s dist/

# Mobile native
cd apps/mobile && npx expo start
```

---

## 16. Testing strategy

### Backend (`jest.config.js`)

- **Unit tests** (`__tests__/unit/`) - pure functions (e.g. `utils.test.ts`).
- **Integration tests** (`__tests__/integration/`) - supertest against the Express app with an **isolated test database** (reset per run via `scripts/test-backend.sh` + `scripts/ensure-test-db.sh`).
- **Mocks**: `__mocks__/archiver.js` for zip/export tests.
- `__tests__/setup.ts` configures the test environment.

Run with `pnpm test:backend` (resets the test DB first) or `pnpm --filter @buildflow/backend test`.

### Mobile (`jest.config.js`)

- `__tests__/navigation.test.ts` - validates route guards and role-based tab visibility.

### Cross-module testing checklist

From [CROSS_MODULE_INTEGRATION.md](./CROSS_MODULE_INTEGRATION.md): every feature PR should include a happy-path integration test + two edge cases (or document why N/A), use isolated projects or `afterAll` cleanup, and wire API + hook + UI + invalidation in the same PR.

---

## 17. API conventions & error envelope

### Success

```jsonc
{ "success": true, "data": T, "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }
```

### Error

```jsonc
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "string",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

### Common error codes

`VALIDATION_ERROR` (422), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `BAD_REQUEST` (400), `INTERNAL_ERROR` (500). Mobile `ApiError` mirrors `{ code, message, status, details }`.

### Pagination

List endpoints accept `page` + `limit` query params and return `meta`. The mobile `apiFetchList` helper returns `{ data, meta }`.

---

## 18. Conventions, money, and audit

### Money

- All monetary amounts: `@db.Decimal(14, 2)`.
- Rates: `@db.Decimal(12, 2)`; GST rates: `Decimal(5, 2)`.
- Quantities: `@db.Decimal(12, 3)`.
- Use `round2()` (shared) for GST-safe rounding.
- Display via `formatINR` / `formatINRCompact`; invoice amounts in words via `numberToWords`.

### Naming

- Prisma models: `PascalCase`; tables: `snake_case` via `@@map`.
- Columns: `camelCase` in TS, `snake_case` in DB via `@map`.
- Routes: `/api/<resource>` (plural); project-scoped nested under `/api/projects/:id/...`.

### Audit

- `audit.ts` middleware + `utils/audit.ts` helper write `AuditLog` rows for mutating actions with `oldValue`/`newValue` JSON and `ipAddress`.
- Platform actions write `PlatformAuditLog`.

### Soft delete

`Resource.isDeleted`, `Project.isDeleted` - records are retained for audit; queries filter `isDeleted = false`.

---

## 19. Implementation status

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation & Auth (multi-tenant, roles, JWT) | ✅ Complete |
| 2 | Project Management (WBS, Tasks, Gantt/CPM, BOQ) | ✅ Complete |
| 2.5 | Cost Estimation (Rate Analysis, Estimates, Export) | ✅ Complete |
| 3 | Daily Operations & Site Management | ✅ Complete |
| 4 | Accounting & Finance (GST, TDS, Tally Export, RA) | ✅ Complete |
| 5 | Notifications, Chatbot & Integrations | ✅ Complete |
| 6 | Reports, Analytics & Polish | 🔄 In progress |

### Recent "Construction Platform Expansion" (10 items, delivered as 5 phased PRs)

Proposals · Change Orders/Variations · RA Billing · Procurement (Indent→PO→GRN→Stock) · Subcontractors · Material pricing regions · Progress/Materials workflow · Cross-module integration · Client + Subcontractor portals · Bill retention release.

Migration history (`prisma/migrations/`) mirrors this: `platform_expansion_pr1`, `proposals`, `progress_materials_workflow`, `cross_module_integration`, `material_pricing_regions`, `requisition_expected_rate`, `boq_procurement_links`, `daily_report_site_status`, `subcontract_enhancements`, `bill_retention_release`.

### Inventory product (INVENTORY_PRODUCT_IMPL)

A separate **Inventory** subscription product (₹999/mo ex-GST) for stock + procurement + AR/AP invoicing + Tally + AI, shipped without breaking construction tenants:

- **Plans / modules** — `packages/shared/src/plan-modules.ts` (`ProductMode`, `AppModule`, `PLAN_MODULES`, `getProductMode`). INVENTORY gets `inventory_shell, procurement, stock, invoices, bills, tally, assistant, settings`; construction plans get every module.
- **Default project** — inventory signup (`registerCompany` with `product: 'inventory'`) or a platform switch-to-INVENTORY (`updateSubscriptionAsAdmin`) creates **one hidden project** `code='STORE'` and sets `Company.defaultProjectId` (unique FK). `/auth/me` (+ login/accept-invite payloads) return `productMode`, `defaultProjectId`, `enabledModules`, `subscriptionPlan`.
- **Limits** — `PLAN_LIMITS.INVENTORY = { maxProjects: 1, maxUsers: 10 }`; `assertPlanAllowsProject` keeps INVENTORY at 1 even during trial and returns a dedicated 402 message. The default STORE project cannot be soft-deleted.
- **Role** — `INVENTORY_MANAGER` (`Role` enum + shared defaults): stock, procurement, invoices, bills, Tally, financials, reports. Hidden from construction invite dropdowns; construction roles are hidden from inventory invites (`INVITABLE_ROLES_BY_PRODUCT`, enforced in `invite.service.ts` + `settings.service.ts` role updates). Invited inventory users are auto-added to the default project's members.
- **Module gates** — `module-gate.service.ts` (`assertModuleEnabled`) + `middleware/module-gate.ts` (`requireModule`, `requireModuleForPaths`). Path-aware gates are used on routers mounted at shared prefixes (`/api` estimate router, `/api/projects` task/report/change-order/subcontract routers) so unrelated project-scoped routes (invoices, bills, procurement, stock) pass through for inventory tenants.
- **Shell UI** — `apps/mobile/app/inventory/` (real route segment, not a group): Stock, Procurement, Invoices, Bills, Settings. Product-aware redirects in `app/index.tsx`, `(app)/_layout.tsx`, login, and signup (`?product=inventory`). Marketing pricing (`constants/marketing.ts`) adds an Inventory ₹999 card; shared `pricing.ts` is the single source of truth.
  - **Procurement pickers (PROCUREMENT_PICKER_PERF)** — New PO lists only APPROVED indents with zero POs (one PO per indent, enforced server-side with a 400 on a second PO); New GRN lists non-cancelled POs that are not fully received, prefill remaining qty, and reject a GRN on a fully received PO with 400. Eligibility helpers live in `@buildflow/shared` (`indentAvailableForNewPo`, `poAvailableForNewGrn`, `isPoFullyReceived`, `poRemainingByResource`) and are shared with the construction `ProcurementTab`. PO mutations invalidate only the requisition list; GRN additionally invalidates stock (never whole-project BOQ).
- Inventory shell Stock home supports **manual stock issue (OUT)** via `POST /projects/:id/procurement/stock/issue` (`stock.manage`). **Materials** catalog screen lets OWNER / INVENTORY_MANAGER add SKUs (`POST /resources`).
- Happy-path inventory tests assert stock balance after GRN and after issue.
- **Pricing** — `PLAN_PRICES_INR`: INVENTORY 999 / STARTER 1999 / PROFESSIONAL 4999 / ENTERPRISE `null` (contact sales). Annual = ×10 monthly. ENTERPRISE checkout is blocked in `createSaasCheckout`.

---

## 20. Glossary

| Term | Meaning |
|------|---------|
| **BOQ** | Bill of Quantities - the working quantity schedule derived from an approved estimate |
| **CPM** | Critical Path Method - scheduling algorithm (`cpm.service.ts`) |
| **WBS** | Work Breakdown Structure - hierarchical task decomposition |
| **RA Bill** | Running Account bill - cumulative progress billing with retention |
| **GST** | Goods & Services Tax (India); split into CGST/SGST (intra-state) or IGST (inter-state) |
| **TDS** | Tax Deducted at Source |
| **HSN/SAC** | Harmonized System Nomenclature / Services Accounting Code |
| **GRN** | Goods Receipt Note - records material receipt against a PO |
| **PO** | Purchase Order |
| **Indent** | Material Requisition - internal request that can become a PO |
| **Retention** | Percentage withheld from a subcontractor/vendor until completion |
| **Measurement Book** | Auditable record of measured quantities (RA billing) |
| **BYOK** | Bring Your Own Key - company provides its own API keys |
| **ALS** | AsyncLocalStorage - Node mechanism for per-request context |
| **Tenant** | A `Company`; all data is isolated by `companyId` |

---

*Last updated: June 2026 · Reflects codebase at the platform-expansion milestone.*