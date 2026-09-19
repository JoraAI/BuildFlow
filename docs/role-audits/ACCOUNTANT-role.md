# ACCOUNTANT role audit — BuildFlow Construction ERP

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Priya Sharma (`accounts@reddyconst.com`)  
**Company:** Reddy Constructions Pvt Ltd (`1f755862-fc64-471b-a08f-74ef1f700ba8`)  
**Sample project:** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`)

---

## Login OK?

**Yes.** OTP `111111` → `role: "ACCOUNTANT"`, **20 permissions**, construction mode. Live list **exactly matches** `DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT`.

---

## Nav tabs (ROLE_TABS)

| Source | Tabs |
|--------|------|
| `apps/mobile/constants/index.ts` | `dashboard`, **`projects`**, `accounting`, `reports` |
| `packages/shared/src/constants/index.ts` | `dashboard`, `accounting`, `reports` — **missing `projects`** |

**Cross-check:** Mobile matches intended ACCOUNTANT surface (projects + accounting + reports). Shared package is **out of sync** (no `projects` tab).

---

## Permissions (live = defaults)

```
project.view
invoice.view / create / record_payment
bill.view / create / approve / record_payment
petty_cash.view / create / approve
labor.view / wage_settle
tally.export
financials.view_amounts / view_profit / view_budget
reports.view / download
settings.tickets
```

**Absent (by design):** `boq.*`, `estimate.*`, `procurement.*`, `settings.users`, `project.edit`.

---

## Endpoint matrix (live)

| Area | Result | Notes |
|------|--------|-------|
| Projects list | **200 empty** | Not on `ProjectMember` in seed; membership-filtered |
| Project detail / summary | **200** | `budget=24522500` visible |
| Invoices list / get / create / update / send / pay | **yes** | Created `INV-ACC-AUDIT-001`, sent, recorded ₹100 |
| Invoice delete (SENT) | **timeout 000** | Hang — not a clean deny |
| Bills create → approve → pay | **yes** | Full AP path works |
| Finance dashboard / P&L / cashflow / est-vs-actual | **200** | `netProfit` present |
| Tally XML + `/export/*-csv` | **200** | `tally.export` + export role gate |
| Petty cash create + reconcile (`RECONCILED`) | **yes** | Approve = status update |
| Wage settle | **perm only** | `labor.wage_settle` gates mobile UI; no dedicated settle API |
| BOQ edit / create / delete | **yes (over)** | `BOQ_MUTATION_ROLES` includes ACCOUNTANT; no `boq.edit` perm |
| Estimates list / create | **yes (over)** | Create ungated; no `estimate.*` perms |
| Estimate approve | **403** | OWNER-only (correct) |
| Procurement approve indent/PO | **403** | No `procurement.approve_*` (correct) |
| Settings users / permissions | **403** | Correct |
| Labour cost-tracking | **403** | “not assigned to this project” |

---

## Verdict vs probe intent

| Expectation | Live |
|-------------|------|
| projects (view) | yes by ID; list empty until membership |
| invoices CRUD-ish | yes (delete SENT hangs) |
| bills create/approve/pay | yes |
| finance dashboard / P&L | yes |
| tally export | yes |
| petty cash approve | yes |
| wage settle | permission + UI only |
| BOQ edit (should not ideally) | **can** — over-permission |
| estimates | view/create open; approve blocked |
| procurement approve | correctly denied |
| settings users | correctly denied |
| amounts / budget / profit | yes |

---

## Surprises (short)

1. **ROLE_TABS drift:** mobile includes `projects`; shared constants omit it.  
2. **BOQ mutations open to ACCOUNTANT** via `requireRole` despite defaults saying no project/BOQ editing.  
3. **Estimate create** has no role/permission gate; ACCOUNTANT can draft.  
4. **Projects list empty** for seed accountant (not a member) — detail by UUID still works.  
5. **Invoice DELETE** on non-draft can hang (HTTP 000) instead of a clean 4xx.
