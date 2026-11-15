# Data wiring + security fixes (Construction ERP + IM)

Backlog from the Nov 2026 auditor/IM/Construction audit. Fix **one item at a time**, verify, then move on. Do not batch unrelated changes.

**Status key:** `todo` | `in_progress` | `done` | `wontfix`

---

## Principles

1. Prefer service-layer `assertCanViewProject` (same as procurement/PDF) over ad-hoc route middleware.
2. Align status filters with Tally / project summary: exclude `DRAFT` (and bill `REJECTED`) from financial totals and filing-style exports.
3. Keep auditor pack path and IM analytics consistent once P&L is aligned.
4. After each fix: backend `tsc`, targeted smoke, no new cross-tenant or draft leaks.

---

## Wave A — Security + shared integrity

| ID | Status | Scope | Fix |
|----|--------|-------|-----|
| A1 | done | Shared | Project access on invoice/bill list/get/create/update/pay/delete (and bill approve/reject) + invoice/bill PDF. Align `getAccessibleProjectIds` with ACCOUNTANT company-wide view. |
| A2 | done | Shared | Exclude DRAFT from company dashboard invoiced/billed totals; purchase register CSV → `APPROVED`/`PAID` only; export ZIP invoices/bills exclude DRAFT (bills also REJECTED). |
| A3 | done | Hygiene | `.venv-pptx/` added to `.gitignore`. |

---

## Wave B — IM books / filing

| ID | Status | Scope | Fix |
|----|--------|-------|-----|
| B1 | done | IM | Align `getProfitLossReport` with auditor books: taxable sales, CN net, period-scoped sales OUT COGS. |
| B2 | done | Shared | GSTR-1 `buildHsnMaps`: include credit-note line HSN adjustments (subtract). |
| B3 | done | IM | Persist HSN on CN/DN lines (schema + create paths); auditor pack prefers line `hsnSacCode`. |
| B4 | done | IM | Dashboard today sales/purchases + margin billed revenue: exclude DRAFT. |
| B5 | done | IM | Daily cash summary: expenses = EXPENSE only; collected = that day’s SALE_COLLECTION. |
| B6 | done | IM | Return/CN lifecycle (auto-ISSUED notes when return ISSUED) + COGS reversal for SALES_RETURN stock IN. |

---

## Wave C — Construction ERP

| ID | Status | Scope | Fix |
|----|--------|-------|-----|
| C1 | done | Construction | RA/create-invoice: pass `resourceId` / `hsnSacCode` from BOQ; BOQ list surfaces catalog HSN/GST. |
| C2 | done | Shared engine | Header GST rolled from per-line rates (mixed SAC); create-invoice preview matches. |
| C3 | done | Construction | Freeze SENT/OVERDUE RA: block edits that change certified/GST/lines/client/dates. |
| C4 | done | Shared | GRN→draft bill: GST from line rates, not flat 18%. |
| C5 | done | Construction | Subcontract bills: GST when company GSTIN; WO billed/retention exclude DRAFT/REJECTED. |
| C6 | done | Construction | Material demand: don’t count DRAFT indents as covering; explode RA when `rateAnalysisId` set. |
| C7 | done | Construction | Create-invoice preview: use company state (not hard-coded Telangana). |
| C8 | done | Construction | RA detail UI parity with PDF (retention / prev / cum + RA line table). |

---

## Already done (auditor pack — reference)

- Purchase DN excluded from GSTR-1 exports; pack UI labels DN as books-only.
- Groups: no double-count of SALE_COLLECTION / VENDOR_PAYMENT.
- Pack slices exclude DRAFT invoices; bills exclude DRAFT/REJECTED.
- Pack P&L taxable + CN net; BS practical as-of; freeze on send.
- Invoice create copies catalog HSN when `resourceId` set; GRN snapshot can carry HSN.

---

## Progress log

| Date | ID | Notes |
|------|----|-------|
| 2026-11-15 | — | Doc created; starting A1. |
| 2026-11-15 | A1 | Service-layer `assertCanViewProject` on invoice/bill APIs + PDFs; ACCOUNTANT in `getAccessibleProjectIds`. |
| 2026-11-15 | A2 | Dashboard, purchase register, export ZIP draft filters. |
| 2026-11-15 | A3 | `.venv-pptx/` gitignored. |
| 2026-11-15 | B1 | `getProfitLossReport` delegates to `buildPackPeriodPnL` (single source of truth). |
| 2026-11-15 | B2 | GSTR-1 HSN maps subtract issued credit-note lines. |
| 2026-11-15 | B3 | `CreditNoteLine`/`DebitNoteLine.hsnSacCode` + migration; return create persists HSN; pack prefers line HSN. |
| 2026-11-15 | B4 | Analytics today sales/purchases + margin exclude DRAFT. |
| 2026-11-15 | B5 | Daily cash: SALE_COLLECTION collected; EXPENSE-only expenses. |
| 2026-11-15 | B6 | Auto-ISSUED CN/DN with return; P&L/margin COGS net of SALES_RETURN. |
| 2026-11-15 | C1–C8 | Construction HSN/GST/RA freeze/GRN GST/subcontract/demand/preview/RA UI. |
