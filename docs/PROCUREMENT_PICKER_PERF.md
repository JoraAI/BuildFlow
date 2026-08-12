# BuildFlow - Procurement picker UX + mutation performance

> **Audience:** Deepseek-V4-Flash  
> **Scope:** Inventory shell **and** construction `ProcurementTab`  
> **Repo paths:** `apps/mobile/app/inventory/procurement.tsx`, `apps/mobile/components/projects/ProcurementTab.tsx`, `apps/mobile/services/expansion.queries.ts`, `apps/mobile/lib/project-query-invalidation.ts`, `apps/backend/src/services/procurement.service.ts`  
> **Do not** re-break inventory product shell routing (`app/inventory/` is a real path segment - not `(inventory)`).

---

## Problem statements (verified)

### A. Duplicate pickers (UX bug)

**New PO - inventory** ([`CreatePOModal`](../apps/mobile/app/inventory/procurement.tsx)):

```ts
const approved = requisitions.filter((r) => r.status === 'APPROVED');
```

This keeps showing an indent after a PO already exists for it.

**New GRN - inventory** (`RecordGrnModal`):

```ts
const pos = allPurchaseOrders(requisitions).filter((po) => po.status !== 'CANCELLED');
```

This keeps showing a PO after it is already (fully) received.

**Construction** ([`ProcurementTab.tsx`](../apps/mobile/components/projects/ProcurementTab.tsx)):

- Create PO button already gated with `req.status === 'APPROVED' && !hasPOs` - good for **actions** on list rows.
- GRN button is hidden when `goodsReceipts.length > 0` (any GRN) - **too strict** vs product rule; should allow **partial** receipts until fully received.
- Ensure any shared / modal pickers for PO↔indent and GRN↔PO match the rules below in **both** UIs.

### B. Slow submit / approve / PO / GRN (performance)

Symptoms: UI feels stuck when submitting or approving an indent, creating PO, or recording GRN.

Likely causes to investigate and fix:

1. **Over-invalidation** - `useCreatePurchaseOrder` / `useCreateGRN` call `invalidateProjectProcurement`, which refetches stock, stock summary, stock movements, BOQ shortfalls, and BOQ on every PO create (even when inventory users don't need BOQ).
2. **Heavy `listRequisitions` payload** - nested `purchaseOrders → lines → resource`, `goodsReceipts`, bills; refetched on every mutation.
3. **Missing / weak loading feedback** - buttons should use `isPending` and prevent double-submit.
4. **No optimistic / cache update** - await full list refetch before UI settles.
5. Backend: confirm `submitRequisition` / `approveRequisition` stay cheap (no gratuitous includes or N+1). Optional: return updated list row shaped for cache patch.

---

## Locked product rules

| Picker | Show | Hide |
|--------|------|------|
| **New PO → indent** | `status === 'APPROVED'` **and** `purchaseOrders.length === 0` | Already has any PO |
| **New GRN → PO** | `status !== 'CANCELLED'` **and** **not fully received** | Fully received (all PO line qtys covered by sum of GRN lines per resource, ±0.001) |

**Fully received** helper (shared logic preferred):

```ts
function isPoFullyReceived(po: {
  lines: Array<{ resourceId: string; quantity: number | string }>;
  goodsReceipts?: Array<{ lines: Array<{ resourceId: string; quantity: number | string }> }>;
}): boolean {
  if (!po.lines?.length) return false;
  const received = new Map<string, number>();
  for (const g of po.goodsReceipts ?? []) {
    for (const l of g.lines ?? []) {
      received.set(l.resourceId, (received.get(l.resourceId) ?? 0) + Number(l.quantity));
    }
  }
  return po.lines.every((l) => (received.get(l.resourceId) ?? 0) >= Number(l.quantity) - 0.001);
}
```

Backend already has similar logic in GRN create (`procurement.service.ts` ~receivedByResource). Prefer a shared util under `packages/shared` or a small `apps/mobile/utils/procurement.ts` used by both UIs; optionally also export open-PO helpers from the service for API consumers.

**Empty states:** If no eligible indents for PO / no open POs for GRN, show clear copy (“All approved indents already have POs” / “No POs awaiting receipt”).

---

## Implementation plan

### 1. Shared eligibility helpers

Add `packages/shared/src/utils/procurement-eligibility.ts` (or mobile util if you want zero shared change):

- `indentAvailableForNewPo(req)` → APPROVED && no POs  
- `poAvailableForNewGrn(po)` → !CANCELLED && !isPoFullyReceived(po)  
- Export from shared barrel if placed in shared.

### 2. Inventory UI (`app/inventory/procurement.tsx`)

- `CreatePOModal`: filter with `indentAvailableForNewPo`.  
- `RecordGrnModal`: filter POs with `poAvailableForNewGrn`.  
  - Prefill receive qtys as **remaining** = PO line qty − already received (not full indent qty again).  
- Wire button `loading={mutation.isPending}` for submit / approve / create PO / record GRN; disable while pending.

### 3. Construction UI (`ProcurementTab.tsx`)

- Keep Create PO only when APPROVED && !hasPOs (already).  
- Change **Record GRN** visibility from “no GRNs yet” to `poAvailableForNewGrn(po)`.  
- Preload GRN modal lines with **remaining** quantities when opening Record GRN.  
- Same pending/disable patterns on mutations.

### 4. Backend guards (harder to dual-submit)

In `createPO` when `requisitionId` is set:

- If requisition already has ≥1 PO, reject with **400**  
  `"This indent already has a purchase order. Create a new indent for additional orders."`  
  (Matches “zero POs” rule - do **not** allow a second PO on the same indent in this round.)

In `createGRN`:

- Keep existing under/over-receive checks.  
- If PO is already fully received, reject with **400**  
  `"This PO is fully received."`

Add integration tests for both rejections + happy path still allowing second **partial** GRN when not full.

### 5. Performance fixes (both products)

**Client invalidation** - replace blunt bundles:

| Mutation | Invalidate |
|----------|------------|
| Submit / approve indent | requisitions only (already OK) - optionally `setQueryData` with returned row |
| Create PO | requisitions (+ stock **not** needed) |
| Create GRN | requisitions + stock summary (+ stock locations if shown) - **not** BOQ / shortfalls for inventory |

Refine `invalidateProjectProcurement` into scoped helpers, e.g.:

- `invalidateProcurementLists(qc, projectId)`  
- `invalidateProcurementStock(qc, projectId)`  
- keep full bundle only where BOQ coupling is real (e.g. generate-from-boq)

**Optimistic UX:**

- On submit/approve success, patch the requisition in the React Query cache immediately from the mutation response so the badge updates without waiting on a slow refetch.  
- Close modals immediately on success; refetch in background.

**Backend (optional but preferred if list is large):**

- Slim `listRequisitions` selects: drop unnecessary nested fields for list views; only include what pickers need (`id`, `reqNumber`, `status`, PO ids/status/line qtys, GRN line qtys).  
- Ensure submit/approve do not load the full tree.

**UI:** always pass `loading` / `disabled` from `isPending` so users don’t double-click.

### 6. Tests

1. Inventory/construction (unit or component-level helpers): indent with PO → not eligible for New PO.  
2. PO with partial GRN → still eligible for New GRN; remaining qty correct.  
3. Fully received PO → not eligible; `createGRN` API returns 400.  
4. Second `createPO` on same indent → 400.  
5. Existing `procurement.test.ts` / `inventory-product.test.ts` still pass; extend inventory happy path if needed.

### 7. Docs

- Note eligibility rules in `docs/CROSS_MODULE_INTEGRATION.md` (procurement row).  
- Short note under inventory procurement in `TECHNICAL_OVERVIEW` if present.

---

## Anti-patterns

- Do not hide POs from GRN after the **first** partial GRN.  
- Do not allow multiple POs per indent in this round (product rule locked).  
- Do not invalidate entire project BOQ on every inventory PO create.  
- Do not introduce a second inventory route group `(inventory)` - keep `app/inventory/`.  
- Do not change GST/Tally/seed credentials in this round.

---

## Definition of done

- [x] New PO pickers (inventory + construction) only list APPROVED indents with **zero** POs  
- [x] New GRN pickers allow partial receive; hide only when **fully** received  
- [x] Remaining qty used when recording GRN  
- [x] Backend rejects duplicate PO / fully-received GRN  
- [x] Submit/approve/PO/GRN feel snappy: scoped invalidation + pending UI + cache patch  
- [x] Tests green for both products  

---

## Suggested first commit message

`fix(procurement): hide ordered indents and fully-received POs; speed up mutations`
