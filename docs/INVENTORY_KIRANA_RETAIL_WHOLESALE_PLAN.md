# BuildFlow Inventory - Kirana Retail & Wholesale Plan (Deepseek-V4-Flash)

> **Audience:** Deepseek-V4-Flash (coding agent)  
> **Repo:** `/home/prasanna/work/BuildFlow`  
> **Product:** **BuildFlow Inventory** only - RETAIL / WHOLESALE shops with a **Kirana** vertical starter catalog.  
> **Sibling product:** **BuildFlow Construction ERP** - do **not** change Draft → Submit → Approve, daily-report issue, or construction catalogs.  
> **Pricing (locked):** Inventory **₹499/mo**, **₹4,990/yr** ex-GST - do not regress.  
> **Prior work:** [`INVENTORY_HORIZONTAL_PLATFORM.md`](./INVENTORY_HORIZONTAL_PLATFORM.md) Phases 0–10 complete; [`INVENTORY_UX_POLISH.md`](./INVENTORY_UX_POLISH.md) D1–D10 complete.  
> **This doc is Phase 11** of the inventory roadmap. Implement **one phase at a time**. **11.7 + D11 and Phase 11.8 (phone Checkout picker, M7) are code-complete.** Operator device smoke for 11.0–11.8 remaining when no code bugs.

---

## 0. Locked product decisions (do not reopen)

| # | Decision |
|---|----------|
| K1 | Keep `InventoryBusinessProfile` as `RETAIL` or `WHOLESALE` (etc.). Add a separate **vertical** (`KIRANA` first). Do **not** add `KIRANA` as another `InventoryBusinessProfile`. |
| K2 | **Kirana pack is Kirana-only.** Eligible only when `subscriptionPlan === INVENTORY` **and** `inventoryVertical === KIRANA`. RETAIL/WHOLESALE may *become* Kirana via an OWNER vertical picker; MATERIAL_SUPPLIER / DISTRIBUTION / TRADING / EQUIPMENT / GENERAL (and construction) never see Apply/Add-missing. Do **not** offer the pack to every RETAIL/WHOLESALE shop (hardware, stationery, etc.). |
| K3 | Starter catalog is **copied once** into the company `Resource` table (tenant-owned). OWNER/INVENTORY_MANAGER can edit, deactivate, search, import, and add items after that. |
| K4 | Re-apply / “add missing Kirana items” is **insert-missing-only**. Never overwrite tenant-edited name, rate, costPrice, GST, HSN, barcode, or reorder fields. |
| K5 | Template seeds **generic pack-size variants** (staples, snacks, biscuits, confectionery, beverages, dairy/daily-use, personal care, cleaning, household). Do **not** seed opening qty, volatile MRP/sale price as truth, or guessed barcodes. Mark GST/HSN as suggested; allow review before/after apply. |
| K6 | Expiry is **batch-level** (manufacture + expiry on received lots). Counter sales allocate by **FEFO**. Keep aggregate `StockBalance` for analytics + Construction compatibility. |
| K7 | **POS checkout** = evolve walk-in multi-item **stock issue → draft invoice → AUTO_STOCK_ISSUE sales record**. Formal **SO → challan → dispatch** stays unchanged. |
| K8 | Desktop/tablet: tables + split cart. Phone: scan/search + card cart + sticky footer. Do not force desktop tables onto phones. **Checkout / bulk issue is a full-screen workspace**, not a small centered dialog. |
| K9 | Deepseek-v4-flash = **coding agent only**. Do not hard-code it as the in-app chat model (D10). |
| K10 | Feature flags: `kirana_catalog`, `batch_expiry`, `pos_checkout` as specified per sub-phase. |
| K11 | **Inventory cost vs sell.** SKU master stores **cost price** (what the shop pays the vendor) and **selling price** (what the customer pays). `Resource.rate` = selling price. New nullable `Resource.costPrice` = last/default vendor unit cost. `Resource.avgCost` stays computed WAC (read-only). `Resource.mrp` stays printed ceiling. Construction keeps using `rate` as the estimate/catalog rate and must not show a cost/sell split. |

### Non-goals

- No separate `Item` table (keep shared `Resource`)
- No centrally shared mutable catalog rows across tenants
- No full POS hardware / cash drawer / payment terminal integration
- No serial-number tracking
- No FIFO valuation rewrite (WAC stays)
- No Construction procurement / estimate / BOQ changes
- No Inventory price change from ₹499/mo
- No Phase 0–10 rewrites

---

## 1. Current baseline (verified)

| Capability | Status | Notes |
|------------|--------|-------|
| Profile enum RETAIL/WHOLESALE/… | ✅ | Terminology only today (`inventory-labels.ts`) |
| Item CRUD / import | ✅ | `resource.service.ts` + `materials.tsx`; unique `(companyId, name, type)` |
| Bulk issue → draft invoice | ✅ | `MultiIssueStockModal` + `issueStockManual` |
| Formal SO → DC → invoice | ✅ | `sales.tsx` + `TransactionModals` |
| `batchCode` on GRN/issue/DC | ✅ lite | Annotation only - **no** per-batch qty, expiry, or FEFO |
| `StockBalance` | ✅ | Aggregate `(locationId, resourceId)` only |
| Barcode find | ✅ | Navigates to item; does **not** add to cart |
| Sales/stock lists | ✅ cards | Desktop tables exist for invoices (`InvoiceBillLists`) but not Sales tabs |
| Kirana catalog / vertical | ❌ | Not built |
| Batch expiry / FEFO | ❌ | Explicitly deferred in Phase 8.3 |
| POS cart UX | ❌ | Multi-issue is form lines, not POS |

---

## 2. Architecture (target)

```
Company (INVENTORY)
├── inventoryProfile: RETAIL | WHOLESALE | …  (business type)
├── inventoryVertical: KIRANA | null         (shop vertical - pack only when KIRANA)
└── Resource[]  ← Kirana template copy only if vertical = KIRANA
     ├── rate (selling) + costPrice (vendor buy) + mrp + avgCost (WAC)
     ├── trackingMode: NONE | BATCH_EXPIRY
     ├── StockBalance (aggregate - unchanged key)
     └── StockBatchBalance (location + resource + batchCode + dates + qty)
              ↑ FEFO allocation on counter sale / DC dispatch when tracking on
```

**Isolation:** Construction and non-Kirana inventory (including RETAIL hardware / WHOLESALE stationery without vertical KIRANA) never see the pack or require batch dates.

---

## 3. Phased roadmap (implement in order)

### Phase 11.0 - Doc + flags (this file)

| # | Deliverable | Done when |
|---|-------------|-----------|
| 11.0.1 | This plan linked from horizontal roadmap as Phase 11 | Checkboxes below |
| 11.0.2 | Feature flags placeholders: `kirana_catalog`, `batch_expiry`, `pos_checkout` in `plan-modules.ts` (default false until phase ships) | Shared build green |

