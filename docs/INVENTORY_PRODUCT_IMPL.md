# BuildFlow — Inventory Stock Product — Implementation Prompt (Deepseek-V4-Flash)

> **Audience:** Deepseek-V4-Flash (or any coding agent)  
> **Repo:** BuildFlow monorepo (`apps/backend`, `apps/mobile`, `packages/shared`)  
> **Goal:** Ship a separate **Inventory** subscription product (stock + procurement + AR/AP invoicing + Tally + AI) with a hidden default project and inventory-only UI shell — without breaking construction tenants.  
> **Also:** Cut SaaS prices to India-friendly levels (ex-GST).
>
> **Follow-up UX polish (post-ship):** see [`docs/INVENTORY_UX_POLISH.md`](./INVENTORY_UX_POLISH.md) — D1–D10 **code/doc complete**.  
> **Horizontal platform roadmap:** see [`docs/INVENTORY_HORIZONTAL_PLATFORM.md`](./INVENTORY_HORIZONTAL_PLATFORM.md) — **Phases 0–10 complete & verified** (agent release pre-flight done, incl. expo-camera plugin); **operator** still runs physical-device §31.4 smoke after native rebuild — see `INVENTORY_HORIZONTAL_PLATFORM.md` §10 / §31.4).  
> **Current Inventory price is ₹499/mo** (see `packages/shared/src/pricing.ts`); ignore outdated ₹999 figures in sections below if they conflict.

Do **not** recreate deleted `AUDIT_FINDINGS.md`. Prefer minimal diffs; match existing patterns.

---

## 0. Product decision summary (locked)

| Decision | Choice |
|----------|--------|
| Product | Separate **Inventory** plan / product mode |
| UX | Inventory **shell** — no construction “Projects” concept for end users |
| Data model | Auto-create **one hidden default project** (`STORE`) under the hood |
| Commerce | **Vendor bills (AP) + client/sales invoices (AR)** + payments |
| Tally | Sales + Purchase XML export against default project |
| AI | **Same** BuildFlow assistant; tool/prompt scoped to inventory + bills/invoices/Tally |
| Construction roles | Hidden from Inventory companies; `INVENTORY_MANAGER` hidden from construction companies |
| Signup | Dedicated inventory signup path + platform can assign plan |
| Marketing prices | **Exclusive of 18% GST** |

---

## 1. Pricing update (India — aggressive, ex-GST)

Update **all** of: [`packages/shared/src/pricing.ts`](../packages/shared/src/pricing.ts), [`apps/mobile/constants/marketing.ts`](../apps/mobile/constants/marketing.ts), assistant [`prompt-builder.ts`](../packages/shared/src/permissions/prompt-builder.ts), billing UI, and docs that quote old figures.

### Monthly (`PLAN_PRICES_INR`)

| Plan | Old | **New** |
|------|-----|---------|
| **INVENTORY** (new) | — | **₹999** |
| STARTER | ₹4,999 | **₹1,999** |
| PROFESSIONAL | ₹13,999 | **₹4,999** |
| ENTERPRISE | ₹39,999 | **Contact sales** — keep `null` / omit from self-serve checkout; marketing shows “Custom” |

### Annual (`PLAN_ANNUAL_INR`) — 2 months free = ×10 monthly

| Plan | New annual |
|------|------------|
| INVENTORY | **₹9,990** |
| STARTER | **₹19,990** |
| PROFESSIONAL | **₹49,990** |
| ENTERPRISE | Contact sales |

### Copy rules

- Always show `+ 18% GST` (keep `GST_PRICING_NOTE`).
- Align FAQ / assistant pricing text with `@buildflow/shared` — **single source of truth is `pricing.ts`**.
- Marketing Professional feature list currently says “Unlimited projects” while code limits PROFESSIONAL to 25 — **prefer code truth** (25 projects / 25 users) unless product later opens ENTERPRISE-only unlimited.

### Limits (`PLAN_LIMITS`)

| Plan | maxProjects | maxUsers |
|------|-------------|----------|
| INVENTORY | **1** (default store only) | **10** |
| STARTER | 3 | 5 |
| PROFESSIONAL | 25 | 25 |
| ENTERPRISE | null | null |

---

## 2. Architecture

```text
Inventory signup
    → Company(subscriptionPlan=INVENTORY)
    → Company.defaultProjectId = Project(code=STORE, name="Main Store")
    → User(OWNER)
    → productMode=inventory on /auth/me
    → App redirects to Inventory shell
         Stock | Procurement | Sales invoices | Vendor bills | Tally | Settings
         (all API calls use defaultProjectId)
```

Construction companies (`STARTER` / `PROFESSIONAL` / `ENTERPRISE`) unchanged: full modules, existing roles, no inventory shell.

---

## 3. Schema & shared types

### 3.1 Prisma

