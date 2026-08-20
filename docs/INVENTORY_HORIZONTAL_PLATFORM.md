# BuildFlow Inventory - Horizontal Platform Plan (Deepseek-V4-Flash)

> **Audience:** Deepseek-V4-Flash (coding agent)  
> **Repo:** `/home/prasanna/work/BuildFlow`  
> **Product:** **BuildFlow Inventory** - stock-centric ERP for Indian businesses that buy, store, move, and sell **physical goods** (materials, products, equipment, spare parts).  
> **Sibling product:** **BuildFlow Construction ERP** - project-centric (estimates, BOQ, WBS, site ops). **Do not merge domain models.**  
> **Pricing (locked):** Inventory **₹499/mo**, **₹4,990/yr** ex-GST - see `packages/shared/src/pricing.ts`. Do not regress.  
> **Prior work:** [`INVENTORY_PRODUCT_IMPL.md`](./INVENTORY_PRODUCT_IMPL.md) (shipped MVP), [`INVENTORY_UX_POLISH.md`](./INVENTORY_UX_POLISH.md) (D1–D10 complete).
> **Next commercial pass:** Phase 11.7 + D11 are **code-complete**. Operator device smoke remaining. See [`INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md`](./INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md) and [`INVENTORY_UX_POLISH.md`](./INVENTORY_UX_POLISH.md) D11.

---

## 0. Executive summary - ChatGPT plan vs BuildFlow reality

The external “horizontal inventory platform” prompt is **directionally correct** for BuildFlow’s second product, but it is **not a single implementation pass**. It mixes:

- ✅ Things we **already ship** (procure → stock → issue → invoice/bill → Tally → assistant)
- ✅ Things that **fit BuildFlow** (dealers, distributors, hardware/industrial suppliers - same physical-goods DNA as construction materials)
- ⚠️ Things that need **schema + plan-tier** work (multi-warehouse, party master, sales orders)
- ❌ Things that are **out of scope** for BuildFlow brand near-term (restaurants, hospitals, payroll, full POS, full manufacturing MRP)
- ❌ Things that **conflict with shipped architecture** if done naively (rename `Resource` everywhere, fork apps, break construction procurement)

**BuildFlow name fit:** The platform is about the **flow** of physical resources through a business - construction sites **or** warehouses/trading counters. Horizontal inventory is an extension of that story, not a pivot to unrelated verticals.

**Agent rule:** Implement **one phase at a time**. Each phase ends with tests + construction regression + updated checklist in this doc.

---

## 1. Current baseline (verified in repo)

### 1.1 Shipped Inventory MVP

| Capability | Status | Key paths |
|------------|--------|-----------|
| Inventory plan + shell | ✅ | `plan-modules.ts`, `apps/mobile/app/inventory/*` |
| Hidden STORE project | ✅ | `Company.defaultProjectId`, `subscription-limits` INVENTORY maxProjects=1 |
| Item catalog | ✅ Partial | `Resource` type MATERIAL (+ EQUIPMENT enum exists); UI label “Materials” |
| Procurement | ✅ | Indent → PO → GRN; inventory auto-approve indent |
| Stock | ✅ | `StockLocation`, `StockBalance`, `StockMovement` IN/OUT/ADJUST |
| Bulk + single issue | ✅ | `issueStockManual`, multi-line draft invoice |
| Sales invoices (AR) | ✅ | `Invoice` + optional client phone/address |
| Vendor bills (AP) | ✅ | `Bill` + draft from GRN on INVENTORY |
| Tally XML | ✅ | Existing export |
| Assistant | ✅ | Shared `chatbot.service`; scoped by `productMode` (D10) |
| Permissions | ✅ Partial | Role defaults + granular permissions; not full warehouse roles yet |

### 1.2 Not built yet (gaps vs horizontal vision)

| Gap | Impact |
|-----|--------|
| ~~No **Customer** / **Vendor** master~~ | ✅ Phase 1 - Parties tab + invoice/bill picker |
| ~~**Single location**~~ | ✅ Phase 3 - multi-warehouse + transfers + stock counts |
| ~~No **Sales Order / Delivery Challan**~~ | ✅ Phase 2 - Sales tab: SO → DC → Invoice |
| ~~No **stock adjustment** UI~~ | ✅ Phase 1 - Adjust modal + audit reasons |
| ~~No **returns**~~ | ✅ Phase 2 - sales/purchase returns + CN/DN |
| ~~**SKU/barcode** identify~~ | ✅ Phase 3 - barcode lookup + Stock Find; batch/serial still later |
| ~~**credit limits** enforcement~~ | ✅ Phase 2 - ALLOW/WARN/BLOCK; price lists still later |
| **Business profile** onboarding | ✅ Phase 0 - `Company.inventoryProfile` + Settings picker |
| ~~**Reorder / PO approvals**~~ | ✅ Phase 4 - suggestions, one-click PO, approval bands |
| ~~**Landed cost / valuation / ledgers**~~ | ✅ Phase 5 - WAC, GRN landed cost, party ledgers, note issue |
| ~~**Executive analytics / plan tiers**~~ | ✅ Phase 6 - dashboard, stock health, margins |
| ~~**AI document / anomaly layer**~~ | ✅ Phase 7 - OCR draft bill, import mapping, anomalies, assistant tools |
| ~~**Scan ops / commercial polish**~~ | ✅ Phase 8 - image OCR, barcode camera, batch lite, billed margins, notifications |
| ~~**Dealer GTM polish**~~ | ✅ Phase 9 - price lists, Quote→SO, printable PDFs, payment reminders |
| ~~**Production hardening (optional)**~~ | ✅ Phase 10 - API smoke + 2 mobile bug fixes + expo-camera iOS permission config; live-device smoke still in §31.4 |
| **Kirana retail/wholesale vertical** | ✅ 11.1–11.7 in [`INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md`](./INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md); operator device smoke remaining |
| **Batch expiry + FEFO** | ✅ Phase 11.2 |
| **POS-style counter cart + sales tables** | ✅ Phase 11.3–11.4; 11.6 full-screen checkout tables |

### 1.3 Construction isolation (non-negotiable)

```
BuildFlow Platform (shared)
├── auth, billing, GST, documents, AI, audit, integrations
├── Resource catalog (SHARED - construction estimates + inventory items)
│
├── Construction ERP (project-centric)
│   └── ProcurementTab: Draft → Submit → Approve indents
│   └── BOQ, WBS, subcontracts, daily reports, RA invoices, …
│
└── Inventory ERP (stock-centric)
    └── Auto-approve indents; inventory shell; draft bill/invoice from GRN/Issue
```

**Never:**

- Auto-approve construction indents  
- Import construction-only modules into inventory shell  
- Fork `apps/mobile` into two repos  
- Break `Resource` for construction BOQ/estimate flows  

---

## 2. ChatGPT plan - section-by-section feasibility

Rating: **✅ Align** | **🟢 H** high feasibility soon | **🟡 M** medium | **🟠 L** large later | **🔴 D** defer | **⛔ X** reject for BuildFlow now | **✔️ Done** partial/full

| § | Topic | Verdict | Rating | BuildFlow notes |
|---|--------|---------|--------|-----------------|
| 1 | Product direction | ✅ | - | Stock-centric vs project-centric - **locked** |
| 2 | Tier 1 targets (dealers, distributors, industrial) | ✅ | 🟢 H | Same buyers as construction supply chain; primary GTM |
| 3 | Don't target restaurants/hospitals/HR | ✅ | ⛔ X | Keep out of marketing + onboarding options |
| 4 | Business type + item type enums | ✅ | 🟡 M | Add `Company.inventoryProfile` + extend `Resource` metadata - **don't** duplicate Item table yet |
| 5 | Full module tree (Sales/Warehouse/Parties/…) | ✅ aspirational | 🟠 L | Navigation grows **by phase**; hide unused modules |
| 6 | Rename Material→Item (terminology) | ✅ | 🟢 H | **UI labels + i18n map** first; DB stays `Resource` |
| 7 | Item Master 2.0 | ✅ | 🟡 M | Extend `Resource`: sku, barcode, brandId, conversion - migration + inventory UI |
| 8 | Variants | ✅ | 🟠 L | New `ResourceVariant` or SKU table - after Item Master |
| 9 | Tracking modes (batch/serial/expiry) | ✅ | 🟠 L | New tables on movements; not Phase 0–1 |
| 10 | Multi-warehouse | ✅ | 🟡 M | `StockLocation` already exists; need **multiple locations per company**, plan tier >1 store |
| 11 | Stock transfers | ✅ | 🟡 M | After multi-warehouse |
| 12 | Stock adjustments | ✅ | 🟢 H | `StockMovementType.ADJUST` exists - add API + UI + audit reason |
| 13 | Stocktake / physical count | ✅ | 🟡 M | After adjustments + optional multi-warehouse |
| 14 | Barcode / QR | ✅ | 🟡 M | Mobile scanner + `Resource.barcode`; after Item Master |
| 15 | Sales workflow (Quote→SO→DC→Invoice) | ✅ | 🟡 M | Phase 2; keep Issue→Invoice shortcut for small shops |
| 16 | Sales returns | ✅ | 🟡 M | Phase 2–3 |
| 17 | Purchase returns | ✅ | 🟡 M | Phase 2–3 |
| 18 | Customer & Vendor master | ✅ | 🟢 H | **High priority** - new Prisma models; link Invoice/Bill |
| 19 | Credit & payment terms | ✅ | 🟡 M | On Customer master + invoice warnings |
| 20 | Pricing engine / price lists | ✅ | 🟠 L | Phase 2+ |
| 21 | Procurement 2.0 (RFQ, MR) | ✅ | 🟠 L | Current Indent→PO→GRN sufficient for MVP horizontal |
| 22 | Reorder engine | ✅ | 🟡 M | `Resource.reorderPoint` + alert - after reports |
| 23 | AI demand forecasting | ✅ | 🔴 D | After 12+ months data |
| 24 | Landed cost | ✅ | 🟠 L | Phase 5 |
| 25 | Inventory valuation (FIFO/WAC) | ✅ | 🟠 L | Start with WAC on `Resource`/movements |
| 26–28 | Reports (inventory/sales/purchase) | ✅ | 🟡 M | Phase 6; start with stock ledger + low stock |
| 29 | Party ledger | ✅ | 🟡 M | After party master + AR/AP |
| 30 | GST layer | ✔️ Done partial | 🟢 H | HSN, GST on invoices/bills - extend, don't rewrite |
| 31 | Accounting provider abstraction | ✅ | 🟡 M | Event bus later; Tally stays |
| 32 | Equipment mode | ✅ | 🟠 L | `ResourceType.EQUIPMENT` exists - profile flag, not full rental ERP |
| 33 | Rental mode | ✅ | 🔴 D | Optional module; far from construction core |
| 34 | Bundles/kits | ✅ | 🟠 L | Phase 3+ |
| 35 | Mobile warehouse mode | ✅ | 🟡 M | Scan-first UI after barcode |
| 36–38 | AI assistant / document AI / anomalies | ✅ | 🔴 D | After D10 + reliable data; use content LLM |
| 39 | Notifications automation | ✅ | 🟡 M | Reuse notification infra |
| 40–43 | Business profiles / examples | ✅ | 🟡 M | Onboarding wizard - Phase 1 |
| 44–45 | SMB/Enterprise tiers | ✅ | 🟡 M | Extend `PLAN_MODULES` - INVENTORY_GROWTH later |
| 46 | Permission model expansion | ✅ | 🟡 M | Extend `packages/shared/src/permissions` - capability-based |
| 47 | Approval engine | ✅ | 🟠 L | Generic workflow - medium businesses |
| 48 | Audit trail | ✔️ Done partial | 🟢 H | Extend `recordAudit` for stock adjustments |
| 49 | Import center | ✅ | 🟢 H | Excel import for items + opening stock - high onboarding value |
| 50 | Integrations (Shopify, etc.) | ✅ | 🔴 D | API/webhooks first |
| 51 | Recommended navigation | ✅ | 🟡 M | Evolve `InventoryTabBar` per phase - don't big-bang |
| 52 | What NOT to build | ✅ | ⛔ X | Payroll, HR, CRM, full accounting ledger, MRP |
| 53–55 | Construction isolation / no fork | ✅ | - | **Locked** - matches repo |
| 56–60 | Roadmap / MVP / differentiator | ✅ | - | Adapted below as BuildFlow phases |