### Phase 11.1 - Kirana vertical + starter catalog

| # | Deliverable | Key files |
|---|-------------|-----------|
| 11.1.1 | Prisma: nullable vertical/template on `Company` (`KIRANA`) + `seededCatalogAt` (or equivalent) | `schema.prisma` + migration |
| 11.1.2 | Shared enum/labels/validators | `packages/shared/src/inventory-profile.ts`, settings validators |
| 11.1.3 | Versioned template data `kirana-catalog-data.ts` (~100–200 items, categories, pack sizes, HSN/GST hints, reorder defaults, stable `templateKey`) | `apps/backend/prisma/inventory-catalogs/` |
| 11.1.4 | Service `applyCatalogTemplate(companyId, 'KIRANA')` - insert missing only; **require `inventoryVertical === KIRANA`** (plus INVENTORY plan). Profile RETAIL/WHOLESALE alone is **not** enough. | `catalog-template.service.ts` |
| 11.1.5 | OWNER Settings: (a) vertical picker to opt into KIRANA (RETAIL/WHOLESALE only), (b) Apply / Add-missing **only when vertical is KIRANA** - hide card for other inventory types | `inventory/settings.tsx` + settings/catalog API |
| 11.1.5b | **Follow-up (gap):** today eligibility is profile RETAIL/WHOLESALE and the card shows for all inventory with `kirana_catalog`. Tighten to K2 before closing 11.1. | same files + tests |
| 11.1.6 | Extend `listResources` search to name **and** sku / itemCode / barcode | `resource.service.ts` |
| 11.1.7 | Seed RETAIL/WHOLESALE demo tenants with Kirana pack (replace tiny hardware/stationery catalogs or add dedicated Kirana demos) | `seed.ts` |
| 11.1.8 | INVENTORY_MANAGER: CRUD items; **cannot** change vertical/template | permissions already deny `settings.company` |

**Exit:** Apply Kirana twice → same row count; edit a rate → re-apply does not revert; construction catalog untouched.

### Phase 11.2 - Batch + expiry + FEFO

| # | Deliverable | Key files |
|---|-------------|-----------|
| 11.2.1 | `Resource.trackingMode` enum `NONE \| BATCH_EXPIRY` (default `NONE`) | schema |
| 11.2.2 | `StockBatchBalance` table + indexes for FEFO / near-expiry | schema + migration |
| 11.2.3 | Backfill: one `LEGACY` batch per existing balance (null dates) | migration SQL / script |
| 11.2.4 | Central `stock-batch.service.ts`: dual-write aggregate + batch; FEFO allocate OUT | new service |
| 11.2.5 | Wire GRN / opening stock / adjust / transfer / return / issue / DC dispatch | `procurement`, `warehouse`, `return`, `sales-order` services |
| 11.2.6 | Validators: optional mfg/expiry on receipt; reject sell of expired without override | shared validators |
| 11.2.7 | Inventory UI: batch+dates on GRN/opening; batch list on item detail | `procurement.tsx`, `StockModals`, `stock/[resourceId].tsx` |
| 11.2.8 | Expiry buckets + alerts (expired, 0–30, 31–60, 61–90 days) | analytics / `inventory-alerts.service` |
| 11.2.9 | Enable `batch_expiry` feature flag for Kirana vertical tenants after migrate | `plan-modules.ts` |

**Exit:** Multi-lot FEFO splits OUT correctly; expired blocked; Construction GRN/issue unchanged (no mandatory batch).

### Phase 11.3 - POS-style counter sale

| # | Deliverable | Key files |
|---|-------------|-----------|
| 11.3.1 | Refactor `MultiIssueStockModal` → checkout cart (same `issueStockManual` API) | `StockModals.tsx` |
| 11.3.2 | Desktop/tablet: left catalog table + right sticky cart table | `useViewport` / `AdaptiveSheet` |
| 11.3.3 | Phone: search/scan picker + cart cards + sticky checkout footer | mobile layout |
| 11.3.4 | Barcode while checkout open → add/increment line | reuse `BarcodeScannerOverlay` + `useBarcodeLookup` |
| 11.3.5 | Server returns FEFO allocations; UI shows warnings only | issue response shape |
| 11.3.6 | Optional customer (cash vs credit); success → invoice actions + query invalidation | stock / sales / invoices keys |
| 11.3.7 | Enable `pos_checkout` flag | `plan-modules.ts` |

**Exit:** 5+ line walk-in sale creates one draft invoice + AUTO_STOCK_ISSUE SO; formal SO path untouched.

### Phase 11.4 - Responsive sales + stock dashboard

| # | Deliverable | Key files |
|---|-------------|-----------|
| 11.4.1 | Sales tabs: desktop/tablet tables (pattern from `InvoiceBillLists`); phone cards | `sales.tsx` |
| 11.4.2 | Stock home: Kirana KPIs (today’s counter sales, low stock, expiring soon, expired value) | `index.tsx`, `DashboardCards` |
| 11.4.3 | Desktop inventory table; phone searchable grouped rows + quick Checkout / Scan | `index.tsx` |
| 11.4.4 | Empty/loading/error + virtualization/pagination for large catalogs | materials + checkout |

**Exit:** Desktop readable multi-line sales history; phone usable without horizontal scroll hell.

### Phase 11.5 - Selective SKU library, Indian MRP, and quantity intake

This refinement replaces the “copy all 122 rows, then find them” onboarding assumption for new Kirana tenants. The Kirana template remains read-only application master data; a shop copies only the SKUs it selects into its tenant-owned `Resource` catalog. Existing Kirana tenant resources are preserved.

| # | Deliverable | Key files |
|---|-------------|-----------|
| 11.5.1 | Expand the Kirana library from generic rows into searchable Indian SKU/pack variants with `templateKey`, product name, brand/spec, pack size, category, HSN/GST hint, suggested MRP, MRP effective date, and source metadata | `kirana-catalog-data.ts` |
| 11.5.2 | Add `Resource.mrp` + `mrpUpdatedAt` (nullable; construction-safe). Keep `rate` as selling price. Selecting a library SKU pre-fills selling price from MRP, but the user may edit both | schema + migration + resource validators/service |
| 11.5.3 | Replace whole-pack apply for new use with paginated/searchable library APIs and selected-key import. Search name, brand, pack, category, template key/SKU, and optional barcode. Do not create tenant `Resource` rows until selected | catalog routes/service |
| 11.5.4 | Keep Items as tenant-owned master data only. “Add item” searches the shared library or creates a custom item, reviews HSN/GST/MRP/selling price, and creates no stock | `materials.tsx`, catalog routes/service |
| 11.5.5 | Receive quantity separately through formal PO → GRN or audited quick vendor receipt. Receipt captures vendor, invoice, purchase cost and optional batch/manufacture/expiry; tracked products auto-generate a lot code | stock validators/service/UI |
| 11.5.6 | Add an audited batch-metadata correction endpoint/UI to edit manufacture/expiry later without changing quantity or batch identity; reject expiry before manufacture date | `stock-batch.service.ts`, stock routes, item detail |
| 11.5.7 | Show MRP and selling price separately throughout item edit, stock selection, and checkout. Default sale price = current tenant `rate`; warn/block packaged-item selling price above MRP while allowing MRP/rate edits by authorized inventory users | resource UI + CheckoutCart |
| 11.5.8 | Preserve existing 122 copied demo rows; migrate/backfill `mrp` safely and update the Kirana demo to demonstrate selective import without deleting tenant-owned edits | migration + seed |

