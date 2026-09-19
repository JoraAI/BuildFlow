# MECHANICAL_MANAGER role audit

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Suresh Reddy (`mechanical@reddyconst.com`) · OTP `111111`  
**Sample project:** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`) — assigned during probe (seed had no membership)

---

## Login / permissions

Login OK. `role: MECHANICAL_MANAGER`. Live permissions **match** `DEFAULT_ROLE_PERMISSIONS.MECHANICAL_MANAGER`:

`project.view`, `planning.view`, `boq.view`, `report.view`, `report.create`, `drawing.view`, `snag.view`, `snag.create`, `attendance.*`, `procurement.view`, `stock.view`, `subcontract.view`, `reports.view`, `reports.download`

**ROLE_TABS:** `dashboard`, `projects`, `reports` only (no accounting/settings).

---

## Probe matrix

| Area | Result | HTTP | Note |
|------|--------|------|------|
| Projects list | Empty until assigned | 200 | Membership filters list |
| Project detail (by id) | Allowed even unassigned | 200 | Exposes **`budget`** |
| Reports create | Allowed | 201 | Core job |
| Drawings view | Allowed | 200 | |
| Drawings create | Denied | 403 | No upload (tagged `drawing.view` only) |
| Snags create | Allowed | 201 | Matches defaults; matrix doc stale |
| BOQ view | Allowed | 200 | Items include **`rate` / `amount` / `total`** |
| BOQ edit / measure | Denied | 403 | Correct |
| Procurement view (assigned) | Allowed | 200 | Indents list OK |
| Procurement create | Denied | 403 | No `create_indent` |
| Stock view (assigned) | Allowed | 200 | Summary exposes **`catalogRate`**, `gstRate` |
| Stock issue | Denied | 403 | No `stock.manage` |
| Invoices list | Allowed | 200 | **Full money** (subtotal/GST/total/paid) — ungated GET |
| Bills | Denied | 403 | `bill.view` missing |
| Financials P&L / cashflow | Denied | 403 | Role-gated |
| Accounting export CSV | Denied | 403 | |
| Estimates list | Allowed | 200 | Shows `grandTotal` — no `estimate.view` tag |
| Settings admin | Denied | 403 | users/audit/billing/permissions |
| Settings me/company | Allowed | 200 | Profile OK |

---

## Findings (short)

1. **Core OK:** Report create, drawing view, snag create work; BOQ/procurement/stock mutations blocked.
2. **Money leak:** No `financials.view_amounts` / `boq.view_rates`, but project **budget**, BOQ **rates/amounts**, invoice totals, and stock **catalogRate** are readable.
3. **Accounting:** Write/export blocked; invoice **read** still open (auth-only).
4. **Seed gap:** Mechanical starts with **zero** project memberships → empty project list until Owner assigns.
5. **UI vs API:** Tabs hide procurement/stock/snags, but API permissions still grant those views when assigned.