### 2.1 Corrections to apply (ChatGPT mistakes for this repo)

| ChatGPT says | BuildFlow truth |
|--------------|-----------------|
| Inventory ₹999/mo | **₹499/mo** - `packages/shared/src/pricing.ts` |
| Separate inventory-app codebase | **One monorepo** - `productMode` + `PLAN_MODULES` |
| Replace Material entity | **Extend `Resource`** - shared with construction catalog |
| `defaultProjectId` → warehouse | Evolve to **`StockLocation`** as warehouse; keep project FK for API compat until Phase 10 |
| Build AI first | **Inventory engine first** - AI document OCR is Phase 7 (see D10) |
| Full horizontal ERP day 1 | **Phased** - dealers can use current MVP today |

---

## 3. Locked product principles (Deepseek must not violate)

1. **BuildFlow Inventory** answers: *Where are my goods, how much, what did I buy/sell, what's owed, export to Tally?*  
2. **BuildFlow Construction** answers: *How do I execute this project?*  
3. **Shared:** `Resource` (careful), auth, company, GST math, Tally export, assistant infra, sequential IDs.  
4. **Inventory-only automation:** draft bill from GRN, draft invoice from issue - gated `subscriptionPlan === 'INVENTORY'`.  
5. **Terminology:** generic labels in inventory UI (“Items”, “Bulk issue”); construction keeps “Materials”, “Indent”, etc.  
6. **No scope explosion:** if a feature isn't in the current phase checklist, don't implement it.  
7. **Tests:** `inventory-product` + `procurement.test` must stay green; add construction DRAFT regression when touching procurement.  

---

## 4. BuildFlow phased roadmap (commercial order)

### Phase 0 - Architecture & terminology (first Deepseek pass)

**Goal:** Prepare horizontal platform without new business workflows.

| # | Deliverable | Feasibility |
|---|-------------|-------------|
| 0.1 | Add `Company.inventoryProfile` enum (RETAIL, WHOLESALE, DISTRIBUTION, TRADING, MATERIAL_SUPPLIER, EQUIPMENT, GENERAL) - optional, default GENERAL | 🟢 H |
| 0.2 | Add `packages/shared/src/inventory-labels.ts` - map generic ↔ construction aliases; inventory shell uses generic | 🟢 H |
| 0.3 | Document `Resource` as **shared item master** in code comments + this doc | 🟢 H |
| 0.4 | Extend `PLAN_MODULES` with **feature flags** (placeholder): `parties`, `multi_warehouse`, `sales_orders` - all false for INVENTORY today | 🟢 H |
| 0.5 | **No** Prisma breaking changes to construction tables | - |

**Exit:** Types compile; no user-visible breakage; checklist §5 updated.

---

### Phase 1 - Core inventory engine (highest commercial value)

| # | Feature | Notes |
|---|---------|-------|
| 1.1 | **Party master** - `Customer`, `Vendor` models; link Invoice/Bill optionally | 🟢 H |
| 1.2 | **Item Master 1.5** - `Resource`: sku, itemCode, barcode nullable, secondaryUnit, conversionFactor | 🟡 M |
| 1.3 | **Stock adjustment** - API + inventory UI; reason enum; `StockMovementType.ADJUST` | 🟢 H |
| 1.4 | **Opening stock** import - Excel/CSV via Import Center v1 | 🟢 H |
| 1.5 | **Basic reports** - stock ledger, low-stock (reorder point field), movement report | 🟡 M |
| 1.6 | **Multi-warehouse v1** - multiple `StockLocation` per company; INVENTORY plan still 1 default; prepare INVENTORY_GROWTH plan with maxLocations>1 | 🟡 M |

**Exit:** Dealer/distributor can run daily ops without retyping customer names; adjustments audited.

---

### Phase 2 - Transaction engine

Sales Order → Delivery Challan → Invoice (optional path); Purchase Return / Sales Return; Credit/Debit notes; payment terms on Customer; **keep** Issue→Invoice shortcut.

---

### Phase 3 - Warehouse ops

Barcode scan, batch/serial (basic), stock count, transfers, bins (Growth tier).

---

### Phase 4 - Procurement automation

Reorder alerts, preferred vendor, simple approval thresholds on PO.

---

### Phase 5 - Finance depth

Landed cost, weighted-average valuation, party ledger pages, GST enhancements (e-invoice later).

---

### Phase 6 - Analytics & tiers

Executive dashboard, dead/slow stock, margin reports; INVENTORY_GROWTH / BUSINESS plan flags.

---

### Phase 7 - AI (BuildFlow assistant + documents) - COMPLETE

Only after Phase 1–2 data quality:

- Document OCR → draft bill (content LLM via `resolveLlmConfig` - D10)  
- Import column mapping  
- Reorder suggestions / anomaly hints  
- **Not** a separate Deepseek product chat model  

---

### Phase 8 - Commercial polish & scan ops - COMPLETE

Highest-value leftovers after Phases 0–7 - keep construction isolation + ₹499 pricing locked.

| # | Feature | Notes |
|---|---------|-------|
| 8.1 | **Image OCR for invoice scan** | ✅ Tesseract.js so JPG/PNG work in Phase 7 extract path |
| 8.2 | **Barcode camera** | ✅ Native expo-camera overlay; **M1 (2026-08-20):** mobile-browser Scan now opens the camera too (`getUserMedia` + `BarcodeDetector`/`@zxing/browser`) - see `INVENTORY_UX_POLISH.md` § Mobile/PWA polish. Desktop web stays keyboard-only. |
| 8.3 | **Batch / lot lite** | ✅ Optional `batchCode` on GRN / Issue / DC → StockMovement |
| 8.4 | **Invoice↔resource link** | ✅ `InvoiceLineItem.resourceId` + billed margin source |
| 8.5 | **In-app notifications** | ✅ Low-stock / PO-rate / count variance via shared `notify()` |
| 8.6 | **UI polish** | ✅ `itemCode`; GRN + DC dispatch warehouse pickers |

**Do NOT in Phase 8:** FIFO, e-invoice IRP, e-way, full GL, RFQ, variants, rental ERP, new paid plans, forking apps.

---

### Phase 9 - Dealer GTM polish - COMPLETE

Close the last dealer-facing gaps before GTM scale - pricing, quotes, printable paperwork, payment nudges. Construction isolation + ₹499 locked.

| # | Feature | Notes |
|---|---------|-------|
| 9.1 | **Customer price lists** | ✅ Customer/default overrides; effective rate on SO / Issue / Invoice |
| 9.2 | **Quote → Sales Order** | ✅ Quote lifecycle + convert; Sales Quotes sub-tab |
| 9.3 | **Printable PDFs** | ✅ SO / DC / GRN PDF endpoints + mobile buttons |
| 9.4 | **Payment reminders** | ✅ Auto overdue notify + manual Remind on invoice detail |
| 9.5 | **AI bill line ↔ Resource** | ✅ `matchedResourceId` in billSnapshot locked by test |
| 9.6 | **UI polish** | ✅ Per-line batch; DC subset lines |

**Do NOT in Phase 9:** FIFO, e-invoice IRP, e-way, full GL, RFQ, variants, serial/expiry ERP, rental, new paid plans, forking apps.

---

### Phase 10 - Production hardening - COMPLETE

The commercial roadmap (Phases 0–9) is **complete**. Phase 10 is ops + bugfix only - not a feature dump.

| # | Deliverable | Notes |
|---|-------------|-------|
| 10.1 | Staging/prod smoke of Phases 0–9 | ✅ API/test matrix in §30 (camera/bell = live-device leftover) |
| 10.2 | Fix only concrete bugs found in smoke | ✅ Duplicate Reject CTA; Quote→SO query-key invalidation |
| 10.3 | Confirm migrations on staging/prod | ✅ Through `phase9_gtm`; migrate deploy no-op |
| 10.4 | Optional deferred (pick ≤1 if smoke clean) | ✅ Skipped (zero-risk) |

**Do NOT in Phase 10:** FIFO, e-invoice IRP, e-way, full GL, RFQ, variants, rental ERP, new paid plans, forking apps, rewriting Phase 0–9.

---

### Phase 11 - Kirana retail & wholesale (ACTIVE) - Deepseek-V4-Flash

Commercial follow-on after Phases 0–10. **Do not implement inside this file** - follow the dedicated checklist:

**[`INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md`](./INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md)**

| Sub-phase | Goal |
|-----------|------|
| 11.1 | Kirana vertical + tenant-copy starter item catalog (RETAIL/WHOLESALE only) — **DONE** |
| 11.2 | Batch manufacture/expiry + FEFO allocation (Construction untouched) — **DONE** |
| 11.3 | POS-style multi-item counter checkout (issue → invoice); formal SO unchanged — **DONE** |
| 11.4 | Desktop/tablet sales & stock tables; phone card/scan alternatives — **DONE** |
| 11.5 | Selective SKU library, Indian MRP, quantity intake — **DONE** |
| 11.6 | Inventory workspace UX: full-screen checkout/bulk issue, real item/cart tables — **DONE** (residuals in 11.7.6) |
| 11.7 | Cost vs sell (`costPrice` vs `rate`), remaining UX, inventory flow audit + D11 chatbot format — **DONE** (operator device smoke remaining) |

**Agent rule:** one sub-phase per pass; update the Kirana doc checklist with evidence; run construction regressions every pass.

---

## 5. Phase 0 - Deepseek implementation spec (THIS PASS)

### 5.1 Scope

Implement **§4 Phase 0 only**. Do **not** start Party master, multi-warehouse UI, or sales orders in this pass.

### 5.2 Tasks

#### Task A - `inventoryProfile` on Company

**Files:**

- `apps/backend/prisma/schema.prisma` - enum `InventoryBusinessProfile` + optional field on `Company`  
- New migration  
- `packages/shared/src/enums` or `inventory-profile.ts`  
- `apps/backend/src/services/company.service.ts` - allow OWNER to read/update on inventory companies only  
- `apps/mobile/app/inventory/settings.tsx` - optional dropdown (GENERAL default)  

**Rules:**

- Construction companies: field ignored / hidden  
- Default `GENERAL` for existing rows  

#### Task B - Terminology map

**File:** `packages/shared/src/inventory-labels.ts`

```ts
// Example shape - implement fully
export type InventoryLabelKey =
  | 'item' | 'item_plural' | 'catalog' | 'issue_bulk' | 'warehouse' | 'indent' | 'store';

export function getInventoryLabel(key: InventoryLabelKey, mode: 'generic' | 'materials'): string;
```