**Indian pricing rule:** suggested MRPs must carry an “as of” date and maintainable source metadata. They are onboarding suggestions, not live market truth. Never invent a barcode or silently overwrite a tenant’s MRP/rate. UI must label stale suggestions and require review.

**Exit:** A Kirana manager can search the master library, select a SKU, review/edit Indian MRP and selling price, enter quantity with optional dates, create stock in one flow, create a custom SKU when absent, and later correct batch dates. Non-Kirana and Construction tenants cannot access this library.

### Phase 11.6 - Inventory workspace UX (checkout first)

**Problem (verified in code, 2026-08-19):** Kirana Stock → **Checkout** (and non-Kirana **Bulk issue**) still open as a cramped overlay (`CheckoutCart`: desktop `max-w-4xl h-[85%]`; `MultiIssueStockModal`: `max-w-2xl max-h-[85%]`). The left “items table” is a stacked `Pressable` list, not a column table. Catalog is capped at `.slice(0, 60)`. Phone checkout hides on-hand items until the user types a search. Other inventory multi-line dialogs (PO, GRN, indent, SKU picker, SO, invoice/bill create) use the same small `max-w-lg` / `max-h-[85%]` pattern.

**Goal:** Make counter sale and other operational inventory surfaces usable on a real shop desk: **full-screen checkout**, **real item/cart tables on tablet+desktop**, and the same large-workspace treatment for other multi-line inventory modals. Phone stays card/scan-first (K8). **No API / schema / Construction changes.**

| # | Deliverable | Key files |
|---|-------------|-----------|
| 11.6.1 | **Full-screen checkout workspace.** Kirana `CheckoutCart` (Stock **Checkout** / row **Issue**) occupies the viewport: tablet+desktop `w-full h-full` (no `max-w-4xl` / `h-[85%]` / outer `p-4` gutter). Phone near-fullscreen (`h-full` / ≥98%, no tiny sheet). Disable accidental backdrop-dismiss while submitting; keep explicit × / Esc close. Reuse one shell if possible (`AdaptiveSheet` add `size="full"` or a dedicated `InventoryWorkspaceModal`). | `CheckoutCart.tsx`, `AdaptiveSheet.tsx`, `inventory/index.tsx` |
| 11.6.2 | **Desktop/tablet checkout TABLES (required).** Left **on-hand catalog** is a real table with sticky header + row add: **Item · Unit · On hand · MRP · Selling ₹ · Status · Add**. Right **cart** is a real table: **Item · Qty · Selling ₹ · GST% · Line ₹ · Remove**, then totals + Charge footer. Qty/price stay inline-editable. Keep existing qty/MRP validation (do not sell above stock or above MRP). Do **not** force this table onto phones. | `CheckoutCart.tsx` |
| 11.6.3 | **Phone checkout browse.** Catalog must be visible without typing (search filters, does not hide the list). Keep compact cards + sticky **Charge & issue stock** footer + Scan. | `CheckoutCart.tsx` |
| 11.6.4 | **All issuable items.** Remove `.slice(0, 60)` (or replace with virtualized list / paginated fetch). Search still filters name/SKU. Empty state: “No matching items with stock.” | `CheckoutCart.tsx` |
| 11.6.5 | **Non-Kirana Bulk issue** gets the same workspace: full-screen; tablet+desktop line **table** (item picker, qty, selling ₹, optional batch, remove); phone keeps stacked lines but full-height. Same `issueStockManual` API. | `StockModals.tsx` (`MultiIssueStockModal`) |
| 11.6.6 | **Other inventory UX (bounded).** Apply full-screen / large workspace **only** to multi-line operational modals: Kirana SKU picker, quick vendor receipt, New indent, New PO, Record GRN, New sales order, New challan, New invoice, New bill, stock transfer, stock count. Keep **compact** dialogs for single-entity forms (party, warehouse CRUD, adjust stock, opening CSV, price list, scan overlay). Desktop list pages that are still cards-only become tables like Sales/Stock: **Materials, Parties, Warehouse, Procurement (indents/POs/GRNs)**. Phone stays cards. | `KiranaSkuPicker.tsx`, `materials.tsx`, `procurement.tsx`, `TransactionModals.tsx`, `WarehouseModals.tsx`, `parties.tsx`, `warehouse.tsx`, invoice/bill create modals |
| 11.6.7 | **Do not regress.** Formal SO → DC → invoice unchanged. Construction `ProcurementTab` Draft→Submit→Approve untouched. Language pass is **out of this phase** (do not expand i18n). No schema/migration. No new feature flags. | - |

**Layout (tablet + desktop, Kirana checkout):**

```
┌──────────────────────────────── full viewport ────────────────────────────────┐
│ Checkout                                      [Scan]  [×]                     │
├──────────────────────────────────────┬────────────────────────────────────────┤
│ Items on hand                        │ Cart (N)                               │
│ Search ________________              │ TABLE: Item | Qty | ₹ | GST | Line | × │
│ TABLE: Item|Unit|On hand|MRP|₹|Add   │                                        │
│ (scroll, sticky header)              │ Customer (optional, collapsed)         │
│                                      │ Subtotal / GST / Grand total           │
│                                      │ [Charge & issue stock]                 │
└──────────────────────────────────────┴────────────────────────────────────────┘
```

**Agent implementation notes (historical - 11.6 shipped):** CheckoutCart is already `flex-1` full viewport with desktop catalog/cart header rows. Do not revert to `max-w-4xl`. Remaining table-cell compactness is 11.7.6.

**Exit (11.6):** Met. Residuals (cost vs sell, compact cells, chatbot format) are Phase 11.7.

### Phase 11.7 - Cost vs sell, remaining UX, inventory flow audit

**Problem:** Shopkeepers need two prices on every SKU: **cost** (vendor buy) and **sell** (customer). Today both procurement and checkout share `Resource.rate`, so a PO can silently order at MRP/selling price. Materials add/edit still says “Catalog rate for new purchase requests/POs” under the Selling field. Checkout table cells use full labeled `Input`s (tall rows); customer fields are always expanded. The in-app assistant dumps unformatted answers and trailing suggestions.

**Goal:** Split cost and sell across catalog, checkout, and procurement; finish 11.6 residuals; walk every inventory flow; **and** (D11) make the chatbot answer-only with readable formatting for Construction + Inventory.