[`apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma):

1. `SubscriptionPlan` add `INVENTORY`.
2. `Role` add `INVENTORY_MANAGER`.
3. `Company` add optional `defaultProjectId String? @map("default_project_id")` (+ relation to `Project` if clean; otherwise resolve by `code === 'STORE'` — **prefer explicit FK**).

Migration + regenerate client.

### 3.2 Shared package

- [`packages/shared/src/enums/index.ts`](../packages/shared/src/enums/index.ts) — `Role.INVENTORY_MANAGER`, labels; **do not** put it on construction invite lists.
- New [`packages/shared/src/plan-modules.ts`](../packages/shared/src/plan-modules.ts):

```ts
export type ProductMode = 'construction' | 'inventory';

export type AppModule =
  | 'inventory_shell'
  | 'procurement'
  | 'stock'
  | 'invoices'      // client AR
  | 'bills'         // vendor AP
  | 'tally'
  | 'assistant'
  | 'settings'
  | 'estimates'
  | 'proposals'
  | 'planning'
  | 'reports_ops'
  | 'subcontracts'
  | 'change_orders'
  | 'projects_ui';  // construction projects navigator

export const PLAN_MODULES: Record<string, readonly AppModule[]> = {
  INVENTORY: [
    'inventory_shell', 'procurement', 'stock',
    'invoices', 'bills', 'tally', 'assistant', 'settings',
  ],
  STARTER: /* all construction modules */,
  PROFESSIONAL: /* all */,
  ENTERPRISE: /* all */,
};

export function getProductMode(plan: string): ProductMode {
  return plan === 'INVENTORY' ? 'inventory' : 'construction';
}
```

- Export from `packages/shared/src/index.ts`.
- Validators: allow `INVENTORY` in platform subscription update + SaaS checkout enums where self-serve is wanted.

---

## 4. Default project lifecycle

When an **INVENTORY** company is created (register with `product=inventory` / `plan=INVENTORY`):

1. Create project: `code: 'STORE'`, `name: 'Main Store'` (or `{companyName} Store`), status `IN_PROGRESS` or `PLANNING`.
2. Set `company.defaultProjectId`.
3. Skip construction onboarding / estimate tour.

Rules while plan is INVENTORY:

- `POST /projects` → **403/402** (“Inventory plan includes one store; upgrade for multi-project construction”).
- Cannot soft-delete / cancel the default store project.
- If platform **switches** an existing company onto INVENTORY and no default exists → create STORE project once.

`/auth/me` (and login payload) must include:

```ts
{
  productMode: 'inventory' | 'construction',
  defaultProjectId: string | null,
  enabledModules: AppModule[],
  subscriptionPlan: string,
}
```

---

## 5. Role: `INVENTORY_MANAGER`

Defaults in [`defaults.ts`](../packages/shared/src/permissions/defaults.ts):

- `project.view`
- Procurement: `view`, `create_indent`, `approve_indent`, `approve_po`, `record_grn`
- `stock.view`, `stock.manage`
- Invoices: `view`, `create`, `record_payment`
- Bills: `view`, `create`, `approve`, `record_payment`
- `tally.export`, `financials.view_amounts`, `financials.view_profit` (optional read), `reports.view`, `reports.download`
- `settings.tickets` (support)

No: estimate, planning, subcontract, change_order, proposal, attendance admin.

### Invite allow-lists

| Plan family | Invitable roles |
|-------------|-----------------|
| INVENTORY | `OWNER`, `INVENTORY_MANAGER` only |
| Construction | Existing roles **except** `INVENTORY_MANAGER` |

Wire invite UI + backend validation on invite create.

OWNER on inventory plan: full permissions already; shell is module-gated.

---

## 6. Inventory UI shell

New route group under mobile app, e.g. `apps/mobile/app/(app)/inventory/`:

| Route | Purpose |
|-------|---------|
| `index` / Stock | Stock summary + movements for `defaultProjectId` |
| `procurement` | Indent → PO → GRN (reuse [`ProcurementTab`](../apps/mobile/components/projects/ProcurementTab.tsx) logic without project picker) |
| `invoices` | Client/sales invoices (reuse accounting lists filtered to default project) |
| `bills` | Vendor bills + payments |
| `settings` | Users/invites, company profile, **Integrations → Tally**, billing/subscription |

Boot / layout:

- If `productMode === 'inventory'` → inventory tab bar / sidebar only; block `/projects`, `/estimation`, `/proposals`, planning, reports-hub construction reports, subcontract.
- If `construction` → existing app; never show inventory shell as primary.

Export to Tally: button on invoices/bills hub → existing `GET /projects/:id/financials/export-tally` with `defaultProjectId` ([Round 40](./GLM_FIX_PROMPT.md) download helper).

Marketing: pricing page card for **Inventory / Stock** at ₹999/mo.

---

## 7. Backend module gates

Add `assertModuleEnabled(companyId, module)` (near [`plan-enforcement.service.ts`](../apps/backend/src/services/plan-enforcement.service.ts)).

On INVENTORY plan return **403** for:

- estimate, proposal, planning/CPM, daily-report, attendance (optional), subcontract, change-order routes
- `POST /projects` (extra projects)

Allow: procurement, stock, invoice, bill, payment, tally export, settings (subset), chatbot.

Prefer injecting `defaultProjectId` when inventory clients omit `projectId` on list/create — or require mobile to always pass it from `/auth/me`. Pick one; document in code comments.

SaaS billing: support checkout for `INVENTORY` / `STARTER` / `PROFESSIONAL`; Enterprise remains contact-sales (no Razorpay amount or platform-only).

---

## 8. AI assistant (same product, scoped tools)

Existing chatbot / MCP tools should respect `productMode`:

1. System prompt branch: inventory companies get inventory persona (“You help with stock, POs, GRNs, sales invoices, vendor bills, and Tally export”) — no estimation/WBS advice.
2. Tool allow-list for inventory: stock summary, procurement status, invoices, bills, payments, tally export help — **deny** estimate/BOQ/subcontract/planning tools.
3. Marketing assistant may mention Inventory plan + new prices.

Reuse [`resolveLlmConfig`](../apps/backend/src/services/integration.service.ts) / company BYOK; no separate LLM product unless already env-based.

---

## 9. Tally

- Ledger map UI already under Settings → Integrations (sales, purchase, GST, TDS, retention, advance recovery, bank).
- Export uses Round 40 balanced vouchers; inventory tenants typically have both sales invoices and purchase bills on the STORE project.
- Ensure export button exists in inventory shell (not only construction Reports Hub).

---

## 10. Signup & subscription UX

1. Construction register → STARTER trial (existing) with **new** trial pricing display.
2. Inventory register → `subscriptionPlan=INVENTORY`, trial optional (same `TRIAL_DAYS` or document if inventory starts ACTIVE — **default: same trial as construction**), create STORE project, land on inventory home.
3. Billing settings: show plan name, limits (1 store / 10 users), upgrade path to construction plans if desired (optional stretch: “Upgrade to Starter/Pro for full construction ERP”).
4. Platform admin: can set plan to INVENTORY / update prices via shared constants only.

---

## 11. Implementation order (do in this sequence)

1. **Pricing + limits** in shared + marketing + prompt-builder (no behavioural risk).
2. Prisma enums + `defaultProjectId` migration.
3. `plan-modules.ts` + `/auth/me` fields + plan enforcement (1 project).
4. Default project on inventory company create + inventory signup path.
5. `INVENTORY_MANAGER` role + invite allow-lists.
6. API `assertModuleEnabled` on blocked routers.
7. Inventory shell UI + redirects.
8. Assistant prompt/tool scoping.
9. Tally entry points in inventory shell.
10. Tests + seed/docs.

---

## 12. Tests (required)

| Test | Expect |
|------|--------|
| Inventory signup | Company plan INVENTORY, STORE project, `defaultProjectId` set, `productMode=inventory` |
| Second project | 403/402 |
| Invite PM on inventory company | Rejected |
| Invite INVENTORY_MANAGER on construction | Rejected |
| Estimate / subcontract route as inventory user | 403 |
| Indent→PO→GRN→vendor bill→sales invoice | 200 paths for INVENTORY_MANAGER |
| Tally export | XML includes sales and/or purchase vouchers; amounts balance |
| Pricing constants | Marketing + checkout use 999 / 1999 / 4999 |
| Assistant | Inventory company cannot invoke estimate tools (if testable) |

---

## 13. Docs to update after code

- [`docs/PRODUCT_OVERVIEW.md`](./PRODUCT_OVERVIEW.md) — Inventory product section  
- [`docs/TECHNICAL_OVERVIEW.md`](./TECHNICAL_OVERVIEW.md) — plan modules + default project  
- [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) if env/checkout notes needed  
- [`README.md`](../README.md) pricing / plans table  
- Mark this prompt’s checklist done when shipping  

---

## 14. Anti-patterns

- Do not fork a second repo or duplicate Prisma models for “inventory project”.
- Do not show construction sidebar to `productMode=inventory`.
- Do not hardcode prices in mobile only — `pricing.ts` is source of truth.
- Do not allow unlimited projects on INVENTORY.
- Do not force construction onboarding on inventory signup.
- Do not expose `INVENTORY_MANAGER` in construction invite dropdowns.

---

## 15. Definition of done

- [x] New prices live everywhere (shared + marketing + assistant)
- [x] INVENTORY plan + default STORE project + productMode
- [x] Inventory shell with Stock, Procurement, Invoices, Bills, Tally, Settings
- [x] Role isolation both ways
- [x] Module API gates
- [x] Assistant scoped
- [x] Tests green
- [x] Product/technical docs updated

---

## Quick reference — key existing files

| Area | Path |
|------|------|
| Prices | `packages/shared/src/pricing.ts` |
| Limits | `packages/shared/src/subscription-limits.ts` |
| Roles / perms | `packages/shared/src/permissions/defaults.ts`, `catalog.ts` |
| Plan enforce | `apps/backend/src/services/plan-enforcement.service.ts` |
| Auth me | auth controllers / mobile auth store |
| Procurement UI | `apps/mobile/components/projects/ProcurementTab.tsx` |
| Accounting | `apps/mobile/app/(app)/accounting/*` |
| Tally | `apps/backend/src/services/tally.service.ts`, `report-download.ts` |
| Chatbot | `apps/backend/src/services/chatbot.service.ts`, `assistant-tools.service.ts` |
| Marketing pricing | `apps/mobile/constants/marketing.ts` |