**Wire in inventory shell only:**

- `InventoryTabBar`: Materials → **Items** (or profile-based: MATERIAL_SUPPLIER keeps “Materials”)  
- Procurement copy: “Indent” → **Purchase request** in generic mode (API still `requisition`)  
- Do **not** change construction `ProcurementTab` labels  

#### Task C - Feature flags in `plan-modules.ts`

```ts
export type InventoryFeatureFlag =
  | 'parties'
  | 'multi_warehouse'
  | 'sales_orders'
  | 'stock_adjustments'  // flip true when Phase 1.3 ships
  | 'barcode';

export function hasInventoryFeature(plan: SubscriptionPlanKey, flag: InventoryFeatureFlag): boolean;
```

All flags `false` for `INVENTORY` until their phase ships (except document the intended rollout).

#### Task D - Update docs

- Mark Phase 0 checklist complete in this file §6  
- Link from `INVENTORY_PRODUCT_IMPL.md`  

### 5.3 Tests

```bash
cd packages/shared && npm run build
cd apps/backend && npm test -- --testPathPattern='inventory-product|procurement.test' --forceExit
```

Add unit test for `getInventoryLabel` and `hasInventoryFeature`.

### 5.4 Construction safety checklist

- [x] `createRequisition` auto-approve still `INVENTORY` only  \
      Untouched - `procurement.service.ts` gate unchanged; construction multi-line DRAFT regression test still green.
- [x] `ProcurementTab` Draft→Submit→Approve untouched  \
      No edits to construction `ProcurementTab.tsx` this pass (labels wired only in `apps/mobile/app/inventory/*`).
- [x] Construction resource API unchanged  \
      `Resource` documented as shared item master (Phase 0.3); no schema/API change to resources.
- [x] No new inventory automation on construction plans  \
      `inventoryProfile` read/update gated to INVENTORY (construction returns null / ignores writes - integration test); `hasInventoryFeature` false for all plans.

---

## 6. Phase 0 verification (post-Deepseek audit)

**Audited:** 2026-08-12 - Phase 0 implementation reviewed against §5 spec, D1–D10 inventory UX, and construction regression tests.

### 6.1 Verdict: **PASS** (with minor follow-ups applied)

| Area | Result | Notes |
|------|--------|-------|
| `InventoryBusinessProfile` + migration | ✅ | Enum + `Company.inventoryProfile` default `GENERAL`; migration `20260812100000_inventory_profile` |
| Backend gating | ✅ | `settings.service.ts` returns/writes profile for INVENTORY only; construction ignores PUT |
| Auth payloads | ✅ | login/me/register/invite surface `inventoryProfile` (inventory) / `null` (construction) |
| Terminology map | ✅ | `inventory-labels.ts` + mode from profile (`MATERIAL_SUPPLIER` → materials wording) |
| Inventory shell labels | ✅ | Tab bar, stock, procurement, **materials catalog** wired; construction `ProcurementTab` untouched |
| Feature flags | ✅ | `hasInventoryFeature` - all `false` for INVENTORY |
| Settings UI | ✅ | Business profile card; OWNER edit; `refreshUser()` after save so nav labels update live |
| Responsive design | ✅ | Existing patterns preserved: `useViewport` (`isDesktop`/`isPhone`), horizontal tab scroll on phone, modal bottom-sheet on phone, `flex-wrap` toolbars, `min-w-[140px]` stat cards |
| Tests | ✅ | **42/42** - `inventory-product`, `procurement.test`, `inventory-labels.test` |
| D1–D10 regressions | ✅ | Bulk issue, single-row issue, PO/GRN numbers, multi-line flows unchanged |
| Pricing | ✅ | `pricing.ts` untouched (₹499/mo) |

### 6.2 Gaps found during audit (fixed same day)

Deepseek Phase 0 was **~95% complete**. These inventory-shell label gaps were closed in verification:

1. **`materials.tsx`** - screen title, empty state, add/edit/delete copy still hardcoded “Material(s)” → now uses `getInventoryLabel*`.
2. **`procurement.tsx`** - PO empty state, Create PO modal, and “Create indent” button had leftover hardcoded strings → now profile-aware.
3. **`index.tsx`** - stock summary stat card label hardcoded “Items” → uses `itemPluralLabel`.
4. **`settings.tsx`** - saving profile did not refresh auth store → labels updated only after re-login → now calls `refreshUser()` after save.

### 6.3 Ops before prod deploy

- [ ] Run migration on staging/prod: `20260812100000_inventory_profile`
- [ ] Smoke: change profile GENERAL → WHOLESALE → MATERIAL_SUPPLIER; confirm tab says “Items” then “Materials” without re-login
- [ ] Smoke construction: `owner@reddyconst.com` - Settings PUT with `inventoryProfile` ignored; procurement still Draft→Submit→Approve

### 6.4 Construction safety (re-verified)

- [x] `createRequisition` auto-approve still `INVENTORY` only
- [x] `ProcurementTab` Draft→Submit→Approve untouched
- [x] Construction resource API unchanged
- [x] No new inventory automation on construction plans

---

## 7. Checklist

### Phase 0 - complete

- [x] `InventoryBusinessProfile` on Company + migration
- [x] `inventory-labels.ts` + **full** inventory shell wired (incl. materials catalog)
- [x] `hasInventoryFeature` flags - Phase 1 shipped: `parties` + `stock_adjustments` **true**; others false
- [x] Settings profile picker + live label refresh via `refreshUser()`
- [x] Tests green (42/42)
- [x] §6 verification recorded

### Phase 1 - complete

- [x] Customer + Vendor master (Prisma + API + inventory UI)  \
      `Customer` / `Vendor` models + migration `20260812120000_phase1_inventory_engine`; optional `Invoice.customerId` / `Bill.vendorId` links (free-text fallback kept); CRUD under `/api/inventory/parties` gated by `requireInventoryFeature('parties')`; Parties screen (`/inventory/parties`) with list + create/edit modals; invoice/bill modals pick saved parties (prefill name/phone/address/GSTIN).
- [x] Stock adjustment workflow (`StockMovementType.ADJUST` + reasons + audit)  \
      `POST /api/inventory/stock/adjust` (signed delta, 9 reasons, notes; negative balance blocked 422). `StockMovement.reason/notes` columns + movements API exposes them; inventory UI Adjust modal; `hasInventoryFeature('stock_adjustments')` → **true**.
- [x] Item fields on `Resource` (SKU, itemCode, barcode, secondaryUnit, conversionFactor)  \
      Nullable columns + validators; `materials.tsx` form fields (SKU, barcode, secondary unit + conversion, reorder point). `itemCode` in DB/API; form field optional follow-up. Construction flows unaffected (all optional).
- [x] Import opening stock (CSV v1)  \
      `POST /api/inventory/stock/opening-stock` (match by id/SKU/itemCode/name, sets balance, optional rate, ADJUST·OPENING_STOCK audit); UI "Import opening stock" modal (CSV paste → confirm); unmatched rows reported.
- [x] Low-stock indicator (+ `reorderPoint` on Resource)  \
      Stock summary includes reorderPoint; Stock home shows "Low (reorder N)" badge when balance < reorder point.
- [x] Feature flags + tests  \
      `parties` + `stock_adjustments` flipped; **45/45** inventory-related tests; construction 403 on parties/adjust/opening.

### Phase 2 - complete (verified 2026-08-12)

- [x] Sales Order model + optional SO → Delivery Challan → Invoice path (2.1)
- [x] Keep Issue → draft Invoice shortcut for small shops (unchanged; customer picker added)
- [x] Sales Return + Purchase Return workflows (2.2/2.3)
- [x] Credit Note + Debit Note (GST-aware) + Tally export hook (2.4)
- [x] Customer credit-limit warning on invoice (ALLOW / WARN / BLOCK) (2.5) + Settings UI
- [x] Flip `hasInventoryFeature('sales_orders')` when shipped

### Phase 3 - complete (verified 2026-08-12) - Warehouse ops

- [x] Multi-warehouse v1 (`StockLocation` per company; flip `multi_warehouse`)
- [x] Stock transfers (Transfer Order statuses + in-transit stock)
- [x] Stock count / stocktake workflow → adjustment on approve
- [x] Barcode field scan-to-identify (keyboard/paste v1; camera later); flip `barcode`
- [x] Basic batch tracking on movements - deferred (Phase 3.5 optional; serial/expiry later)
- [x] Responsive warehouse screens; construction 403 on new routes
- [x] Migration `20260812150000_phase3_warehouse_ops` applied (local Neon + checklist)

### Phase 4 - complete (verified 2026-08-12) - Procurement automation

- [x] Reorder master fields on `Resource` (`preferredVendorId`, `reorderQty`, `leadTimeDays`) + materials form
- [x] Reorder suggestions API (`GET /api/inventory/reorder/suggestions`) - on-hand < reorderPoint, preferred vendor + suggested qty
- [x] One-click purchase (`POST /api/inventory/reorder/suggestions/order`) - auto-approved indent + PO (preferred vendor + reorder qty), reusing `createRequisition`/`createPO`
- [x] Simple PO approval thresholds (`poAutoApproveBelow` / `poOwnerApproveAbove` ₹) - auto → manager → owner; Settings card + Approve CTA
- [x] Low-stock dashboard / notifications hook - in-app Reorder tab in Procurement (v1); notification hook deferred
- [x] Tests + construction isolation (403 on reorder routes; construction banding stripped; POs stay auto-approved)
- [x] Migration `20260812160000_phase4_procurement_automation` applied (Neon)

### Phase 5 - complete (verified 2026-08-12) - Finance depth

- [x] Landed cost allocation on GRN (freight/insurance/handling/customs → item unit cost, by qty or value)
- [x] Inventory valuation: weighted average (WAC) first; FIFO later - `Resource.avgCost`, movement cost metadata, summary `unitCost`/`inventoryValue`
- [x] Party ledger pages (customer AR + vendor AP timelines + outstanding)
- [x] Credit/debit note **Issue** action (DRAFT → ISSUED) so Tally export includes them
- [x] GST polish (state split CGST/SGST vs IGST on credit/debit notes; no e-invoice IRP)
- [x] Tests + construction isolation (403 on ledgers + note-issue; construction GRN/WAC inert)
- [x] Migration `20260812170000_phase5_finance_depth` applied (Neon)

### Phase 6 - complete (verified 2026-08-12) - Analytics & tiers

- [x] Executive dashboard (6.1)  \
      `GET /api/inventory/analytics/dashboard` (inventory-gated via `stock_adjustments`): `inventoryValue` (balance × WAC), `salesToday`/`purchasesToday` (IST calendar day), `receivables`/`payables` (open documents − paid − issued notes), `lowStockCount`, `deadStockCount` (on-hand with no OUT in 90 days); Stock home "Executive overview" cards include value, sales/purchases today (IST), AR/AP, low·dead (flex-wrap / min-w; 9-tab scroll untouched).
- [x] Stock health reports (6.2)  \
      `GET /api/inventory/analytics/reports/stock-health?days=&locationId=` (ACTIVE / SLOW / DEAD by last OUT movement) + `GET /api/inventory/analytics/reports/warehouse` (per-location qty × WAC value + item count).