| # | Deliverable | Key files |
|---|-------------|-----------|
| 11.7.1 | **Schema.** Nullable `Resource.costPrice` `Decimal(12,2)` mapped `cost_price`. Construction-safe (unused there). Backfill **inventory** companies only: `costPrice = avgCost` when `avgCost > 0`, else null. Do **not** overwrite `rate`. Keep `avgCost` WAC updates on stock IN. | schema + migration + resource validators/service |
| 11.7.2 | **Capture on add/edit SKU.** Materials add/edit + Kirana library import + custom item: **Cost price (₹)** and **Selling price (₹)** (+ optional MRP). Helper: cost → future POs/GRNs; sell → checkout/invoices; MRP → printed ceiling. Import API accepts `costPrice`. Sell cannot exceed positive MRP; cost has no MRP cap. | `materials.tsx`, `KiranaSkuPicker.tsx`, catalog import |
| 11.7.3 | **Checkout / bulk issue / sales = sell only.** Prefill from `rate`. Inline-edit selling ₹. Optional muted read-only cost hint. Do not write checkout edits onto `costPrice`. | `CheckoutCart.tsx`, `StockModals.tsx`, `TransactionModals.tsx` |
| 11.7.4 | **Procurement = cost only.** Indent expected rate, PO line, GRN line, quick vendor receipt prefill from `costPrice` (fallback `avgCost`, then 0) - **never** from selling `rate`. GRN/quick receipt updates `costPrice` to that purchase unit cost **and** existing WAC `avgCost`. Labels: “Cost ₹” / “Purchase rate ₹”. | `procurement.tsx`, `StockModals.tsx`, procurement/stock/reorder services |
| 11.7.5 | **Lists.** Items/stock desktop tables: Cost and Selling columns. Phone cards: “Cost ₹x · Sell ₹y”. Reorder `catalogRate` = `costPrice`. | `materials.tsx`, `index.tsx`, `reorder.service.ts` |
| 11.7.6 | **11.6 residual UX.** Compact numeric cells in checkout/bulk-issue tables (no labeled `Input` in a table row). Collapse customer block behind “Add customer”. Keep full-screen workspace. | `CheckoutCart.tsx`, `StockModals.tsx` |
| 11.7.7 | **Flow audit (inventory product).** Fix only real bugs on: Add item (no stock) → Quick receipt or PO→GRN (qty + cost) → Stock on hand → Checkout (sell, FEFO, draft invoice → Mark sent → Record payment) → Formal SO→DC→invoice → Returns → Transfer/count → Parties/warehouses. Construction `ProcurementTab` create stays **DRAFT**. | tests + UI |
| 11.7.8 | **D11 chatbot (entire system).** See [`INVENTORY_UX_POLISH.md`](./INVENTORY_UX_POLISH.md) D11: answer the question only (no trailing suggestions); structured markdown; render it in chat UI. Construction + Inventory + marketing. D10 routing unchanged. | `prompt-builder.ts`, `AssistantChatContent.tsx` |

**Price field map (inventory only):**

| Field | Meaning | Set when | Editable in |
|-------|---------|----------|-------------|
| `costPrice` | Last/default vendor unit cost | Add SKU; updated on GRN/quick receipt | Items, PO/GRN/receipt |
| `rate` | Selling price to customer | Add SKU; checkout/SO may override **line** only | Items, checkout, SO/invoice |
| `mrp` | Printed MRP ceiling | Add SKU / item edit | Items (sale cannot exceed if set) |
| `avgCost` | Weighted-average cost | Server on stock IN | Read-only |

**Exit:** Kirana demo can set cost ₹80 and sell ₹95 on a SKU; a new PO line prefills ₹80; checkout prefills ₹95; GRN at ₹82 updates cost to ₹82 and WAC; construction estimates still use `rate`. Assistant replies are formatted and do not append “you can also ask…”.

### Phase 11.8 - Kirana phone Checkout item picker (DONE)

**Problem:** Desktop/tablet Checkout catalog is usable (Item · Unit · On hand · MRP · Selling · Status · Add). On **phone**, after Checkout opens, selecting *different* items is not counter-friendly: `CheckoutCart.tsx` caps catalog at `max-h-[38%]` with name-only rows, cart uses tall labeled `Input`s, nested scrolls fight, adding SKU #2/#3 is slow.

**Inspiration:** Marketed Inventory POS / counter speed (`apps/mobile/constants/marketing.ts`, `docs/INVENTORY_TYPES_GUIDE.md`) - phone must feel like a shop counter. Profiles still only change labels. Full detail: `INVENTORY_UX_POLISH.md` **M7**.

| ID | Work | Primary files |
|----|------|----------------|
| 11.8.1 | Phone **Browse \| Cart (N)** modes; Browse = full-height catalog (search+Scan sticky); Cart = full-height lines + sticky Charge. Remove permanent `max-h-[38%]` catalog+cart split. Desktop/tablet tables **unchanged**. | `CheckoutCart.tsx` |
| 11.8.2 | Phone catalog rows: name, on hand+unit, selling ₹ (+MRP), Low badge, Add/tap-to-add (increment if in cart). Search also matches sku/itemCode/barcode. | `CheckoutCart.tsx` |
| 11.8.3 | Phone cart lines: compact qty steppers / cell inputs + sell price; no tall labeled Input pairs; line ₹ + GST% + remove. | `CheckoutCart.tsx` |
| 11.8.4 | Safe-area / keyboard-safe sticky Charge; Scan still adds to cart; FEFO/server allocation unchanged. | `CheckoutCart.tsx`, `useKeyboardOpen.ts` |
| 11.8.5 | Light phone Stock shell polish if needed (readable rows, single CTA) - UX polish M7.2. | `inventory/index.tsx` |

**Exit (11.8):** Phone browses full-height catalog, adds 5 different items quickly, edits cart, Charges; desktop checkout unchanged; mobile `tsc` clean; tick §8 + UX polish M7.

---

## 4. Schema sketch (implement carefully)

```prisma
enum InventoryVertical {
  KIRANA
}

enum ResourceTrackingMode {
  NONE
  BATCH_EXPIRY
}

// on Company (inventory only; null on construction)
inventoryVertical   InventoryVertical? @map("inventory_vertical")
catalogSeededAt     DateTime?          @map("catalog_seeded_at")

// on Resource (Phase 11.5–11.7)
trackingMode ResourceTrackingMode @default(NONE) @map("tracking_mode")
mrp          Decimal?  @db.Decimal(12, 2)
costPrice    Decimal?  @map("cost_price") @db.Decimal(12, 2) // inventory vendor cost; ignore on construction
// rate = selling (inventory) / estimate catalog (construction)
// avgCost = WAC, server-maintained

model StockBatchBalance {
  id             String    @id @default(uuid()) @db.Uuid
  locationId     String    @map("location_id") @db.Uuid
  resourceId     String    @map("resource_id") @db.Uuid
  batchCode      String    @map("batch_code")
  manufacturedAt DateTime? @map("manufactured_at")
  expiresAt      DateTime? @map("expires_at")
  quantity       Decimal   @db.Decimal(12, 3)
  receivedAt     DateTime  @default(now()) @map("received_at")
  // @@unique([locationId, resourceId, batchCode])
  // indexes: (resourceId, expiresAt), (locationId, expiresAt)
}
```

