# STORE_INCHARGE role audit

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Anil Gupta (`store@reddyconst.com`) · OTP `111111`  
**Sample project:** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`) — seeded as project member with role `STORE_INCHARGE`

---

## Login / permissions

Login OK. `role: STORE_INCHARGE`. Live permissions **exactly match** `DEFAULT_ROLE_PERMISSIONS.STORE_INCHARGE` (13):

`project.view`, `boq.view`, `procurement.view`, `procurement.create_indent`, `procurement.record_grn`, `stock.view`, `stock.manage`, `petty_cash.view`, `petty_cash.create`, `drawing.view`, `report.view`, `attendance.view`, `reports.view`

**Not tagged (by design):** `boq.view_rates`, `financials.view_amounts`, `financials.view_budget`, `invoice.*`, `bill.*`, `settings.*`, approvals (`procurement.approve_*`).

**ROLE_TABS** (shared + mobile): `dashboard`, `projects`, `reports` only — no accounting/settings/procurement shell tabs.  
**Dashboard widgets** (`ROLE_DASHBOARD_CONFIG`): `stock`, `procurement`, `grn`, `materialIssues`.  
**Playbook** tasks: create indents, record GRNs / manage stock, log petty cash.

---

## Probe matrix

| Area | Expected | Result | HTTP | Note |
|------|----------|--------|------|------|
| Projects list / detail | view | Allowed | 200 | Detail includes **`budget`** (`24522500`) |
| Procurement indents list | view | Allowed | 200 | 3 requisitions; lines show `expectedRate` |
| Create indent | create_indent | **Denied** | 403 | Permission OK; **project-role** allow-list `OWNER, PM, SUPERVISOR` excludes `STORE_INCHARGE` |
| Submit / delete indent | create_indent | **Denied** | 403 | Same project-role gate |
| Generate indents from BOQ | create_indent | **Denied** | 403 | Same |
| Record GRN (real PO) | record_grn | **Denied** | 403 | Same project-role gate (`createGRN`) |
| Approve indent / create PO | no | Denied | 403 | `procurement.approve_*` — correct |
| Stock summary / list / movements | view | Allowed | 200 | Summary exposes **`catalogRate`**, `gstRate`, `inventoryValue` |
| Stock issue | manage | Allowed | 201 | `issueStockManual` — membership only (no role allow-list) |
| Petty cash list / summary | view | Allowed | 200 | Auth-only GET |
| Petty cash create | create | Allowed | 201 | Route `MUTATION_ROLES` includes `STORE_INCHARGE` (matrix UNDER claim is **stale**) |
| Drawings view | view | Allowed | 200 | |
| Drawings create | no | Denied | 403 | Correct |
| BOQ list | view (no rates) | Allowed | 200 | Items include **`rate` / `amount`**; `total` = 1627500 |
| BOQ create / measure | no | Denied | 403 | Correct |
| BOQ vs-actual | — | Allowed | 200 | **`boqAmount`**, `actualSpend`, category spend |
| Invoices list | no invoice.view | Allowed | 200 | **Full money** (subtotal/GST/total/paid) — ungated GET |
| Invoice create | no | Denied | 403 | Correct |
| Bills | no | Denied | 403 | `bill.view` — correct |
| Financials P&L / cashflow / vs-actual | no | Denied | 403 | Role-gated |
| Tally / export | no | Denied | 403 / 404 | |
| PDF progress / P&L / material-rates | no `reports.download` | Allowed | 200 | Auth-only PDFs leak money |
| PDF GST | no | Denied | 403 | Correct |
| Estimates / change orders list | no | Allowed | 200 | Estimate `summary.grandTotal`; CO `costImpact` |
| Settings users / permissions / audit / integrations | no | Denied | 403 | Correct |
| Settings company / me | profile | Allowed | 200 | OK |
| Daily reports list | report.view | Allowed | 200 | |
| Attendance | attendance.view | Allowed | 200 | |

---

## Defaults vs live vs ROLE_TABS

| Source | Alignment |
|--------|-----------|
| `DEFAULT_ROLE_PERMISSIONS.STORE_INCHARGE` | Matches `/auth/me` exactly |
| `ROLE_TABS` | Narrow shell (dashboard/projects/reports) — hides procurement UI paths; API still grants stock/procurement when routed |
| Playbook / dashboard config | Advertise indent + GRN as core jobs — **live mutations fail** for those |
| `docs/ROLE_PERMISSION_API_MATRIX` | `petty_cash.create` marked UNDER — **fixed** in routes; indent/GRN still broken via service layer |

---

## Findings (short)

1. **Core broken:** Company perms grant `procurement.create_indent` + `procurement.record_grn`, but `procurement.service` `assertProjectAccess(..., ['OWNER','PM','SUPERVISOR'])` blocks seeded `STORE_INCHARGE` project members. Indents/GRN cannot be created; playbook tasks fail.
2. **Stock manage OK:** Manual stock issue works (201); view surfaces include catalog rates.
3. **Petty cash OK:** Create works (201); matrix doc out of date.
4. **Money leak:** No `financials.view_*` / `boq.view_rates`, yet project **budget**, BOQ **rates/amounts**, invoice totals, stock **catalogRate**, estimate/CO amounts, and PDF P&L / material-rates are readable.
5. **Accounting:** Bills/writes/export blocked; invoice **GET** still open (auth-only).
6. **UI vs API:** Tabs omit procurement/stock; dashboard widgets and permissions still expect store ops — indent/GRN gap is service allow-list, not tab config.