- [x] Margin reports (6.3)  \
      `GET /api/inventory/analytics/reports/margin` (revenue = qty sold × catalog `Resource.rate` − COGS = WAC×qty on issue/DC OUT) + `GET /api/inventory/analytics/reports/purchase-history` (last GRN unit cost + date vs current WAC).
- [x] Mobile reports screen  \
      `/inventory/reports` (Settings → "Reports & analytics") with sub-tabs (Stock health / Warehouse value / Margins / Purchase history) + filters (warehouse, days); phone-stacked cards, no desktop-only tables.
- [x] Plan tier scaffold (6.4)  \
      Analytics gated by the existing `stock_adjustments` InventoryFeatureFlag (documented as `analytics_advanced` option for later); **no** INVENTORY_GROWTH pricing/checkout work - ₹499/month behaviour unchanged.
- [x] Tests + construction isolation  \
      5 new Phase 6 tests in `inventory-product.test.ts` (dashboard deltas, dead-stock classification + warehouse value, margin math with known WAC + sell rate, purchase-history last-buy, 403 on all analytics routes); full suite green.
- [x] No schema migration required  \
      Reuses Phase 5 WAC/movement cost metadata + existing invoices/bills/notes/reorderPoint - `prisma migrate deploy` is a no-op.

### Phase 7 - complete (verified 2026-08-12) - AI layer (documents + anomalies)

- [x] Document OCR → draft vendor bill (7.1)  \
      `POST /api/inventory/ai/bills/extract` → DRAFT bill (vendor, number, date, lines with **GST/HSN**, PO/GRN + catalog soft-match) reusing `extractText` + `callLlmForExtraction` (D10 - content LLM via `resolveLlmConfig`); `POST /api/inventory/ai/bills/create-from-draft` writes a `DRAFT` bill with `billSnapshot.source = 'AI_EXTRACT'` + PO/GRN links; mobile **Bills → "Scan invoice"** modal (responsive bottom-sheet / max-w-lg). Construction keeps its existing `/:id/bills/extract` path.
- [x] AI-assisted import column mapping (7.2)  \
      `POST /api/inventory/ai/import/preview` (CSV/XLSX → heuristic header map - LLM refine only when item-name is ambiguous) + `POST /api/inventory/ai/import/confirm` (CATALOG creates resources; OPENING reuses Phase 1 `importOpeningStock`); mobile **Materials → "Import CSV"** mapping-preview modal.
- [x] Anomaly hints (7.3)  \
      `GET /api/inventory/ai/anomalies` - rules-first: PO rate vs WAC/last-buy (±15% band, flag when above), stock-count variance (≥5 units or ≥25%), overdue invoice aging; surfaced as a **Stock home "Anomaly hints" strip** (badges, not a chatbot).
- [x] Assistant tooling (7.4)  \
      Inventory-only tools `get_low_stock` (by warehouse), `get_stock_health`, `get_vendor_purchases` wired to Phase 6 analytics / Phase 4 reorder data; filtered out for construction via `INVENTORY_ONLY_TOOL_IDS`; D10 `resolveLlmConfig` respected - no hard-coded model.
- [x] Tests + construction isolation  \
      Unit `inventory-ai.service.test.ts` (6 tests: extract happy-path with mocked LLM, create-from-draft DRAFT snapshot, not-configured note, mapping preview, CATALOG confirm, PO-rate anomaly) + 7 integration tests in `inventory-product.test.ts` (extract route shape, create-from-draft, preview+confirm, OPENING confirm, PO-rate anomaly, 7.4 tool scoping, 403 on all 5 `/api/inventory/ai/*` routes).
- [x] No schema migration required  \
      Reuses existing `Bill` (`billSnapshot`), `Resource`, PO/GRN, counts, invoices - `prisma migrate deploy` is a no-op.

### Phase 8 - complete (verified 2026-08-12) - Commercial polish & scan ops

- [x] Image OCR for invoice scan (8.1)  \
      Server-side `tesseract.js` OCR (`services/ocr.service.ts`) → Phase 7 `extractInvoiceDraft` runs JPG/PNG scans through the same content-LLM pipeline (D10 - `resolveLlmConfig`); PDF/Excel/text path unchanged; clear note when OCR returns no text; unit-tested with a mocked OCR (draft shape + OCR-failure note). Construction `/:id/bills/extract` path unchanged (403 gate re-verified).
- [x] Barcode camera (8.2)  \
      `BarcodeScannerOverlay` (expo-camera `CameraView` + `onBarcodeScanned`) on Stock Find/issue - phone full-bleed overlay, desktop max-w-lg; keyboard/paste + Find stays primary; gated to native platforms (web shows a "use keyboard" note) + inventory shell only. Existing Phase 3 `/inventory/items/by-barcode/:code` lookup untouched.
- [x] Batch / lot lite (8.3)  \
      Optional `batchCode` on GRN lines, issue lines and DC lines → stored on `StockMovement` and exposed in movement history; migration `20260812180000_phase8_scan_ops` (nullable columns - construction BOQ/procurement untouched). Mobile: batch inputs on Record GRN, Issue and New Challan modals. No serial/expiry/FEFO.
- [x] Invoice ↔ Resource link + true margins (8.4)  \
      `InvoiceLineItem.resourceId` (FK SetNull, indexed) accepted on invoice create/update + set automatically on draft issue invoices; margin report uses **billed line amounts** when links exist (`revenueSource: 'BILLED'`), falls back to catalog rate (`'CATALOG'`).
- [x] In-app notifications (8.5)  \
      `inventory-alerts.service.ts` hooks into the existing `notify()` infra (no new product): low-stock after issue/DC dispatch, PO-rate anomaly on PO create, stock-count variance on approve - all non-fatal, inventory-only. Inventory shell top-bar bell + `/inventory/notifications` screen with unread badge.
- [x] UI polish (8.6)  \
      Materials form `itemCode` field; Record GRN warehouse (`locationId`) picker; Delivery Challan **dispatch** warehouse picker sheet (API already supported `locationId`).
- [x] Tests + construction isolation  \
      Unit `inventory-ai.service.test.ts` 8.1 OCR (2 tests, mocked OCR) + integration: 8.3 batch movement round-trip, 8.4 billed-margin, 8.5 low-stock notification; full suite green; construction 403 on `/api/inventory/*` unchanged.
- [x] Migration applied  \
      `20260812180000_phase8_scan_ops` (nullable batch_code columns + invoice_line_items.resource_id index) - applied to Neon; audit also applied `20260812190000_phase8_invoice_line_resource_fk` (SetNull FK matching Prisma schema).

### Phase 9 - complete (verified 2026-08-12) - Dealer GTM polish

- [x] Customer price lists (9.1)  \
      `CustomerPrice` model (customerId NULL = company default) + `services/price-list.service.ts`; effective rate = **customer override > company default > `Resource.rate`** applied on SO lines (rate 0), issue draft-invoice lines (no unit price) and manual invoice lines (rate 0 + resource link). Mobile: Parties → **"Price lists"** modal (add/update/delete, scope badges) + effective-rate prefill in SO / Quote / Issue pickers. Gated `requireInventoryFeature` - construction 403.
- [x] Quote → Sales Order (9.2)  \
      `Quote`/`QuoteLine` (DRAFT → SENT → ACCEPTED/REJECTED) + `services/quote.service.ts`; ACCEPTED quote → `createSalesOrderFromQuote` reuses `createSalesOrder` (lines/rates/customer copied, `quote.salesOrderId` linked, double-convert rejected). Mobile Sales **Quotes sub-tab** (stays inside Sales - no 10th tab) + responsive `NewQuoteModal`.
- [x] Printable PDFs (9.3)  \
      `reportSalesOrder` / `reportDeliveryChallan` / `reportGoodsReceipt` in the existing PDF pipeline; `GET /api/inventory/pdf/{sales-orders,delivery-challans,grn}/:id` (inventory-gated). Mobile **PDF** buttons on SO / DC / GRN rows via the shared download/share helper.
- [x] Payment reminders (9.4)  \
      `notifyOverdueInvoices` (deduped once per week) rides the anomalies hook + manual `POST /api/inventory/invoices/:id/remind` - both reuse the existing `notify()` infra (in-app first; no new product / no WhatsApp gateway).
- [x] AI resource persistence (9.5)  \
      `createBillFromDraft` already writes `matchedResourceId` into `billSnapshot.lines` - locked in with a dedicated test (draft line `matchedResourceId` survives to the saved bill snapshot).
- [x] UI polish (9.6)  \
      Per-line batch on GRN create (per-resource input) and DC create (per-line input); DC create now allows **subset of SO lines** (per-line qty defaults to undelivered). API already supported both.
- [x] Tests + construction isolation  \
      6 new integration tests (9.1 override on SO/Issue/Invoice + list scope, 9.2 quote lifecycle + convert + double-convert 400, 9.3 SO/DC/GRN PDF content-type, 9.4 remind + notification, 9.5 snapshot resourceId, construction 403 on all Phase 9 routes); full suite green.
- [x] Migration applied  \
      `20260812190000_phase9_gtm` (customer_prices + quotes/quote_lines + QuoteStatus enum + FKs) - applied to dev + test DBs.

### Phase 10 - complete (verified 2026-08-12) - Production hardening

- [x] Staging/prod smoke of Phases 0–9 (inventory + construction 403)  \
      API-level smoke executed against the running backend via the full inventory suite (see §31 matrix). Each smoke item is pinned to an automated test: price list → SO/Quote rates (9.1), Quote→Accept→SO (9.2), SO/DC/GRN PDF (9.3), invoice Remind (9.4), Scan invoice PDF (7.1) + photo/OCR (8.1 unit), Stock Find barcode lookup (3.4; camera needs a live device), batch GRN→issue (8.3), notifications bell (8.5/9.4), reports dashboard (6.1–6.3). Construction: all `/api/inventory/*` → 403 + indent Draft→Submit→Approve (procurement.test) + bill-extract (bill-extract.test).
- [x] Fix only concrete smoke bugs  \
      Two mobile bug fixes (no features): (1) duplicate **Reject** CTA on SENT quotes in `sales.tsx` - reject now only renders once (SENT) plus a void/Reject for ACCEPTED; (2) quote→SO invalidated the wrong React-Query key - now refreshes the Sales Orders tab (`['transactions','sales-orders']`). Camera permission code already uses `Camera.requestCameraPermissionsAsync` (never the `useCameraPermissions` hook as a plain function) - verified, no change needed.
- [x] Confirm all migrations applied through `phase9_gtm` on staging/prod  \
      `20260812180000_phase8_scan_ops`, `20260812190000_phase8_invoice_line_resource_fk`, `20260812190000_phase9_gtm` all present; `npx prisma migrate deploy` → **no pending migrations** (dev + test).
- [x] Optional deferred item  \
      **Skipped** - smoke clean but §10.4 allows at most one and says "skip if unsure"; keeping the release zero-risk.
- [x] §31 verification recorded  \
      Smoke matrix + verdict recorded below.

---

## 8. Phase 1 verification (post-Deepseek audit)

**Audited:** 2026-08-12 - Phase 1 reviewed against §4 Phase 1 + §7 checklist, D1–D10 regressions, responsive UI.