Names may be adjusted for consistency with existing snake_case maps, but semantics must match.

---

## 5. Agent rules (every pass)

1. **One phase only** (11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 → 11.7). Do not start the next until checklist + tests for the current phase are green. This pass also includes D11 (chatbot format) because it is product-wide, not Kirana-only.  
2. Migration before dependent UI.  
3. After code: shared build → migrate → targeted tests → mobile `tsc`.  
4. Update **this file’s checklist** with evidence (commands + pass counts). Do not tick boxes without running.  
5. Prefer inventory UI fixes; never loosen Construction indent auto-approve gating.  
6. If blocked, stop and document; do not invent parallel Item tables or break `Resource` uniqueness.

---

## 6. Test matrix (required)

### Inventory / Kirana

| Case | Expect |
|------|--------|
| Apply Kirana when `inventoryVertical=KIRANA` | N resources created |
| Apply again | 0 new rows (idempotent) |
| Edit rate then add-missing | Edited rate preserved; only missing keys inserted |
| Set vertical KIRANA on RETAIL/WHOLESALE | Allowed (OWNER) |
| Apply without vertical / on MATERIAL_SUPPLIER / hardware RETAIL without KIRANA | Rejected / card hidden |
| WHOLESALE without vertical KIRANA | Pack not available |
| Manager creates custom item | OK |
| Manager changes vertical | Denied |
| Search by SKU/barcode | Finds item |
| GRN with batch + expiry | Batch balance + aggregate increase |
| Issue qty spanning 2 lots | FEFO oldest first; two OUT movements or allocation payload |
| Issue expired only | Error unless override |
| Transfer | Batch qty moves with lot |
| Sales return GOOD | Restores known batch when available |
| Multi-line checkout | Draft invoice + AUTO_STOCK_ISSUE SO |
| Formal SO → DC → invoice | Unchanged |
| SKU cost ₹80 / sell ₹95 | PO/GRN/reorder prefill 80; checkout/SO prefill 95 |
| GRN at ₹82 | `costPrice` becomes 82; `avgCost` WAC updates; `rate` unchanged |
| Construction resource | No `costPrice` UI; estimate `rate` unchanged |

### Construction regression

| Case | Expect |
|------|--------|
| Multi-line indent create | `DRAFT` |
| Stock issue (construction) | No draft sales invoice |
| GRN | No mandatory expiry fields |
| Catalog | Construction `CATALOG_DATA` untouched |

### Commands

```bash
cd /home/prasanna/work/BuildFlow/packages/shared && pnpm run build
cd /home/prasanna/work/BuildFlow/apps/backend && pnpm exec prisma validate && pnpm exec prisma migrate deploy
cd /home/prasanna/work/BuildFlow/apps/backend && pnpm test -- --testPathPattern='inventory-product|procurement.test|inventory-labels' --forceExit
cd /home/prasanna/work/BuildFlow/apps/mobile && pnpm exec tsc --noEmit
```

Add new test files under `apps/backend/src/__tests__/` for catalog template + FEFO when introduced.

---

## 7. Credentials for manual smoke

| Tenant | Login | Password | Notes |
|--------|-------|----------|-------|
| Kirana retail | `owner@kirana-demo.com` | `Test@1234` | Shri Ganesh Kirana - use for 11.6 checkout smoke |
| Existing retail | `owner@cityhardware.com` | `Test@1234` | Until seed replaced |
| Existing wholesale | `owner@deccanwholesale.com` | `Test@1234` | Until seed replaced |
| Construction | `owner@reddyconst.com` | `Test@1234` | Regression only |
| Materials (non-Kirana) | `owner@hydmaterials.com` | `Test@1234` | Must **not** get Kirana pack by default |

---

## 8. Checklist

### Phase 11.0

- [x] Horizontal roadmap points here as Phase 11
- [x] Feature flag placeholders added: `kirana_catalog` (true - shipped 11.1), `batch_expiry`/`pos_checkout` (false - 11.2/11.3) in `packages/shared/src/plan-modules.ts`

### Phase 11.1 - Catalog

- [x] Migration applied - `apps/backend/prisma/migrations/20260816100000_phase11_kirana_vertical/migration.sql` (`InventoryVertical` enum + nullable `companies.inventory_vertical` + `catalog_seeded_at`); `prisma validate` ok; `migrate deploy` applied on dev + test DBs (no pending)
- [x] Kirana template data committed - `apps/backend/src/catalog-data/kirana-catalog-data.ts`: 122 generic pack-size items (KIR-001…KIR-122) across Staples/Dairy/Snacks/Biscuits/Confectionery/Beverages/Personal care/Cleaning with suggested HSN + GST + reorder, stable `templateKey` → `itemCode`, NO opening qty / price / barcode (K4)
- [x] Apply / add-missing API + Settings UI - `POST /api/inventory/catalog/apply` + `GET /api/inventory/catalog/preview` (OWNER-only, `kirana_catalog`-gated): `catalog-template.service.ts` insert-missing-only (K3, soft-deleted template rows restored - Resource unique companyId/name/type), stamps `inventoryVertical` + `catalogSeededAt`, vertical gate (K2, follow-up below); mobile Settings card with category preview + Apply/Add-missing
- [x] Resource search includes sku/itemCode/barcode - `resource.service.ts listResources` OR extended
- [x] Seed demos updated - `seed.ts` adds dedicated Kirana RETAIL demo `owner@kirana-demo.com` (Shri Ganesh Kirana) applying the same service; seed log `✅ Seed complete` (2026-08-16) with `created 122, skipped 0`; non-Kirana inventory demos (hydmaterials, cityhardware, etc.) do **not** receive the pack
- [x] **K2 gate follow-up (11.1.5b)** - pack is now Kirana-**vertical-only**: `catalog-template.service.ts` `eligibilityReason` requires `inventoryVertical === KIRANA` (INVENTORY plan) - profile RETAIL/WHOLESALE alone is NOT enough; new OWNER-only `PUT /api/inventory/catalog/vertical` (`catalogVerticalSchema`, `kirana_catalog`-gated) opts a RETAIL/WHOLESALE shop into/out of KIRANA, all other profiles 422 (MATERIAL_SUPPLIER/DISTRIBUTION/TRADING/EQUIPMENT/GENERAL + construction never reach it); mobile Settings hides the catalog card unless `inventoryVertical === 'KIRANA'` (`useCatalogPreview` `enabled`-gated → no flash/ineligible UI) and adds a "Shop vertical" picker for RETAIL/WHOLESALE OWNERs; seed demo tenant created with `inventoryVertical: KIRANA`; tests updated: RETAIL-no-vertical ineligible, opt-in→apply→stamp, WHOLESALE opt-in ok, MATERIAL_SUPPLIER 422, manager/construction 403
- [x] Tests green + construction regression - full backend `238/238` (31 suites) re-verified in this pass; targeted trio `inventory-product|procurement.test|inventory-labels` `95/95` incl. 8 `KIRANA_VERTICAL (Phase 11.1)` tests (7 original + K2 vertical-picker); construction indent `DRAFT` + no draft invoice on construction issue still green (procurement suite); also fixed a latent `listInvoices` serializer gap (surface `salesOrderId`, Phase 2.1 assertion). Flakiness fix (pre-existing, unrelated to Phase 11.1): three construction suites sat just under jest's 30s default in the 08:26 baseline (`material-rate-variance` 28.7s, `material-rate-alert` 27.3s, `procurement` 30.1s) and crossed it under memory pressure - per-test/suite timeouts raised to 60–120s in those three test files with explanatory notes
- [x] Shared build + mobile tsc - `@buildflow/shared` build ok; `apps/mobile tsc --noEmit` clean

