# WEIGHBRIDGE_INCHARGE role audit

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Karthik Rao (`weighbridge@reddyconst.com`) · OTP `111111`  
**Sample project:** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`) — assigned during probe (seed had no membership)

---

## Login / permissions

Login OK. `role: WEIGHBRIDGE_INCHARGE`. Live permissions **match** `DEFAULT_ROLE_PERMISSIONS.WEIGHBRIDGE_INCHARGE`:

`project.view`, `boq.view`, `procurement.view`, `procurement.record_grn`, `stock.view`, `drawing.view`, `report.view`, `report.create`, `attendance.checkin`, `attendance.view`, `reports.view`

**ROLE_TABS:** `dashboard`, `projects`, `reports` only (no accounting/settings).

---

## Probe matrix

| Area | Result | HTTP | Note |
|------|--------|------|------|
| Projects list | Empty until assigned | 200 | Membership filters list |
| Project detail (by id) | Allowed even unassigned | 200 | Exposes **`budget`** |
| Procurement view (assigned) | Allowed | 200 | Requisitions / next-numbers OK |
| **GRN create** | **Denied** | **403** | Has `procurement.record_grn`, but service requires project role **OWNER / PM / SUPERVISOR** |
| Indent create | Denied | 403 | No `create_indent` |
| Stock view / summary (assigned) | Allowed | 200 | Exposes **`catalogRate`**, `gstRate`, balances |
| Stock issue | Denied | 403 | No `stock.manage` |
| Report create | Allowed | 201 | Core adjacent job |
| Attendance check-in / list | Allowed | 201 / 200 | |
| BOQ view | Allowed | 200 | Items include **`rate` / `amount`** |
| BOQ edit / measure | Denied | 403 | Correct |
| BOQ vs-actual | Allowed | 200 | Exposes `boqAmount`, `actualSpend` |
| Drawings view | Allowed | 200 | |
| Drawings create | Denied | 403 | `drawing.view` only |
| Invoices list/detail | Allowed | 200 | **Full money** (subtotal/GST/total/paid) — ungated GET |
| Invoice create | Denied | 403 | Correct |
| Bills | Denied | 403 | `bill.view` missing |
| Estimates list | Allowed | 200 | `grandTotal` visible — no `estimate.view` |
| Financials P&L / cashflow | Denied | 403 | Role-gated |
| PDF P&L / progress | Allowed | 200 | P&L PDF bypasses `/financials/*` gate |
| Petty cash list/summary | Allowed | 200 | No `petty_cash.view` — read open |
| Settings admin | Denied | 403 | users/audit/billing/export/integrations |
| Settings me/company | Allowed | 200 | Profile OK |

---

## Findings (short)

1. **Broken core job:** Defaults grant `procurement.record_grn`, route uses that permission, but `createGRN` in `procurement.service.ts` hard-gates to `OWNER | PM | SUPERVISOR` → weighbridge **cannot record GRN**.
2. **Seed gap:** Starts with **zero** project memberships → empty project list; procurement/stock also membership-gated until Owner assigns.
3. **Money leak:** No `financials.view_amounts` / `boq.view_rates`, yet project **budget**, BOQ **rates/amounts**, stock **catalogRate**, invoice totals, vs-actual spend, and **P&L PDF** are readable.
4. **Accounting:** Writes/bills blocked; invoice/estimate **reads** and petty-cash summary still open (auth-only).
5. **UI vs API:** Tabs hide procurement/stock, but API still grants those views (and intends GRN) when assigned.