### 8.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Party master (1.1) | ✅ | `Customer`/`Vendor` models, `/api/inventory/parties`, Parties tab, invoice/bill party pickers |
| Item master 1.5 (1.2) | ✅ | Resource fields + materials form; `itemCode` in schema/API but not yet on form (minor) |
| Stock adjustment (1.3) | ✅ | Adjust API, 9 reasons, negative balance 422, movement audit columns |
| Opening stock (1.4) | ✅ | CSV import API + modal; OPENING_STOCK reason |
| Low-stock (1.5) | ✅ | reorderPoint + badge on stock rows (not a separate reports screen) |
| Multi-warehouse (1.6) | ⏭️ | Correctly deferred per scope |
| Feature flags | ✅ | `parties` + `stock_adjustments` true; construction always false |
| Construction isolation | ✅ | 403 on parties/adjust/opening; auto-approve gate unchanged; ProcurementTab untouched |
| D1–D10 regressions | ✅ | Bulk/single issue, PO/GRN numbers, multi-line flows intact |
| Responsive design | ✅ | `useViewport` on all new modals (PartyModal, AdjustStockModal, OpeningStockModal); `flex-wrap` stock toolbar; horizontal tab scroll (now **8 tabs** after Phase 2 Sales) |
| Tests | ✅ | **45/45** (`inventory-product`, `procurement.test`, `inventory-labels`); mobile tsc clean |

### 8.2 Minor notes (non-blocking)

1. **`itemCode` form field** - backend + opening-stock import support it; materials form could add it in a polish pass.
2. **Parties tab nav** - always visible in inventory shell (no `hasInventoryFeature` UI gate); acceptable because only INVENTORY tenants see the shell.
3. **Stock ledger report screen** - movements API already powers per-row history; dedicated report UI deferred to Phase 6.

### 8.3 Ops before prod deploy

- [ ] Apply migrations: `20260812100000_inventory_profile` + `20260812120000_phase1_inventory_engine`
- [ ] Smoke inventory: create customer → invoice with picker; adjust stock +/−; import opening CSV; low-stock badge
- [ ] Smoke construction: parties/adjust/opening → **403**; indent still Draft→Submit→Approve

---

## 9. Reference files

```
packages/shared/src/plan-modules.ts
packages/shared/src/inventory-labels.ts
packages/shared/src/validators/parties.ts
packages/shared/src/validators/stock-adjustment.ts
apps/backend/prisma/schema.prisma          # Customer, Vendor, Resource, StockMovement
apps/backend/src/services/party.service.ts
apps/backend/src/routes/party.routes.ts
apps/backend/src/routes/inventory-stock.routes.ts
apps/backend/src/middleware/module-gate.ts  # requireInventoryFeature
apps/mobile/app/inventory/parties.tsx
apps/mobile/components/inventory/PartyModal.tsx
apps/mobile/components/inventory/StockModals.tsx
apps/mobile/services/party.queries.ts
apps/backend/src/services/sales-order.service.ts
apps/backend/src/services/return.service.ts
apps/backend/src/routes/transaction.routes.ts
apps/mobile/app/inventory/sales.tsx
apps/mobile/components/inventory/TransactionModals.tsx
apps/mobile/services/sales.queries.ts
packages/shared/src/validators/transactions.ts
packages/shared/src/validators/warehouse.ts
apps/backend/src/services/warehouse.service.ts
apps/backend/src/routes/warehouse.routes.ts
apps/mobile/app/inventory/warehouse.tsx
apps/mobile/components/inventory/WarehouseModals.tsx
apps/mobile/services/warehouse.queries.ts
apps/backend/src/services/reorder.service.ts
apps/backend/src/routes/reorder.routes.ts
packages/shared/src/validators/reorder.ts
apps/mobile/services/reorder.queries.ts
apps/backend/src/services/finance.service.ts
apps/backend/src/services/inventory-ai.service.ts
apps/backend/src/routes/inventory-ai.routes.ts
packages/shared/src/validators/inventory-ai.ts
apps/mobile/services/inventory-ai.queries.ts
apps/mobile/components/inventory/ScanInvoiceModal.tsx
apps/mobile/components/inventory/ImportMappingModal.tsx
apps/mobile/components/inventory/AnomalyStrip.tsx
docs/INVENTORY_PRODUCT_IMPL.md
docs/INVENTORY_UX_POLISH.md
```

---

## 10. Operator / Deepseek command - Physical-device release smoke (copy-paste)

```
Read docs/INVENTORY_HORIZONTAL_PLATFORM.md §31.4–§31.5 + §3 locked principles.

Phases 0–10 are COMPLETE. Agent pre-flight for the release gate is DONE (§31.4 Pre-flight box):
- Migrations applied (no pending)
- API smoke + suites green
- expo-camera config plugin added to apps/mobile/app.json (rebuild/prebuild required for iOS NSCameraUsageDescription)

Your job is ONLY the three remaining PHYSICAL DEVICE boxes in §31.4 if still unchecked.
For **new feature work**, use Phase 11: `docs/INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md` (one sub-phase per pass).

Before testing:
1) Rebuild the mobile app so the expo-camera plugin is applied (`npx expo prebuild` / EAS build / local native rebuild as your pipeline requires).
2) Confirm staging/prod backend has no pending migrations (`npx prisma migrate deploy`).
3) Ensure a D10 content LLM is configured if you will test photo OCR.

Inventory device smoke (`owner@hydmaterials.com` / `Test@1234`):
- Stock → Scan: camera permission prompt → scan barcode → item highlighted
- After Remind or low-stock: top-bar 🔔 shows unread badge; notifications list opens
- SO / DC / GRN: PDF button opens download/share sheet
- Bills → Scan invoice with a photo (OCR) - only if content LLM is configured
- Quick phone UI check: Price lists modal + Quote actions still wrap cleanly

Construction device smoke (`owner@reddyconst.com` / `Test@1234`):
- No inventory-only screens/routes in the construction shell
- Indent Draft → Submit → Approve
- Bill-extract Import still works

If you find a concrete bug: fix only that (prefer inventory UI), note under §31.5, re-run shared build + targeted quartet + mobile tsc.
If clean: tick the three §31.4 device boxes, set §31.1 note to "device smoke PASS", stop.

Do NOT: e-invoice, RFQ, variants, rental, new pricing, hard-code deepseek as chat model, rewrite Phases 0–10.
(Batch expiry / FEFO / Kirana catalog belong in Phase 11 doc - not in this smoke pass.)
```

---

## 10b. Deepseek agent command - Phase 11 Kirana (copy-paste)

```
Read docs/INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md §3 Phase 11.7 + §8 + §9
AND docs/INVENTORY_UX_POLISH.md D11
AND this file §1.3 + §3.

Phases 0–10 and 11.0–11.7 + D11 are CODE-COMPLETE.
Do not re-implement 11.7. Operator device smoke only unless a concrete bug is found.
Deepseek-v4-flash = coding agent. Do NOT hard-code it as the in-app chat model (D10).
```

---

## 11. Deepseek agent command - Phase 10 (archived)

Phase 10 is complete (§31). Use §10 only for live-device release smoke / bugfixes. Do not re-run the hardening pass.

---

## 12. Deepseek agent command - Phase 9 (archived)

Phase 9 is complete (§30). Use §10 for the optional hardening pass. Do not re-run unless regressions found.

---

## 13. Deepseek agent command - Phase 8 (archived)

Phase 8 is complete (§29). Use §10 for the next pass. Do not re-run unless regressions found.

---

## 14. Deepseek agent command - Phase 7 (archived)

Phase 7 is complete (§28). Use §10 for the next pass. Do not re-run unless regressions found.

---

## 15. Deepseek agent command - Phase 6 (archived)

Phase 6 is complete (§27). Use §10 for the next pass. Do not re-run unless regressions found.

---

## 16. Deepseek agent command - Phase 5 (archived)

Phase 5 is complete (§21). Use §10 for the next pass. Do not re-run unless regressions found.

---

## 17. Deepseek agent command - Phase 4 (archived)

Phase 4 is complete (§20). Use §10 for the next pass. Do not re-run unless regressions found.

---

## 18. Deepseek agent command - Phase 3 (archived)

Phase 3 is complete (§19). Do not re-run unless regressions found.

---

## 19. Phase 2 verification (independent audit)

**Audited:** 2026-08-12 - Phase 2 re-verified against §4 Phase 2 + §7 checklist, D1–D10 regressions, responsive UI.

### 12.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Sales Order (2.1) | ✅ | `SalesOrder`+lines; DRAFT → CONFIRMED → DELIVERED → INVOICED; sequential `so` numbers |
| Delivery Challan (2.1) | ✅ | DRAFT → DISPATCHED (stock **OUT**, insufficient → 422) → DELIVERED |
| Invoice from SO (2.1) | ✅ | Reuses GST invoice service; `salesOrderId` FK; SO → INVOICED |
| Issue → draft Invoice | ✅ | Shortcut preserved; customer picker on issue modal |
| Sales Return (2.2) | ✅ | GOOD restocks IN; DAMAGED scrap; draft CN (GST math covered in tests) |
| Purchase Return (2.3) | ✅ | Stock OUT + draft DN; insufficient blocked |
| Credit/Debit Notes (2.4) | ✅ | GST lines; Tally hook for **ISSUED** notes; Notes sub-tab lists drafts |
| Credit limit (2.5) | ✅ | ALLOW/WARN/BLOCK API + **Settings UI** (added in audit); WARN toast on invoice |
| Feature flags | ✅ | `sales_orders` true; construction always false |
| Construction isolation | ✅ | 403 on `/api/inventory/transactions/*`; ProcurementTab untouched |
| D1–D10 / Phase 0–1 | ✅ | Targeted **50/50**; procurement + inventory-labels green |
| Responsive design | ✅ | Shared `Sheet` + TransactionModals use `useViewport`; Sales `flex-wrap` sub-tabs; **8-tab** horizontal scroll |

### 12.2 Gaps found during audit (fixed / noted)

1. **Credit limit policy Settings UI** - backend + validator existed; inventory Settings lacked a picker → **added** OWNER card (ALLOW/WARN/BLOCK) during this audit.
2. **Note DRAFT → ISSUED** - returns create CN/DN as `DRAFT`; Tally only exports `ISSUED`. No Issue-note API/UI yet → **Phase 3 polish / Phase 5 finance** follow-up (non-blocking).
3. **Tab bar comment** - still said “7 tabs” after Sales was added → corrected to **8**.
4. **Purchase return entry** - via Sales → Returns (not bill detail CTA); acceptable for inventory isolation.

### 12.3 Ops before prod deploy

- [ ] Apply `20260812140000_phase2_transaction_engine` (+ Phase 0/1 migrations if missing)
- [ ] Smoke inventory: SO → confirm → challan → dispatch → deliver → invoice; sales/purchase return; Settings credit policy WARN/BLOCK; Issue with customer
- [ ] Smoke construction: transactions → **403**; indent Draft→Submit→Approve

---

## 20. Deepseek agent command - Phase 1 (archived)

Phase 1 is complete (§8). Do not re-run unless regressions found.

---

## 21. Deepseek agent command - Phase 0 (archived)

Phase 0 is complete (§6). Do not re-run unless regressions found.

---

## 22. Phase 3 verification (independent audit)

**Audited:** 2026-08-12 - Phase 3 re-verified against §4 Phase 3 + §7 checklist; migrations applied to Neon; targeted tests re-run.