### Phase 11.2 - Batch / expiry

- [x] Migration + LEGACY backfill - `apps/backend/prisma/migrations/20260816110000_phase11_kirana_batch_expiry/migration.sql`: `ResourceTrackingMode` enum, `resources.tracking_mode` (default `NONE`), `stock_batch_balances` table (`@@unique(locationId, resourceId, batchCode)` + FEFO indexes `(resourceId, expiresAt)` / `(locationId, expiresAt)`), receipt lot dates on `goods_receipt_lines`, and a LEGACY backfill (one null-dated lot per existing balance of already-tracked resources). Applied via `migrate reset` on the test DB (both Phase 11 migrations clean; seed ✅)
- [x] Dual-write + FEFO service - `stock-batch.service.ts`: `applyBatchIn` (IN upsert/increment), `allocateBatchOut` (FEFO - earliest `expiresAt` first, nulls last, expired lots blocked unless `allowExpired`), `expiryBucket` helper, `listResourceBatches` + `expirySummary` read surfaces; aggregate `StockBalance` stays the single analytics/construction key (K6)
- [x] GRN / issue / transfer / return wired - GRN (batch required for tracked items + mfg/expiry copied to receipt line & lot), `issueStockManual` (one OUT movement per allocated lot + `allowExpired` override), `adjustStock` (increases applyBatchIn / decreases FEFO), opening stock import (batch rows for tracked items), `dispatchTransfer`+`receiveTransfer` (lot qty moves with the batch - recreate from TRANSFER_OUT movements), `dispatchDeliveryChallan` (FEFO per-lot movements), sales return GOOD (restores the lot sold via `Invoice.stockMovementId`, else RET-<ts>)
- [x] Inventory UI for dates + item batches - GRN modal per-line batch/mfg/expiry inputs; opening-stock CSV accepts `qty,rate,batch,mfg,exp`; issue modal "Include expired" override; item detail (`stock/[resourceId].tsx`) "Batches & expiry" list with bucket badges - all gated on the Kirana vertical (`batch_expiry` flag)
- [x] Expiry alerts/buckets - `GET /api/inventory/stock/batches?resourceId=` + `GET /api/inventory/stock/expiry-summary` (EXPIRED / 0–30 / 31–60 / 61–90 / >90) - Kirana-vertical-only (403 otherwise)
- [x] Construction paths unchanged - `trackingMode` defaults `NONE`; construction GRN has no mandatory batch/expiry, indents stay `DRAFT`, no draft invoice on construction issue (procurement suite green); `batch_expiry` surfaces + `BATCH_EXPIRY` resource flag are rejected for non-Kirana tenants (403/422)
- [x] Tests green + mobile tsc - new `kirana-batch-expiry.test.ts` (7 tests: GRN dual-write, 2-lot FEFO split, expired blocked/override, transfer lot move, return lot restore, Kirana-only gates, construction GRN no-batch); trio `inventory-product|procurement.test|inventory-labels` re-run green; backend `tsc --noEmit` + mobile `tsc --noEmit` clean; shared build ok

### Phase 11.3 - POS checkout

- [x] Desktop split cart - `components/inventory/CheckoutCart.tsx` (K8): desktop/tablet = searchable/filterable items table LEFT + persistent cart RIGHT (qty, selling price, per-item GST, line/subtotal/GST/grand total, low-stock + "FEFO lots assigned by server" warnings). Wired on the stock home for Kirana-vertical tenants (`pos_checkout` flag); non-Kirana inventory keeps the same `MultiIssueStockModal` counter issue - nothing breaks
- [x] Phone cart + sticky footer - CheckoutCart on phones: search/scan-first picker + compact cart cards + sticky "Charge & issue stock" footer (`useViewport` tiers; no desktop tables forced on phones)
- [x] Barcode add-to-cart - Scan button opens the reused `BarcodeScannerOverlay`; scanned code adds/increments the cart line (direct barcode lookup, same code re-scan safe). Stock-home "Find" still navigates to the item when the checkout is CLOSED
- [x] FEFO feedback from server - `issueStockManual` now returns per-line `allocations` (batchCode/quantity/expiresAt) for batch-tracked items (11.2 FEFO); the UI only warns/echoes (`· lots: …` toast + cart hints) and never chooses lot quantities; `allowExpired` override passed through where already supported
- [x] Formal SO untouched - SO → DC → invoice path unchanged (regression suite green); 5+ line walk-in sale = one draft invoice + one AUTO_STOCK_ISSUE SO (K7) via the same `issueStockManual` API
- [x] Tests green + mobile tsc - new `kirana-batch-expiry` case: 5-line POS checkout → draft invoice + AUTO_STOCK_ISSUE SO + server FEFO allocations; construction issue still creates no inventory invoice; trio `inventory-product|procurement.test|inventory-labels` re-run green; backend `tsc` + mobile `tsc` clean; shared build ok

### Phase 11.4 - Tables / dashboard

- [x] Sales desktop tables / phone cards - `app/inventory/sales.tsx`: orders/quotes/deliveries/returns/credit-debit notes now render multi-line desktop/tablet TABLE rows (column headers + number/customer/status/total/actions, InvoiceBillLists pattern) with `useViewport` (`isTablet || isDesktop`); phones keep the existing card list with the same actions - no horizontal-scroll hell; formal SO/challan/quote/return/note actions unchanged
- [x] Kirana KPIs on stock home - `DashboardCards.tsx` `KiranaKpiCards` (Kirana-vertical only): today's counter sales (₹), low stock count, expiring soon (0–30d qty + WAC value), expired stock value (WAC); reuses `useInventoryDashboard` + `useExpirySummary` (backend `expirySummary` now also returns `EXPIRED_VALUE`/`0_30_VALUE`). Non-Kirana verticals keep the executive DashboardCards row unchanged
- [x] Desktop stock table / phone rows - `app/inventory/index.tsx`: desktop dense stock table (Name · Balance · WAC · Value · Actions + column header); phones get searchable rows (new search field) + quick **Checkout** entry (Kirana, opens the 11.3 cart) / **Scan** + **Find** barcode entry points; empty/loading/error states added (FlatList virtualization covers large catalogs; materials already virtualized)
- [x] Viewport smoke notes recorded - manual notes below (code-complete; no device env available, results not invented)
- [x] Final suites green - backend `tsc`, mobile `tsc`, shared build clean; targeted trio + `kirana-batch-expiry` green; full backend green; construction regressions unchanged

