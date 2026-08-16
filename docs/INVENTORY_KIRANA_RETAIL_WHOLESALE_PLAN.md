# BuildFlow Inventory - Kirana Retail & Wholesale Plan (Deepseek-V4-Flash)

> **Audience:** Deepseek-V4-Flash (coding agent)  
> **Repo:** `/home/prasanna/work/BuildFlow`  
> **Product:** **BuildFlow Inventory** only - RETAIL / WHOLESALE shops with a **Kirana** vertical starter catalog.  
> **Sibling product:** **BuildFlow Construction ERP** - do **not** change Draft → Submit → Approve, daily-report issue, or construction catalogs.  
> **Pricing (locked):** Inventory **₹499/mo**, **₹4,990/yr** ex-GST - do not regress.  
> **Prior work:** [`INVENTORY_HORIZONTAL_PLATFORM.md`](./INVENTORY_HORIZONTAL_PLATFORM.md) Phases 0–10 complete; [`INVENTORY_UX_POLISH.md`](./INVENTORY_UX_POLISH.md) D1–D10 complete.  
> **This doc is Phase 11** of the inventory roadmap. Implement **one phase at a time**.

---

## 0. Locked product decisions (do not reopen)

| # | Decision |
|---|----------|
| K1 | Keep `InventoryBusinessProfile` as `RETAIL` or `WHOLESALE` (etc.). Add a separate **vertical** (`KIRANA` first). Do **not** add `KIRANA` as another `InventoryBusinessProfile`. |
| K2 | **Kirana pack is Kirana-only.** Eligible only when `subscriptionPlan === INVENTORY` **and** `inventoryVertical === KIRANA`. RETAIL/WHOLESALE may *become* Kirana via an OWNER vertical picker; MATERIAL_SUPPLIER / DISTRIBUTION / TRADING / EQUIPMENT / GENERAL (and construction) never see Apply/Add-missing. Do **not** offer the pack to every RETAIL/WHOLESALE shop (hardware, stationery, etc.). |
| K3 | Starter catalog is **copied once** into the company `Resource` table (tenant-owned). OWNER/INVENTORY_MANAGER can edit, deactivate, search, import, and add items after that. |
| K4 | Re-apply / “add missing Kirana items” is **insert-missing-only**. Never overwrite tenant-edited name, rate, GST, HSN, barcode, or reorder fields. |
| K5 | Template seeds **generic pack-size variants** (staples, snacks, biscuits, confectionery, beverages, dairy/daily-use, personal care, cleaning, household). Do **not** seed opening qty, volatile MRP/sale price as truth, or guessed barcodes. Mark GST/HSN as suggested; allow review before/after apply. |
| K6 | Expiry is **batch-level** (manufacture + expiry on received lots). Counter sales allocate by **FEFO**. Keep aggregate `StockBalance` for analytics + Construction compatibility. |
| K7 | **POS checkout** = evolve walk-in multi-item **stock issue → draft invoice → AUTO_STOCK_ISSUE sales record**. Formal **SO → challan → dispatch** stays unchanged. |
| K8 | Desktop/tablet: tables + split cart. Phone: scan/search + card cart + sticky footer. Do not force desktop tables onto phones. |
| K9 | Deepseek-v4-flash = **coding agent only**. Do not hard-code it as the in-app chat model (D10). |
| K10 | Feature flags: `kirana_catalog`, `batch_expiry`, `pos_checkout` as specified per sub-phase. |

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

// on Resource
trackingMode ResourceTrackingMode @default(NONE) @map("tracking_mode")

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

1. **One phase only** (11.1 → 11.2 → 11.3 → 11.4 → 11.5). Do not start the next until checklist + tests for the current phase are green.  
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
| Kirana retail (after seed update) | TBD in seed output / `owner@…` | `Test@1234` | Prefer dedicated Kirana demo emails in seed |
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

---

## 9. Deepseek agent command (copy-paste)

```
Read docs/INVENTORY_KIRANA_RETAIL_WHOLESALE_PLAN.md end-to-end + docs/INVENTORY_HORIZONTAL_PLATFORM.md §1.3 construction isolation + §3 locked principles.

You are implementing BuildFlow Inventory Phase 11 (Kirana retail/wholesale).
Deepseek-v4-flash = coding agent only. Do NOT hard-code it as the product chat model.

CURRENT PASS: implement ONLY the next unchecked phase section in §3 / §8.
Phases 11.0–11.4 are complete; the next pass is Phase 11.5. Do not rewrite completed phases except where 11.5 explicitly extends them.

Locked decisions K1–K10 and Non-goals in §0 are mandatory.

After the phase:
1) Update §8 checkboxes with evidence
2) Run the commands in §6
3) Stop

Do NOT: separate Item table, shared mutable catalog, serial tracking, FIFO rewrite,
Construction Draft→Submit→Approve changes, Inventory price change, rewrite Phases 0–10.
```

---

## 10. File touch map (expected)

| Area | Paths |
|------|--------|
| Schema / seed | `apps/backend/prisma/schema.prisma`, `migrations/*`, `inventory-catalogs/kirana-catalog-data.ts`, `seed.ts` |
| Catalog apply | `apps/backend/src/services/*catalog*`, `settings.service.ts`, `resource.service.ts` |
| Batch / FEFO | `stock-batch.service.ts`, `procurement.service.ts`, `warehouse.service.ts`, `return.service.ts`, `sales-order.service.ts` |
| Shared | `packages/shared/src/inventory-profile.ts`, `plan-modules.ts`, validators |
| UI | `inventory/settings.tsx`, `materials.tsx`, `StockModals.tsx`, `procurement.tsx`, `stock/[resourceId].tsx`, `sales.tsx`, `index.tsx`, `DashboardCards.tsx`, `BarcodeScannerOverlay.tsx` |
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