### 15.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Multi-warehouse v1 (3.1) | ✅ | Location CRUD; default backfill for INVENTORY STORE; stock independence per location |
| Stock transfers (3.2) | ✅ | Dispatch OUT / receive IN; insufficient → 422 |
| Stock counts (3.3) | ✅ | Approve → ADJUST/STOCKTAKE + balance set to counted |
| Barcode identify (3.4) | ✅ | Lookup API + Stock Find; unknown → 404 |
| Feature flags | ✅ | `multi_warehouse` + `barcode` true; construction false |
| Construction isolation | ✅ | 403 on warehouse/transfer/count/barcode routes; ProcurementTab untouched |
| Phase 0–2 regressions | ✅ | Targeted **55/55**; procurement conflict path still handled |
| Responsive design | ✅ | WarehouseModals `useViewport`; hub `flex-wrap`; Stock filter/barcode row wraps; **9-tab** scroll |
| Migrations | ✅ | `20260812100000` … `20260812150000` applied on Neon - `migrate status` **up to date** |

### 15.2 Notes (non-blocking)

1. **GRN / DC location picker** - backend supports `locationId`; mobile procurement/sales challan UI still defaults to company default warehouse (polish).
2. **Batch tracking (3.5)** - deferred as planned.
3. **Barcode camera** - keyboard/paste v1 only (spec-compliant).
4. **Traceability route** - `/api/projects/:projectId/inventory/:resourceId/trace` exists separately; out of Phase 3 scope; do not confuse with warehouse ops.

### 15.3 Ops

- [x] Apply Phase 0–3 migrations on this environment’s Neon DB (done 2026-08-12)
- [ ] Smoke inventory on staging/prod after deploy: 2nd warehouse → adjust both → transfer → count approve → barcode find
- [ ] Smoke construction: warehouse routes → **403**; indent Draft→Submit→Approve

---

## 23. Phase 4 verification (independent audit)

**Audited:** 2026-08-12 - Phase 4 re-verified against §4 Phase 4 + §7 checklist; migration applied to Neon; targeted tests re-run.

### 18.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Reorder master fields (4.1) | ✅ | `Resource.preferredVendorId` (FK Vendor, SetNull, company-validated), `reorderQty`, `leadTimeDays` - all nullable; construction resource/estimate flows untouched |
| Reorder suggestions (4.2) | ✅ | `GET /api/inventory/reorder/suggestions` - TOTAL on-hand across warehouses < reorderPoint; includes preferred vendor + suggested qty (`reorderQty` preferred, else shortfall) |
| One-click purchase (4.3) | ✅ | `POST /api/inventory/reorder/suggestions/order` - auto-approved indent (INVENTORY) + PO via reused `createRequisition`/`createPO`; correct lines/rate; non-low-stock → 422 |
| PO approval thresholds (4.4) | ✅ | `Company.poAutoApproveBelow/poOwnerApproveAbove` (₹, default 0 = off); `createPO` bands auto→SUBMITTED(manager)→SUBMITTED(owner-only); `POST .../purchase-orders/:poId/approve`; Settings card + Approve CTA; construction POs stay APPROVED + settings stripped |
| Construction isolation | ✅ | 403 on `/api/inventory/reorder/*`; banding fields stripped on construction PUT; auto-approve indent still INVENTORY-only; ProcurementTab untouched |
| Phase 0–3 regressions | ✅ | Targeted **60/60** (`inventory-product`, `procurement.test`, `inventory-labels`) incl. 5 new Phase 4 tests; full backend **195/195** |
| Responsive design | ✅ | Reorder tab `FlatList` + `flex-wrap` badges; Settings threshold inputs wrap (`min-w-[140px]`); 9-tab scroll preserved; materials form uses existing `useViewport` modal |
| Migrations | ✅ | `20260812160000_phase4_procurement_automation` applied - `migrate status` **up to date** |

### 18.2 Notes (non-blocking)

1. **Notification hook** - deferred per spec (“in-app list is enough for v1”); the Reorder tab + Stock low-stock badge are the v1 surface.
2. **Approval authority** - mid band allows OWNER/PM/INVENTORY_MANAGER; above band is OWNER-only (403 otherwise). Construction companies never see SUBMITTED POs (always APPROVED at create).
3. **Vendor on one-click PO** - uses the first suggestion's preferred vendor name; items without a preferred vendor fall back to `-`. Per-item vendor targeting can follow as polish.
4. **Reorder qty** - `reorderQty` (item master) wins; otherwise suggested qty = shortfall below `reorderPoint`.

### 18.2.1 Audit follow-ups (same day)

1. Settings PO threshold inputs now `flex-wrap` + `min-w-[140px]` so phone layouts stack cleanly.
2. Migration applied on this environment’s Neon DB (`migrate deploy` → up to date).

### 18.3 Ops

- [x] Apply `20260812160000_phase4_procurement_automation` on Neon (done 2026-08-12)
- [ ] Smoke inventory on staging/prod: reorder fields → Reorder tab → Order → thresholds → Approve CTA
- [ ] Smoke construction: `/api/inventory/reorder/*` → **403**; indent Draft→Submit→Approve; PO stays auto-approved

---

## 24. Phase 5 verification (independent audit)

**Audited:** 2026-08-12 - Phase 5 re-verified against §4 Phase 5 + §7 checklist; migration applied to Neon; targeted tests re-run.

### 19.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Landed cost (5.1) | ✅ | GRN `freight/insurance/handling/customs` + `landedCostAllocation` (QUANTITY/VALUE); per-line `unitCost` = PO rate + allocated extras; construction GRNs unaffected (defaults 0) |
| Weighted-average cost (5.2) | ✅ | `Resource.avgCost` running WAC on stock IN (GRN, opening, sales-return GOOD at WAC); OUT movements (issue, DC dispatch, purchase return) carry `StockMovement.unitCost/inventoryValue`; Stock summary adds `unitCost` + `inventoryValue`; FIFO deferred, no LIFO |
| Party ledgers (5.3) | ✅ | `GET /api/inventory/parties/customers/:id/ledger` + `/vendors/:id/ledger` - invoices/bills, payments, issued credit/debit notes, running balance, outstanding; responsive stacked-card modal |
| Note issuance (5.4) | ✅ | `POST .../notes/credit/:id/issue` + `.../notes/debit/:id/issue` (DRAFT→ISSUED, re-issue 400); draft excluded from Tally export, issued included (test-verified) |
| GST polish (5.5) | ✅ | `cgst/sgst/igst` on credit/debit notes computed via same-state detection (reuses tally `normalizeStateCode`); Tally note vouchers emit the split (IGST fallback for legacy notes); no e-invoice IRP |
| Construction isolation | ✅ | 403 on ledger + note-issue routes; banding/notes stripped for construction; construction GRN/issue flows unchanged (WAC metadata inert) |
| Phase 0–4 regressions | ✅ | Targeted **66/66** (`inventory-product`, `procurement.test`, `inventory-labels`) incl. 6 new Phase 5 tests; full backend **201/201** |
| Responsive design | ✅ | Ledger modal `useViewport` (phone bottom sheet, desktop `max-w-lg`), stacked cards; GRN landed-cost section `flex-wrap`; Notes Issue CTA; 9-tab scroll preserved |
| Migrations | ✅ | `20260812170000_phase5_finance_depth` applied - `migrate status` **up to date** |

### 19.2 Notes (non-blocking)

1. **WAC company-wide (v1)** - not per-warehouse; per-location WAC can follow if dealer customers need it.
2. **Vendor state for debit-note split** - derived from the bill/vendor GSTIN (2-digit prefix); no vendor `state` column yet.
3. **Landed cost on bills** - v1 allocates on GRN only (the vendor bill still books PO rates); a bill-side landed-cost entry can follow.
4. **Note VOID** - Issue is terminal for v1; a VOID action can be added later.
5. **Invoice payment date** - the customer ledger uses the invoice date for payment entries (Invoice has `paidAmount` but no `paidAt`); acceptable for v1.

### 19.3 Ops

- [x] Apply `20260812170000_phase5_finance_depth` on Neon (done 2026-08-12)
- [ ] Smoke inventory on staging/prod: GRN with freight → WAC/value; party ledger; issue credit note → Tally
- [ ] Smoke construction: ledger + note-issue → **403**; PO/GRN unchanged

---

## 25. Deepseek agent command - earlier phases (archived)

Phases 0–4 are complete (§6, §8, §14, §17, §18). Do not re-run unless regressions found.

---

## 26. LLM key (operator note - not a Deepseek task)

Production assistant (Construction **and** Inventory): **Settings → Integrations → LLM** (construction OWNER) or platform `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL` in backend env. DeepSeek `deepseek-v4-flash` works if the endpoint is OpenAI-compatible. See `INVENTORY_UX_POLISH.md` §6 (D10).

---

## 27. Phase 6 verification (independent audit)

**Audited:** 2026-08-12 - Phase 6 re-verified against §4 Phase 6 + §7 checklist; no schema migration; targeted **71/71** + mobile tsc clean; Neon migrations up to date (no-op deploy).

### 25.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Executive dashboard (6.1) | ✅ | API + Stock home cards; audit added Sales today / Purchases today cards (API already returned them) alongside value / AR / AP / low·dead |
| Stock health (6.2) | ✅ | `GET /api/inventory/analytics/reports/stock-health?days=&locationId=` - per-item ACTIVE/SLOW/DEAD by last OUT movement, on-hand + WAC value; `GET /api/inventory/analytics/reports/warehouse` - per-location qty × WAC value + item count |
| Margin reports (6.3) | ✅ | `GET /api/inventory/analytics/reports/margin` - revenue = qty sold × catalog `Resource.rate` − COGS = WAC×qty (issue/DC OUT); `marginPct`; `GET /api/inventory/analytics/reports/purchase-history` - last GRN unit cost/date vs current WAC, `wacVsLastBuy` |
| Plan tier scaffold (6.4) | ✅ | Analytics gated by existing `stock_adjustments` flag (future `analytics_advanced` documented); no pricing/checkout change - ₹499/month unchanged |
| Construction isolation | ✅ | 403 on all 5 analytics routes (`dashboard`, `stock-health`, `warehouse`, `margin`, `purchase-history`) |
| Phase 0–5 regressions | ✅ | `inventory-product` **41/41** (5 new Phase 6 tests); targeted trio + full backend suite green |
| Responsive design | ✅ | Dashboard cards `flex-wrap`/`min-w`; Reports screen phone-stacked cards + `useViewport`; 9-tab bar untouched (reports reached via Settings) |
| Migrations | ✅ | None required - `prisma migrate deploy` reports "No pending migrations to apply" |

### 25.2 Documented bases (v1)

1. **"Today" = IST calendar day** (UTC+05:30) for `salesToday` / `purchasesToday`.
2. **Sales revenue per item = qty sold × catalog `Resource.rate`** - the stock home's "suggested selling price for Issue"; the true billed amount lives on invoice line items which are not yet linked to resources (line-item `resourceId` is a future enhancement).
3. **COGS = WAC × qty** stamped on OUT movements (`StockMovement.inventoryValue`).
4. **Dead stock = on-hand > 0 with no OUT movement in N days** (default 90); SLOW = 30–90; ACTIVE = < 30.
5. **Inventory value = balance × `Resource.avgCost`** - WAC is company-wide v1 (not per-warehouse), consistent with Phase 5.

### 25.3 Notes (non-blocking)