**Manual viewport notes (code-complete only, no device env):**
- Desktop (≥1024px): Sales tab shows a real table (rows + column headers) and Stock home shows the dense stock table + split-column header. Cart checkout uses the left-catalog/right-cart split (11.3).
- Tablet (768–1023px): same table tier via `isTablet`; cards only below 768px.
- Phone (<768px): Sales = card list with concise actions; Stock = searchable rows; checkout = search/scan-first + compact cart + sticky footer. No desktop tables are forced onto phones (K8).
- Web keyboard: `Button` keeps its `focus-visible` ring; inputs are natively tab-focusable; scan/search/cart controls now expose `accessibilityLabel` (Button/Input updated to forward it).

### Phase 11.5 - Selective SKU / MRP / quantity intake

- [x] Migration adds nullable `Resource.mrp` + `mrpUpdatedAt`; `rate` remains editable selling price; migration `20260816210000_phase11_5_kirana_sku_mrp` applied to test + Neon dev; construction-safe
- [x] Kirana library exposes searchable Indian SKU/pack variants with editable indicative MRP, `2026-08-16` effective date, and “verify printed MRP” source metadata; no guessed barcodes
- [x] Library browse/search (`GET /api/inventory/catalog/library`) is Kirana-vertical-only and new UI does not pre-copy the full pack
- [x] Item-master intake (`POST /api/inventory/catalog/import-items`) copies only selected products or creates a custom item, with no quantity side effect
- [x] Vendor quantities are received separately through PO/GRN or audited quick receipt (`POST /api/inventory/stock/quick-receipt`) with purchase cost and optional batch/mfg/expiry
- [x] Optional expiry can be corrected later through audited `PATCH /api/inventory/stock/batches/:id`; endpoint cannot change quantity/batch identity
- [x] Item edit + checkout display MRP separately from selling price; authorized resource users edit both; client + server prevent sale price above positive MRP
- [x] Existing Kirana demo resources survive nullable migration; selecting a pre-copied row upgrades it to tracking and creates a LEGACY lot first if aggregate stock exists
- [x] Integration tests cover item-master-without-stock, quick vendor receipt, MRP/optional expiry and later audited date correction; existing Kirana/FEFO/Construction regressions remain green
- [x] Shared build, Prisma validate, backend/mobile TypeScript clean; full backend **250/250**

### Phase 11.6 - Inventory workspace UX

- [x] Full-screen CheckoutCart on tablet+desktop (no `max-w-4xl` / `h-[85%]` gutter); phone near-fullscreen
- [x] Desktop/tablet **catalog table** (Item · Unit · On hand · MRP · Selling ₹ · Status · Add) with sticky header
- [x] Desktop/tablet **cart table** (Item · Qty · Selling ₹ · GST% · Line ₹ · Remove) + sticky Charge footer
- [x] Phone catalog visible without typing; search still filters; sticky Charge footer kept
- [x] Issuable catalog not truncated at 60 rows (virtualize or show all filtered)
- [x] Non-Kirana `MultiIssueStockModal` full-screen + desktop line table; same `issueStockManual` API
- [x] Multi-line operational modals (SKU picker, quick receipt, indent/PO/GRN, SO/challan, invoice/bill create, transfer, count) use large/full workspace; single-entity forms stay compact
- [x] Desktop tables for Materials, Parties, Warehouse, Procurement lists (phone cards unchanged)
- [x] Construction regressions green (indent DRAFT, no construction draft invoice); shared build + mobile `tsc`; no schema/migration; do not expand i18n in this pass
- [x] §6 commands run; evidence recorded here

**Verification (2026-08-19, code-complete):** shared build `tsc --noEmit` clean; mobile `tsc --noEmit` clean (CheckoutCart, StockModals, AdaptiveSheet, procurement, materials, parties, warehouse, invoices/bills, TransactionModals, WarehouseModals, KiranaSkuPicker); full backend jest **250/250 (32 suites)** including construction procurement + phase5 regressions. No schema/migration, no new flags, no i18n expansion. **Residuals tracked in 11.7.6 / 11.7.1–11.7.5.**

**Viewport notes (code-complete only, no device env):**
- Desktop (≥1024px) / tablet (768–1023px): Checkout = full-viewport workspace; left on-hand catalog TABLE (Item · Unit · On hand · MRP · Selling ₹ · Status · Add, sticky header) + right cart TABLE (Item · Qty · Selling ₹ · GST% · Line ₹ · Remove) with totals + sticky Charge footer; Esc / × close; backdrop dismiss disabled while submitting. Bulk issue (non-Kirana) = full-screen with a line table (Item · Qty · Selling ₹ · Batch · Remove). Materials / Parties / Warehouse / Procurement list pages show real table rows + column headers. Indent/PO/GRN, SO/challan/quote/returns, invoice/bill create, transfer, count, SKU picker, quick vendor receipt open full-screen.
- Phone (<768px): checkout = search/scan-first with catalog always visible (search filters, does not hide), compact cards + sticky Charge & issue stock footer; other pages keep cards (K8). Single-entity dialogs (party/warehouse CRUD, adjust stock, opening CSV, price list, scan overlay) remain compact.

### Phase 11.7 - Cost vs sell + remaining UX + D11

- [x] `Resource.costPrice` migration; inventory backfill from `avgCost`; construction rows unchanged; `rate` still selling
- [x] Add/edit SKU + Kirana import capture **Cost** and **Selling** (+ MRP); helper copy no longer says selling is the PO catalog rate
- [x] Checkout / bulk issue / SO lines prefill and edit **sell** only
- [x] PO / GRN / indent / quick receipt / reorder prefill and edit **cost** (`costPrice`, not `rate`); GRN updates `costPrice` + WAC
- [x] Desktop item/stock tables show both columns; phone cards show both
- [x] Checkout table cells compact; customer block collapsed until needed
- [x] Flow audit: add item → receive → checkout → invoice payment; SO→DC→invoice; construction indent stays DRAFT
- [x] D11: prompt answer-only + markdown; chat UI renders formatting (Construction + Inventory + marketing)
- [x] Shared build, Prisma validate, backend/mobile `tsc`, targeted + construction tests; evidence here

