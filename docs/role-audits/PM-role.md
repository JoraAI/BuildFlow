# PM role audit — BuildFlow Construction ERP

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Ravi Kumar (`pm@reddyconst.com`)  
**Company:** Reddy Constructions Pvt Ltd (`1f755862-fc64-471b-a08f-74ef1f700ba8`)  
**Sample project:** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`)

---

## Login OK?

**Yes.** `POST /api/auth/login` with OTP `111111` succeeded.  
`GET /api/auth/me` returned `role: "PM"`, 63 permission entries (58 unique), construction product mode.

---

## Nav tabs expected

From `ROLE_TABS.PM` in `apps/mobile/constants/index.ts`:

| Tab | Expected |
|-----|----------|
| dashboard | yes |
| projects | yes |
| proposals | yes |
| planning | yes |
| reports | yes |
| accounting | yes |
| settings | **no** (OWNER only among construction roles) |

Cross-check vs live API: proposals list 200; project financials 200; company finance dashboard **403** (accounting hub still useful for invoices/bills view). Settings users/permissions **403** as expected (tab not shown).

---

## Permissions (live)

Live `/auth/me` permissions **exactly match** `DEFAULT_ROLE_PERMISSIONS.PM` in `packages/shared/src/permissions/defaults.ts` (58 unique; no extras, no missing).

```
attendance.checkin
attendance.view
bill.view
boq.edit
boq.import
boq.record_measurement
boq.view
boq.view_rates
change_order.create
change_order.view
drawing.manage
drawing.upload
drawing.view
estimate.create
estimate.export
estimate.submit
estimate.view
financials.view_amounts
financials.view_budget
invoice.view
labor.muster_edit
labor.view
labor.wage_settle
petty_cash.approve
petty_cash.create
petty_cash.view
planning.edit
planning.view
portal.manage
procurement.approve_indent
procurement.approve_po
procurement.create_direct_po
procurement.create_indent
procurement.excess_order
procurement.indent_from_boq
procurement.override_rates
procurement.record_grn
procurement.view
procurement.view_rates
project.create
project.edit
project.view
proposal.create
proposal.view
report.view
reports.download
reports.view
settings.material_prices
settings.rate_analysis
settings.rate_regions
snag.create
snag.rectify
snag.view
stock.adjust
stock.manage
stock.view
subcontract.view
tally.export
```

**Notably absent (by design):** `bill.create`, `bill.approve`, `bill.record_payment`, `invoice.create`, `estimate.approve`, `change_order.approve`, `financials.view_profit`, `settings.users`, `settings.permissions`, `settings.company`.

---

## Endpoint matrix

| Path | Method | Status | Can? | Note |
|------|--------|--------|------|------|
| `/auth/login` | POST | 200 | yes | OTP login |
| `/auth/me` | GET | 200 | yes | role PM + perms |
| `/projects` | GET | 200 | yes | 1 project |
| `/projects/:id` | GET | 200 | yes | detail |
| `/projects/:id/summary` | GET | 200 | yes | progress/budget summary |
| `/projects/:id/tasks` | GET | 200 | yes | 3 tasks |
| `/projects/:id/gantt` | GET | 200 | yes | planning |
| `/projects/:id/wbs` | GET | 200 | yes | 2 WBS nodes |
| `/projects/:id/estimates` | GET | 200 | yes | list |
| `/projects/:id/estimates` | POST | 201 | yes | draft created (`PM Audit Draft Estimate`) |
| `/estimates/:id/approve` | POST | 403 | **no** | OWNER-only |
| `/projects/:id/boq` | GET | 200 | yes | 3 items |
| `/boq/:id/measurements` | POST | 201 | yes | recorded qty 0.001 |
| `/projects/:id/procurement/requisitions` | GET | 200 | yes | indents |
| `/projects/:id/procurement/requisitions` | POST | 201 | yes | draft indent created |
| `/projects/:id/procurement/next-numbers` | GET | 200 | yes | po/grn suggestions |
| `/projects/:id/procurement/stock/summary` | GET | 200 | yes | stock |
| `/projects/:id/procurement/grn` | POST | 404 | **yes*** | *permission passed; fake PO → not found (not 403) |
| `/projects/:id/procurement/purchase-orders` | GET | 404 | n/a | no list route mounted |
| `/projects/:id/procurement/grn` | GET | 404 | n/a | no list route mounted |
| `/projects/:id/invoices` | GET | 200 | yes | 2 invoices |
| `/projects/:id/invoices` | POST | 201 | yes† | draft invoice created; role-gated, not `invoice.create` |
| `/projects/:id/bills` | GET | 200 | yes | 1 bill |
| `/projects/:id/bills/summary` | GET | 200 | yes | spend summary |
| `/bills` | GET | 200 | yes | company-scoped list |
| `/projects/:id/bills` | POST | 403 | **no** | missing `bill.create` |
| `/bills/:id/approve` | POST | 403 | **no** | missing `bill.approve` (expected) |
| `/drawings?projectId=` | GET | 200 | yes | empty list |
| `/punch-list?projectId=` | GET | 200 | yes | snags (1 item) |
| `/petty-cash?projectId=` | GET | 200 | yes | empty |
| `/petty-cash/summary?projectId=` | GET | 200 | yes | summary |
| `/projects/:id/change-orders` | GET | 200 | yes | list |
| `/projects/:id/change-orders` | POST | 201 | yes | draft CO created |
| `/company/financials/dashboard` | GET | 403 | **no** | OWNER / ACCOUNTANT / INVENTORY_MANAGER |
| `/company/financials/gst-report` | GET | 403 | **no** | same |
| `/company/financials/tds-report` | GET | 403 | **no** | same |
| `/projects/:id/financials/pl` | GET | 200 | yes | project P&L |
| `/projects/:id/financials/cashflow` | GET | 200 | yes | cashflow |
| `/projects/:id/financials/estimate-vs-actual` | GET | 200 | yes | EVA |
| `/projects/:id/financials/export-tally` | GET | 200 | yes | Tally XML |
| `/analytics/dashboard` | GET | 403 | **no** | OWNER-only |
| `/proposals` | GET | 200 | yes | empty page |
| `/settings/users` | GET | 403 | **no** | missing `settings.users` |
| `/settings/permissions` | GET | 403 | **no** | missing `settings.permissions` |
| `/settings/company` | GET | 200 | yes‡ | read open to any auth user |
| `/settings/me` | GET | 200 | yes | own profile |
| `/settings/rate-regions` | GET | 200 | yes | matches `settings.rate_regions` |

† = allowed by `requireRole(OWNER, PM, ACCOUNTANT, …)` despite no `invoice.create` permission tag.  
‡ = GET has no permission guard; PUT `/settings/company` requires `settings.company` (PM lacks it).

---

## Surprises

1. **Accounting tab vs company finance API**  
   `ROLE_TABS` includes `accounting` for PM. Company dashboard / GST / TDS are 403. Mobile gates the Dashboard sub-tab on `financials.view_profit` (PM lacks it), so UI mostly shows invoices/bills — which *do* work. Still a product mismatch: “Accounting” implies company finance, but API reserves that for OWNER/ACCOUNTANT.

2. **Invoice create: API yes, permission tag / UI no**  
   PM has only `invoice.view`, not `invoice.create`. Accounting UI hides “New Invoice” via `usePermission('invoice.create')`. API `POST …/invoices` still allows PM via `requireRole` — permission catalog and route guards disagree.

3. **Bill approve correctly denied**  
   `POST /bills/:id/approve` → 403 `bill.approve` — matches defaults and expectation.

4. **Bill create correctly denied; view allowed**  
   View company + project bills OK; create blocked. Good separation.

5. **GRN: permission OK, no list endpoints**  
   POST GRN is not 403 (got 404 on missing PO). GET PO/GRN lists return 404 (routes not implemented as GETs) — UI may list via nested/other payloads only.

6. **`settings.company` GET without permission**  
   Live perms omit `settings.company`, but GET company profile succeeds (unguarded read). Admin write paths still protected.

7. **Owner analytics vs PM dashboard tab**  
   Nav shows `dashboard`, but `/analytics/dashboard` is OWNER-only 403. PM “dashboard” must be a different screen (project-centric), not this OWNER analytics API.

8. **Defaults ↔ live: aligned**  
   No drift between `DEFAULT_ROLE_PERMISSIONS.PM` and `/auth/me` for this seed user.

9. **Estimate approve blocked**  
   Consistent with missing `estimate.approve` / OWNER-only workflow.

---

## Self-assessment: what PM needs for daily work

**Well covered today**

- Project detail, planning (tasks/gantt/WBS), estimates (create/submit path), BOQ + measurements  
- Procurement indents (create/approve path perms), stock view, GRN permission  
- Change orders (create draft), drawings/snags/petty-cash access  
- Project-scoped financials (P&L, cashflow, EVA, Tally export)  
- Invoice/bill **visibility** for site commercial awareness  

**Gaps / friction for a typical PM day**

- Cannot approve bills or create vendor bills — must rely on ACCOUNTANT/OWNER (appropriate if intentional; otherwise blocks closeout).  
- Cannot use company finance dashboard / GST-TDS while having an Accounting nav tab — confusing for “how are we doing company-wide?”  
- Invoice create works on API but not via permission-gated UI — if PMs should raise RA invoices, add `invoice.create` (or stop allowing role-based POST).  
- No dedicated GET list for POs/GRNs — harder to track goods-in without other nested data.  
- Final estimate / change-order **approval** is OWNER-only — fine for governance; PM needs a clear “submitted / waiting owner” UX.

**Verdict:** PM is a strong **project execution + commercial drafting** role (estimate/BOQ/procurement/CO/site docs), correctly excluded from company admin and bill approval. Main product risks are the **Accounting tab vs company dashboard 403**, and the **invoice.create permission vs role-gate mismatch**.