1. **GRN auto-bill** - `createDraftBillFromGrn` books a DRAFT vendor bill on every inventory GRN (Phase 2 behaviour). Dashboard `purchasesToday` counts bills dated IST-today regardless of status; `payables` excludes DRAFT.
2. **Margin by customer** deferred - no `resourceId` on invoice line items yet; item-level margin shipped first.
3. **Turnover/aging depth** - slow/dead classification based on last OUT; FIFO-aged inventory value (ageing buckets) deferred.
4. **Revenue basis** - margins use catalog `Resource.rate` × qty sold (not invoice line net); document until invoice lines link resources.

### 25.4 Ops

- [x] `prisma migrate deploy` - no pending migrations (Phase 6 adds no schema)
- [ ] Smoke inventory on staging/prod (`owner@hydmaterials.com / Test@1234`): Stock home dashboard row; Settings → Reports → Stock health/Warehouse value/Margins/Purchase history
- [ ] Smoke construction (`owner@reddyconst.com / Test@1234`): `/api/inventory/analytics/*` → **403**

---

## 28. Phase 7 verification (independent audit)

**Audited:** 2026-08-12 - Phase 7 re-verified against §4 Phase 7 + §7 checklist; no schema migration; targeted **84/84** (incl. inventory-ai unit) + mobile tsc clean; Neon migrations up to date (no-op deploy).

### 27.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| OCR → draft bill (7.1) | ✅ | `POST /api/inventory/ai/bills/extract` reuses `extractText` + `callLlmForExtraction` (content LLM via `resolveLlmConfig` - D10, never a hard-coded chat model); draft carries vendor/number/date/GST/**lines with HSN** + catalog soft-match + PO/GRN match; `create-from-draft` writes `status='DRAFT'` with `billSnapshot.source='AI_EXTRACT'` and PO/GRN links (GRN link skipped when the auto GRN bill already exists - `@@unique([goodsReceiptId])`). Construction keeps its existing `/:id/bills/extract` path. |
| Import mapping (7.2) | ✅ | Heuristic header map (Product Name→name, HSN→hsn, Qty→qty, ...); LLM refine only when item-name is ambiguous; CATALOG confirm creates resources (dedupe by name), OPENING confirm reuses Phase 1 `importOpeningStock` (name/SKU match + WAC on IN). |
| Anomaly hints (7.3) | ✅ | Rules-first `GET /api/inventory/ai/anomalies`: PO rate > 15% above WAC/last-buy (high ≥ +30%), stock-count variance ≥5 units or ≥25%, overdue invoice aging (high > 30 days); surfaced as Stock home strip (not a chatbot). |
| Assistant tooling (7.4) | ✅ | `get_low_stock` (per-warehouse), `get_stock_health`, `get_vendor_purchases` wired to Phase 6 analytics / Phase 4 reorder data; `INVENTORY_ONLY_TOOL_IDS` keeps them away from construction tenants (OWNER included). |
| Construction isolation | ✅ | 403 on all 5 `/api/inventory/ai/*` routes (`bills/extract`, `bills/create-from-draft`, `import/preview`, `import/confirm`, `anomalies`); construction `/:id/bills/extract` untouched. |
| Phase 0–6 regressions | ✅ | `inventory-product` **48/48** (7 new Phase 7 integration tests) + unit `inventory-ai.service` **6/6**; targeted trio + full backend suite green. |
| Responsive design | ✅ | ScanInvoiceModal + ImportMappingModal: phone bottom sheet / desktop `max-w-lg`; anomaly strip stacks on phone / wraps cards on desktop (`min-w-[220px]`); 9-tab bar untouched. |
| Migrations | ✅ | None required - `prisma migrate deploy` / `migrate status` up to date. |
| Audit fix (this pass) | ✅ | Phase 6 analytics hooks had `/api/inventory/...` paths (doubles `API_BASE_URL` which already ends in `/api`) → corrected to `/inventory/analytics/...` so dashboard/reports work on device. |

### 27.2 Documented bases (v1)

1. **Extraction uses the existing document pipeline** (`extractText`: text-based PDF / Excel / text). **Scanned images (JPG/PNG)** now run through server-side Tesseract OCR (`ocr.service.ts`) - shipped in **Phase 8.1** (mocked-OCR unit tests); a clear note is returned when OCR yields no text.
2. **Create-from-draft reuses free-text vendor names** with soft-match to the Phase 1 party master (by GSTIN, else case-insensitive name); `vendorId` is linked when a match exists, else left null (existing `Bill.vendorName` fallback).
3. **Bill lines are stored in `billSnapshot.lines`** (the `Bill` model has no line table) with `source: 'AI_EXTRACT'`, mirroring `createDraftBillFromGrn`.
4. **Anomaly hints are rules-first** - no LLM summary call; thresholds are constants (`PO_RATE_BAND_PCT = 0.15`, variance ≥5 or ≥25%, overdue >30 days high).
5. **Import preview is heuristic-first** (deterministic in tests); the LLM is only consulted when the item-name column is not auto-mapped.
6. **7.4 tools are data-read-only** (guarded by `stock.view` / `procurement.view`) - the assistant still must confirm before any write, and construction-only tools stay denied for inventory.

### 27.3 Notes (non-blocking)

1. The integration extract test tolerates both outcomes because the test env has a platform LLM configured (`.env`) - the route must return 200 with `{ draft, notes }` either way and never persist until the user confirms.
2. `get_low_stock` reports per-warehouse low-stock rows; `get_vendor_purchases` reads bills + GRN receipts for a vendor (month default = last 30 days).
3. PO-rate anomaly uses `max(WAC, lastBuy)` as the baseline; a PO below cost is not flagged (buy-side only) - a future "margin floor" hint can reuse the same band.
4. **Mobile path convention** - `API_BASE_URL` includes `/api`; inventory hooks must use `/inventory/...`. Phase 6 analytics paths were fixed during this audit.
5. **Image OCR** shipped in Phase 8.1 - scanned JPG/PNG go through Tesseract → LLM extract.

### 27.4 Ops

- [x] `prisma migrate deploy` - no pending migrations (Phase 7 adds no schema)
- [ ] Smoke inventory on staging/prod (`owner@hydmaterials.com / Test@1234`): Bills → "Scan invoice" (PDF) → create draft bill; Materials → "Import CSV" (catalog + opening); Stock home "Anomaly hints" strip after a high-rate PO
- [ ] Smoke construction (`owner@reddyconst.com / Test@1234`): `/api/inventory/ai/*` → **403**; existing `/:id/bills/extract` still works
- [ ] (Optional, future) OCR backend for scanned image invoices - not shipped in Phase 7


---

## 29. Phase 8 verification (independent audit)

**Audited:** 2026-08-12 - Phase 8 re-verified against §4 Phase 8 + §7 checklist; migrations applied on Neon (`20260812180000` + audit FK `20260812190000`); targeted **89/89** + mobile tsc clean.

### 29.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Image OCR (8.1) | ✅ | `tesseract.js` (eng) in `ocr.service.ts`; `extractInvoiceDraft` detects image content types → OCR → existing LLM extract; PDF/Excel/text unchanged; empty-OCR → clear "OCR could not read" note. Unit tests mock OCR (draft shape + failure note). Runtime downloads lang data on first use (documented). |
| Barcode camera (8.2) | ✅ | Overlay on Stock Find - phone full-bleed / desktop max-w-lg; keyboard/paste primary; web note. Audit fixed permissions to `requestCameraPermissionsAsync` (was incorrectly calling `useCameraPermissions` as an async fn). |
| Batch / lot lite (8.3) | ✅ | `batchCode` on GRN/issue/DC lines → `StockMovement.batchCode` → movement history; migration nullable-only (construction untouched). Integration test: GRN with `LOT-2026-A` → IN movement batch; issue same batch → OUT movement batch + history API exposes it. |
| Invoice↔Resource + margins (8.4) | ✅ | `InvoiceLineItem.resourceId` (create/update + auto on draft issue invoices, company-scoped validation); margin report `revenueSource: 'BILLED'` uses billed line amounts, else catalog rate. Test: issue 5 @ ₹200 → margin revenue ₹1000 (not 5 × catalog ₹150), source BILLED. |
| Notifications (8.5) | ✅ | `inventory-alerts.service.ts` → shared `notify()` (in-app first; no new product): low-stock (issue + dispatch), PO-rate anomaly (createPO), count variance (approve). Inventory top-bar bell + `/inventory/notifications` screen (unread badge, type-aware deep links). Test: `notifyLowStock` creates a row for the OWNER. |
| UI polish (8.6) | ✅ | Materials `itemCode` field; Record GRN warehouse picker (`locationId`); Delivery Challan dispatch warehouse picker sheet (API already supported `locationId`). 9-tab bar untouched; `useViewport` on all new modals/sheets. |
| Construction isolation | ✅ | All inventory routes remain gated (`requireInventoryFeature`); construction bill-extract unchanged; barcode/warehouse/anomalies 403 tests still green. |
| Tests + migrations | ✅ | Unit `inventory-ai` **10/10**; targeted quartet **89/89**; mobile tsc clean; Neon: `20260812180000_phase8_scan_ops` + audit `20260812190000_phase8_invoice_line_resource_fk` (SetNull FK for `invoice_line_items.resource_id`). |

### 29.2 Documented bases (v1)

1. **OCR is server-side Tesseract (eng)** - tesseract.js lazily downloads the traineddata on first use (CDN); an operator may vendor it via `langPath` later. PDF/Excel/text invoices never touch OCR.
2. **Batch/lot is a single optional code** carried per line on GRN/issue and per-challan (or per-line) on DC - stored on the movement; **no** serial numbers, expiry/MRP or FEFO allocation.
3. **Margin `revenueSource: 'BILLED'`** = Σ resource-linked invoice-line amounts (ex-GST); `'CATALOG'` = qty sold × `Resource.rate`. The auto draft-issue invoice links resources by default, so margin becomes billed-based as soon as invoices are confirmed.
4. **Notifications reuse `notify()`** - in-app rows always created; PUSH/WhatsApp/SMS honour existing user prefs; all hooks are non-fatal (never break the business flow) and inventory-only.
5. **Barcode camera:** native Expo path + **mobile web** (`getUserMedia` + `BarcodeDetector` / `@zxing/browser`) for phone/tablet — see UX polish **M1** (2026-08-20). Desktop web stays keyboard/paste.

### 29.3 Notes (non-blocking)

1. Per-line batch codes are supported on GRN/issue/DC inputs; the mobile modals expose a single batch field for simplicity (GRN + Challan) and per-line on the bulk issue sheet.
2. DC **dispatch** warehouse picker ships in Phase 8.6; the DC-create UI still defaults to all undelivered SO lines (subset-lines + per-line batch is API-ready).
3. OCR language support is `eng` (bills in Indian English); Hindi/regional OCR + `langPath` vendoring are future polish.
4. Margin by customer (price-list lite via `customerId + resourceId + rate`) is deferred - the preferred invoice-line-link path shipped first; tracked as Phase 9.1.
5. **Audit fix - invoice line FK:** `20260812180000` added `resource_id` + index but not the Prisma `onDelete: SetNull` FK - applied `20260812190000_phase8_invoice_line_resource_fk`.
6. **Audit fix - barcode permissions:** overlay now uses `requestCameraPermissionsAsync` (hook-as-async was broken).

### 29.4 Ops

