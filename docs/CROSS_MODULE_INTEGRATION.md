# Cross-Module Integration Checklist

Use this checklist when adding or changing features that span backend APIs, mobile UI, summary metrics, and tests.

## Per-feature checklist

1. **API endpoint exists** – route + controller + service with validation
2. **Mobile hook exists** – React Query mutation/query in the appropriate `*.queries.ts`
3. **UI entry point exists** – screen, tab, or action button wired to the hook
4. **Summary metric uses the same field as the mutation** – grep the source column when adding dashboard/summary fields
5. **Query invalidation bundle updated** – use shared helpers in `apps/mobile/lib/project-query-invalidation.ts`
6. **Integration test** – happy path + at least two edge cases, or document why N/A
7. **Seed demo reflects the flow** – seed data should exercise the primary user journey
8. **Test cleanup** – isolated project or `afterAll` cleanup when mutating shared seed projects (e.g. Trail)
9. **Plain-language next step** – every workflow screen shows what happens next in beginner-friendly language (see in-app Help center)

## PR review prompts

- If you add a **summary field**, grep for the Prisma column it reads and the mutation that writes it.
- If you add a **mutation**, wire hook + UI + invalidation in the same PR.
- If you add a **bill payment or approval**, call `invalidateBillPaymentImpact(projectId)`.
- Integration test or explain why N/A in the PR description.

## Module integration map

| Flow | Write path | Read path (summary) | Invalidation |
|------|------------|---------------------|--------------|
| Invoice payment | `invoice.service.recordPayment` → `paidAmount` | Project P&L, analytics revenue | Accounting + project summary |
| Bill payment | `bill.service.recordBillPayment` → `paidAmount` | WO `paidTotal`, project `paidSpend` | `invalidateBillPaymentImpact` |
| Subcontract certify | `approveMeasurement` → bill + retention | WO summary `retentionHeld`, `paidTotal` | Subcontract + BOQ |
| WO complete | `updateWorkOrder(COMPLETED)` → retention release bill | WO summary `retentionReleased` | Subcontract + accounting |
| Variation approve | `change-order` → BOQ + linked WO value | WO summary `variationTotal` | `invalidateChangeOrderImpact` |
| Procurement GRN | stock in via GRN | BOQ `procuredQty` | Procurement + BOQ |
| Materials ≠ subcontract | GRN/daily report updates material BOQ | Does **not** auto-certify subcontract WO | Separate paths |

## Spend semantics (project summary)

| Field | Meaning |
|-------|---------|
| `committedSpend` | Sum of `bill.total` for APPROVED/PAID bills (obligations) |
| `paidSpend` | Sum of `bill.paidAmount` for APPROVED/PAID bills (cash out) |
| `budgetUtilizationPct` | Based on `committedSpend` vs project budget |

## Seed demo flows

| Project | Demo |
|---------|------|
| NH-65 | WO-001 earthwork, measurements, VO-002 linked to WO |
| Trail | WO-TRAIL-001 with approved bill `SC-WO-TRAIL-001-MAY` and partial `paidAmount` (₹10,000) |
| Trail | Carpet BOQ procured via GRN – independent of subcontract certification |
