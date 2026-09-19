# PM — Owner / Supervisor verdict

**Role intent:** Construction ERP project delivery lead — estimates, planning, procurement approvals, site oversight, invoices/bills **VIEW**, proposals. **Not** company admin. **Not** `bill.approve` (Owner/Accountant). **Not** `settings.users`.

**Sources:** `packages/shared/src/permissions/defaults.ts`, `ROLE_TABS` (`packages/shared` + mobile), live `/auth/me` (Owner + PM), probes in `docs/role-audits/PM-role.md` (2026-09-19).

**Live check:** PM `/auth/me` matches `DEFAULT_ROLE_PERMISSIONS.PM` (58 unique). Owner has full catalog; PM correctly lacks admin / bill approve / profit / estimate & CO final approve permissions.

---

## Owner Decision table

| Capability area | Verdict | Rationale |
|-----------------|---------|-----------|
| **Projects** | **APPROVE** | `project.view/create/edit` + planning edit fit a delivery lead; no `project.delete` (Owner retains). Live list/detail/summary/tasks/gantt/WBS all 200. |
| **Estimates** | **APPROVE** | Create/submit/export is the right PM loop; final `estimate.approve` stays Owner (live 403 “Only OWNER”) — good commercial gate. Convert-to-BOQ is role-allowed after Owner approve. |
| **BOQ** | **APPROVE** | View rates, edit, measurements, import are core site/commercial control for a PM. |
| **Procurement** | **APPROVE** | Indent/PO approve, rates, GRN, stock — appropriate for delivery lead. `override_rates` / `excess_order` are elevated but acceptable vs Store; keep unless company policy wants Owner co-sign. |
| **Accounting** | **APPROVE*** | Invoice/bill **VIEW** matches intent; `bill.create/approve/pay` correctly denied (403). *Caveat: API allows invoice **POST** via `requireRole` despite no `invoice.create` — fix that mismatch (see below). Company finance dashboard correctly 403. |
| **Variations (change orders)** | **APPROVE** | PM can view/create drafts; approve/reject hard-locked to Owner — correct for commercial variations. |
| **Drawings** | **APPROVE** | View/upload/manage supports site oversight. |
| **Snags / punch list** | **APPROVE** | View/create/rectify appropriate; live punch-list list 200. |
| **Petty cash** | **APPROVE** | View/create/approve fits site float control under PM; tighten to Accountant-only approve only if dual-control policy required. |
| **Reports** | **APPROVE** | `reports.view/download` + `report.view` enough for oversight; daily `report.create` can stay with supervisors. |
| **Settings** | **APPROVE** | No users/permissions/billing/audit/export; estimation helpers (`material_prices`, `rate_regions`, `rate_analysis`) are appropriate. GET `/settings/company` is unguarded read — OK; writes still Owner-gated. |
| **Financial amounts / budget / profit** | **APPROVE** | `financials.view_amounts` + `view_budget` yes; `view_profit` no — company P&L/GST/TDS/analytics correctly 403. Project P&L/cashflow/EVA 200 is acceptable for delivery control (not company profit hub). |

\*Accounting = VIEW intent approved; write-path inconsistency is a defect, not a grant.

---

## Side-by-side: Owner vs PM (what Owner has that PM correctly lacks)

| Permission / capability | Owner | PM | Owner call |
|-------------------------|-------|----|------------|
| `settings.users` / permissions / billing / audit | yes | no (403) | Correct |
| `bill.approve` / create / pay | yes | no (403) | Correct |
| `invoice.create` / record payment (catalog) | yes | no in catalog | Correct **intent**; API role-gate still allows invoice POST → **fix** |
| `estimate.approve` / `change_order.approve` | yes | no (403 / Owner-only) | Correct |
| `financials.view_profit` + company finance APIs | yes | no (403) | Correct |
| `project.delete` | yes | no | Correct |
| Subcontract create WO / approve measurement | yes | view only | Optional later grant (see recommendations) |

---

## Nav (`ROLE_TABS.PM`)

`dashboard`, `projects`, `proposals`, `planning`, `reports`, `accounting` — **no** `settings`. Aligns with intent. Accounting tab is invoice/bill-centric (profit sub-tab gated off); do not confuse with Owner company-finance dashboard.

---

## TOO_MUCH / TOO_LITTLE (targeted)

| Item | Verdict | Note |
|------|---------|------|
| Invoice **POST** allowed by role without `invoice.create` | **TOO_MUCH** (enforcement) | UI hides create; API still 201 for PM — close the hole or explicitly grant. |
| `labor.wage_settle` | **TOO_MUCH** (optional trim) | Wage settlement is Accountant/Owner territory; muster edit can stay. |
| `tally.export` | **TOO_MUCH** (optional trim) | Books export fits Accountant; PM already has project financial views. |
| `subcontract.create_wo` | **TOO_LITTLE** (optional) | Delivery leads often issue work orders; today view-only. |
| `estimate.approve` for PM | **Not required** | Owner retains final estimate approval — keep. |

---

## Final recommendation

**Overall: APPROVE** the PM matrix for Construction ERP delivery-lead intent.

Keep as-is: project/estimate/BOQ/planning/procurement approvals, proposals, drawings/snags/petty cash, invoice & bill **view**, budget/amounts without company profit, no settings admin, no bill approve.

**Do before next role-matrix ship:**

1. Align invoice writes: either add `invoice.create` to PM **or** remove PM from invoice POST `requireRole` (prefer remove — Owner intent is VIEW).
2. Optionally strip `labor.wage_settle` and `tally.export` from PM defaults (Accountant owns those).
3. Optionally add `subcontract.create_wo` if PMs run subcontractor packages day-to-day.
4. Clarify Accounting tab copy/UX so it reads as “project AR/AP visibility,” not company finance (already 403 on company dashboard).

No app code changed in this verdict pass.

**Checked:** 2026-09-19 · API `http://localhost:4000/api` · Owner `owner@reddyconst.com` · PM `pm@reddyconst.com`