- [x] `prisma migrate deploy` - applied `20260812180000_phase8_scan_ops` + `20260812190000_phase8_invoice_line_resource_fk` (Neon)
- [ ] Smoke inventory on staging/prod (`owner@hydmaterials.com / Test@1234`): Bills → "Scan invoice" (PDF **and** a photo of a scan); Stock Find → camera Scan; GRN with batch → movement history shows batch; Issue with batch; Dispatch challan from a warehouse; bell → notifications
- [ ] Smoke construction (`owner@reddyconst.com / Test@1234`): `/api/inventory/*` → **403**; existing bill-extract/BOQ flows unchanged
- [ ] (Optional) Vendor tesseract.js `langPath`/traineddata for offline OCR + regional languages


---

## 30. Phase 9 verification (independent audit)

**Audited:** 2026-08-12 - Phase 9 re-verified against §4 Phase 9 + §7 checklist; Neon + test DBs up to date (`phase9_gtm`); targeted **95/95** + mobile tsc clean.

### 30.1 Verdict: **PASS**

| Area | Result | Notes |
|------|--------|-------|
| Customer price lists (9.1) | ✅ | `CustomerPrice` (customerId NULL = company default; service-enforced one default row per resource). `resolveEffectiveRates` used in `createSalesOrder` (rate 0 lines), `createDraftInvoiceFromStockIssue` (no unit price) and `createInvoice` (rate 0 + resource link). Test: ₹120 override beats catalog ₹150 on SO, Issue draft-invoice and manual invoice; list returns `scope: 'CUSTOMER'`. Construction 403. |
| Quote → SO (9.2) | ✅ | `Quote`/`QuoteLine` lifecycle DRAFT → SENT → ACCEPTED/REJECTED; `createSalesOrderFromQuote` copies lines/rates/customer into `createSalesOrder` and links `quote.salesOrderId`; double-convert → 400. Mobile Sales **Quotes sub-tab** (not a 10th tab). |
| Printable PDFs (9.3) | ✅ | SO / DC / GRN PDFs via the existing pipeline (branded header/footer, line tables). Integration test asserts `application/pdf` on all three; inventory-gated (construction 403). Mobile PDF buttons on SO/DC/GRN rows (shared download/share helper). |
| Payment reminders (9.4) | ✅ | Auto overdue notify + manual remind API; audit wired inventory invoice detail **"Send payment reminder"** CTA (construction invoice detail unchanged). |
| AI resource persistence (9.5) | ✅ | `createBillFromDraft` persists `matchedResourceId` in `billSnapshot.lines` - dedicated test asserts the saved snapshot keeps the resource id. |
| UI polish (9.6) | ✅ | Per-line batch on GRN create + DC create; DC create supports **subset of SO lines** (per-line qty + batch; API was already ready). |
| Construction isolation | ✅ | 403 on price-list, quotes, invoice remind + all PDF routes for construction; shared invoice/bill lists untouched (reminders surface via the inventory bell). |
| Tests + migrations | ✅ | `inventory-product` **57/57** (+6 Phase 9); targeted quartet **95/95**; full backend **230/230**; mobile `tsc` clean; `migrate deploy` applied (dev + test) + no-op after. |

### 30.2 Documented bases (v1)

1. **Effective rate order** is `customer override → company default → Resource.rate`; an explicit line rate (SO `rate > 0`, issue `unitPrice`, invoice `rate > 0`) always wins over any price-list override.
2. **Company-default rows** use `customerId = NULL`; Postgres unique constraints treat NULLs as distinct, so the service enforces one default per resource with an upsert-style lookup.
3. **Quotes are non-persisted-only drafts** until ACCEPTED → SO; no RFQ/comparison engine (out of scope).
4. **PDFs reuse `pdf-report.service`** helpers (`drawBrandedHeader`, `tableHeaders`, `summaryLine`) - SO/DC/GRN are simple item tables; invoice/RA PDFs unchanged.
5. **Reminders reuse `notify()`** with a 7-day dedupe keyed by `(recipient, referenceId, type)`; the anomalies dashboard hook fires them opportunistically; the manual Remind endpoint is explicit.
6. **9.5** was already implemented in Phase 7 (`billSnapshot.lines[].matchedResourceId`) - Phase 9 locks it with a test and documents the guarantee.
7. **Audit fix - Remind CTA:** API + `useRemindInvoice` existed but invoice detail lacked a button - added inventory-only "Send payment reminder" on `InvoiceDetailScreen` (SENT/unpaid).

### 30.3 Notes (non-blocking)

1. Manual Remind is on inventory invoice **detail** (audit); list rows stay shared with construction - overdue items also surface via the inventory notifications bell.
2. Mobile effective-rate prefill resolves client-side from the price-list fetch; the backend remains the source of truth and re-resolves on rate-0 lines.
3. Quote PDFs and e-mail/WhatsApp sending are out of scope (no gateway product); the Quotes tab can download an SO PDF after conversion.

### 30.4 Ops

- [x] `prisma migrate deploy` - applied `20260812190000_phase9_gtm` (dev + test)
- [ ] Smoke inventory on staging/prod (`owner@hydmaterials.com / Test@1234`): Parties → Price lists → set an override → SO/Issue shows it; Sales → Quotes → send/accept → create SO; PDF buttons on SO/DC/GRN rows; invoice Remind → bell notification
- [ ] Smoke construction (`owner@reddyconst.com / Test@1234`): `/api/inventory/*` Phase 9 routes → **403**; shared invoice/bill lists unchanged


---

## 31. Phase 10 verification (production-hardening audit)

**Audited:** 2026-08-12 - Phase 10 + release pre-flight re-verified (independent). Neon migrate deploy no-op; targeted **95/95** + mobile tsc clean; `app.json` expo-camera plugin confirmed. Three physical-device §31.4 boxes remain for the operator after native rebuild.

### 31.1 Verdict: **PASS** (zero new features)

### 31.2 Smoke matrix (inventory)

| Smoke item | Result | Where verified |
|------------|--------|----------------|
| Price list → SO/Quote effective rates | ✅ | `inventory-product` 9.1 test: ₹120 override beats catalog ₹150 on SO (rate 0), issue draft-invoice line, manual invoice line; `scope: 'CUSTOMER'` listed |
| Quote → Accept → Sales Order | ✅ | 9.2 test: DRAFT → SEND → ACCEPT → `/quotes/:id/sales-order` copies lines/rates/customer; double-convert 400 |
| SO / DC / GRN PDF | ✅ | 9.3 test: all three return `Content-Type: application/pdf`; inventory-gated |
| Invoice Remind (9.4) | ✅ | 9.4 test: `POST /inventory/invoices/:id/remind` → `INVENTORY_OVERDUE_INVOICE` notification row for OWNER |
| Scan invoice - PDF | ✅ | 7.1 test: `/inventory/ai/bills/extract` returns `{ draft, notes }` (200, never persists) |
| Scan invoice - photo/OCR | ✅ | 8.1 unit tests with a mocked OCR (draft shape + OCR-failure note); tesseract.js path reviewed |
| Stock Find barcode | ⚠️ | 3.4 test: `/inventory/items/by-barcode/:code` hit/miss/construction 403; **camera overlay needs a live device** (§30.4) |
| Batch GRN → Issue | ✅ | 8.3 test: `LOT-2026-A` on GRN IN + issue OUT movements + movement-history API |
| Notifications bell | ⚠️ | 8.5/9.4 tests create the rows; bell/unread badge compiles (`tsc`) - live-device visual check in §30.4 |
| Reports dashboard | ✅ | 6.1–6.3 tests: dashboard deltas, stock-health/warehouse value, margin (catalog + billed) |
| Pricing ₹499 locked | ✅ | Pricing constants test (Phase 0) still green; no pricing touched |

### 31.3 Smoke matrix (construction)

| Item | Result | Where verified |
|------|--------|----------------|
| `/api/inventory/*` → 403 | ✅ | Phase 1–9 route tests (parties/stock/warehouse/reorder/analytics/ai/gtm/price-list/quotes/pdf/remind) |
| Indent Draft→Submit→Approve | ✅ | `procurement.test.ts` multi-line create → DRAFT, approval flow unchanged |
| Bill-extract path still works | ✅ | `bill-extract.test.ts` (permission gates + OWNER extract) |
| Shared invoice/bill/estimate flows | ✅ | Full backend suite 230/230 (construction tests untouched) |

### 31.4 Ops (requires live staging/prod + a device)

- [x] Migrations present: `20260812180000_phase8_scan_ops`, `20260812190000_phase8_invoice_line_resource_fk`, `20260812190000_phase9_gtm`; `prisma migrate deploy` → **no pending migrations** (dev + test)
- [x] Pre-flight (agent-verified): full inventory + construction API smoke (targeted **95/95**, full **230/230**); mobile `tsc` clean; `app.json` expo-camera plugin added (§31.5) so the iOS camera permission prompt is configured
- [ ] Device smoke: Stock home → **Scan** (camera permission prompt → scan → item highlighted); top-bar **🔔** unread badge after a remind/low-stock alert; PDF buttons open the share sheet
- [ ] Device smoke: Bills → **Scan invoice** with a photo (server OCR path) - needs an operator-configured content LLM (D10)
- [ ] Construction device: `/api/inventory/*` untouched in the construction shell; bill-extract Import screen still works

### 31.5 Bug fixes shipped (Phase 10.2, no new features)

1. **Duplicate Reject CTA** on SENT quotes (`apps/mobile/app/inventory/sales.tsx`) - the shared condition rendered Reject twice; SENT now shows one Accept + one Reject, ACCEPTED shows Create sales order + Reject (void).
2. **Quote→SO cache invalidation** (`apps/mobile/services/inventory-gtm.queries.ts`) - `useQuoteToSalesOrder` invalidated `['inventory','transactions','sales-orders']` which never matched the real `['transactions','sales-orders']` key; fixed so the Sales Orders tab refreshes after conversion.
3. **Camera permission audit** - confirmed `BarcodeScannerOverlay` calls `Camera.requestCameraPermissionsAsync` (never the `useCameraPermissions` hook as a plain async function); no change required.
4. **expo-camera iOS permission config** (`apps/mobile/app.json`) - added the `expo-camera` config plugin with a `cameraPermission` usage string. Without it, a managed/dev iOS build has no `NSCameraUsageDescription` and `requestCameraPermissionsAsync()` can crash on a real device (concrete device-blocking bug for the 8.2 Scan smoke item). Config-only, no code path changes.

### 31.6 Deferred (10.4)

Skipped entirely (smoke clean, at-most-one rule, zero-risk release).

### 31.7 Verification run

- `packages/shared` build ✅
- Targeted quartet (`inventory-product|procurement|inventory-labels|inventory-ai`) ✅ **95/95**
- Full backend suite ✅ **230/230**
- Mobile `tsc --noEmit` ✅ clean
- `prisma migrate deploy` ✅ no-op (dev + test)

### 31.8 Independent re-verify notes

1. Quote Reject CTA fix confirmed: SENT = Accept+Reject once; ACCEPTED = Create SO + Reject; action row still `flex-wrap`.
2. Quote→SO invalidates `['transactions','sales-orders']` matching `transactionKeys.salesOrders`.
3. No mobile `/api/inventory` double-prefix paths; barcode permissions still use `requestCameraPermissionsAsync`.
4. **expo-camera plugin** in `apps/mobile/app.json` verified (valid JSON; `cameraPermission` string present). Requires native rebuild before device Scan works on iOS.
5. Independent re-run (this audit): migrate deploy no-op; targeted **95/95**; mobile `tsc` clean.
6. **Agent release gate closed.** Only §31.4 physical-device boxes remain for the operator (§10).