**Verification (2026-08-19, code-complete):**
- Migration `20260819000000_phase11_7_cost_price` applied to the test DB (`prisma migrate deploy` clean); `prisma validate` clean.
- Shared build `tsc` clean; backend `tsc --noEmit` clean; mobile `tsc --noEmit` clean (materials, KiranaSkuPicker, CheckoutCart, StockModals, procurement, index, TransactionModals, invoices, AssistantChatContent).
- Backend jest **all green**: `inventory-product.test.ts` 69/69 (includes 4 new Phase 11.7 cases: cost/sell capture + indent/reorder use cost + summary exposes sell/cost; GRN at ₹82 → costPrice 82 + WAC + rate untouched; quick receipt updates costPrice + WAC; construction resource costPrice stays null), `procurement.test.ts`, `inventory-labels.test.ts`. Reorder Phase 4.3 test updated to assert PO rate = costPrice (K11).
- Exit criteria: SKU cost ₹80 / sell ₹95 → indent/reorder/PO prefill ₹80; stock summary `catalogRate` (checkout prefill) = ₹95 with `costPrice` ₹80 read-only; GRN at ₹82 updates costPrice + WAC and leaves rate; construction estimates keep `rate`.

### Phase 11.8 - Kirana phone Checkout item picker

- [x] 11.8.1 Phone Browse | Cart (N) modes; Browse full-height catalog; Cart full-height + sticky Charge; no permanent `max-h-[38%]` split
- [x] 11.8.2 Phone catalog rows show name, on hand+unit, selling ₹ (+MRP), Low, Add; search matches sku/itemCode/barcode
- [x] 11.8.3 Phone cart lines compact (qty steppers + sell); no tall labeled Inputs
- [x] 11.8.4 Safe-area / keyboard-safe Charge; Scan→cart unchanged; FEFO unchanged
- [x] 11.8.5 Optional Stock phone row/CTA polish (M7.2)
- [x] Desktop/tablet Checkout layout visually unchanged
- [x] Mobile `tsc --noEmit` clean; evidence below

**Verification (2026-08-23, code-complete):** UI-only pass - `CheckoutCart.tsx` phone branch only (desktop/tablet two-pane tables untouched). `pnpm --filter @buildflow/mobile exec tsc --noEmit` clean. No schema/API change (stock summary `sku`/`itemCode`/`barcode` already surfaced in M4); no construction gating, pricing, or FEFO changes. Code path reviewed for the same flow; **live phone/PWA smoke still operator-owned** (Kirana `owner@kirana-demo.com` / `Test@1234`): Browse → 5 adds → Cart edit → Charge.

---

## 9. Deepseek agent command (copy-paste) - post-11.8

> Phase 11.8 / M7 are **code-complete**. Do not re-build Browse|Cart unless fixing a filed smoke bug.

```
Read:
- docs/INVENTORY_UX_POLISH.md §3 M7 (DONE) + §7 post-M7 command
- docs/INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md Phase 11.8 (DONE) + this §9
- docs/INVENTORY_HORIZONTAL_PLATFORM.md §1.3 + §3

Deepseek-v4-flash = coding agent only. Do NOT hard-code it as the chat model (D10).

11.0–11.8 + M1–M7 are CODE-COMPLETE (CheckoutCart phone Browse|Cart shipped).

THIS PASS:
- Fix only concrete phone/PWA Checkout or Stock bugs found in operator smoke
- OR stop if none

Do NOT: re-litigate 11.8 UX, change Construction gating, change ₹499 price,
rewrite FEFO, remove desktop checkout tables.

VERIFY: pnpm --filter @buildflow/mobile exec tsc --noEmit
AFTER: append smoke notes under §8 Phase 11.8; stop.
```


## 10. File touch map (expected)

| Area | Paths |
|------|--------|
| Schema / seed | `apps/backend/prisma/schema.prisma`, `migrations/*`, `inventory-catalogs/kirana-catalog-data.ts`, `seed.ts` |
| Catalog apply | `apps/backend/src/services/*catalog*`, `settings.service.ts`, `resource.service.ts` |
| Batch / FEFO | `stock-batch.service.ts`, `procurement.service.ts`, `warehouse.service.ts`, `return.service.ts`, `sales-order.service.ts` |
| Shared | `packages/shared/src/inventory-profile.ts`, `plan-modules.ts`, validators, `permissions/prompt-builder.ts` |
| UI | `inventory/settings.tsx`, `materials.tsx`, `StockModals.tsx`, `CheckoutCart.tsx`, `AdaptiveSheet.tsx`, `KiranaSkuPicker.tsx`, `procurement.tsx`, `TransactionModals.tsx`, `WarehouseModals.tsx`, `parties.tsx`, `warehouse.tsx`, `stock/[resourceId].tsx`, `sales.tsx`, `index.tsx`, `DashboardCards.tsx`, `BarcodeScannerOverlay.tsx`, `components/assistant/AssistantChatContent.tsx` |
| Tests | `inventory-product.test.ts` (+ new kirana/FEFO cases), `procurement.test.ts` construction regressions |

---

## 11. Status

| Phase | Status | Date |
|-------|--------|------|
| 11.0 Plan doc | DONE (doc + horizontal link) | 2026-08-16 |
| 11.1 Catalog | DONE - incl. **K2 gate follow-up (11.1.5b)** (Kirana-vertical-only pack + OWNER vertical picker; §8 evidence) | 2026-08-16 |
| 11.2 Batch/expiry | DONE - trackingMode + StockBatchBalance + FEFO service, GRN/issue/adjust/opening/transfer/DC/return wired, Kirana-only gates, UI (GRN dates, issue override, item batches), expiry buckets API (§8 evidence) | 2026-08-16 |
| 11.3 POS checkout | DONE - CheckoutCart split cart (desktop/phone), barcode add-to-cart, server FEFO allocations in issue response, AUTO_STOCK_ISSUE SO, pos_checkout flag (§8 evidence) | 2026-08-16 |
| 11.4 Sales/dashboard UI | DONE - sales desktop tables / phone cards, Kirana KPIs, desktop stock table + phone searchable rows, viewport notes (§8 evidence) | 2026-08-16 |
| 11.5 Selective SKU/MRP intake | DONE - tenant-only item master, library/custom add, HSN + tracking edit, PO/GRN or quick vendor receipt, optional editable batch expiry (§8 evidence) | 2026-08-16 |
| 11.6 Inventory workspace UX | DONE - full-screen checkout + desktop tables; residuals in 11.7.6 | 2026-08-19 |
| 11.7 Cost vs sell + flow audit + D11 | DONE - `costPrice` vs selling `rate`, procurement/checkout split, compact checkout cells, D11 answer-only markdown (§8 evidence). Operator device smoke remaining. | 2026-08-19 |
| 11.8 Kirana phone Checkout item picker | **DONE** - Browse\|Cart modes, rich catalog rows, compact cart; desktop unchanged (M7). Operator device smoke remaining. | 2026-08-23 |
