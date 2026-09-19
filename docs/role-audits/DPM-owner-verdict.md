# DPM — Owner verdict

**Overall: APPROVE** (PM-minus-final-approvals intent met)

**Intent:** Deputy PM = PM without commercial final approvals. May create/submit estimates and change orders; **must not** `estimate.approve` or change-order approve (Owner only). `financials.view_amounts` + `view_budget` OK. No invoice/bill. No `settings.users`.

**Sources:** `packages/shared/src/permissions/defaults.ts` (DPM vs PM), estimate + change-order routes/services, live `/auth/me` for Owner + DPM. `docs/role-audits/DPM-role.md` was **not present** at check time.

**Live:** Owner 79 perms (full catalog). DPM 45 unique — matches `DEFAULT_ROLE_PERMISSIONS.DPM` (no `estimate.approve`, `change_order.approve`, `invoice.*`, `bill.*`, `settings.users`).

---

## Decision table

| Area | Verdict | Evidence |
|------|---------|----------|
| **Estimates (create / submit)** | **APPROVE** | Defaults + live: `estimate.view/create/submit/export`. DPM created estimate **201**. |
| **Estimates (approve / reject)** | **APPROVE** | No `estimate.approve` in catalog. Live approve/reject **403** “Only OWNER role can approve/reject estimates” (service hard-gate). Route `ESTIMATE_MUTATION_ROLES` still lists DPM — enforcement is correct; tighten route later. |
| **Change orders (create / submit)** | **APPROVE** | `change_order.view/create`; routes allow OWNER\|PM\|DPM for create/submit. |
| **Change orders (approve / reject)** | **APPROVE** | No `change_order.approve`. Routes `requireRole(OWNER)` only. Live DPM approve **403** “requires one of: OWNER”. |
| **Financials (amounts + budget)** | **APPROVE** | Live has `financials.view_amounts` + `financials.view_budget`; no `view_profit` (correct vs Owner P&L). |
| **Invoices / bills** | **APPROVE*** | No `invoice.*` / `bill.*` in defaults or `/auth/me`. Bills **403** `bill.view`. Invoice **POST** **403** (role list excludes DPM). *Invoice **GET** list returns **200** (empty) without `invoice.view` — soft leak, same class as other roles; create blocked. |
| **Settings / users** | **APPROVE** | No `settings.users` / permissions / company admin. Live GET `/settings/users` **403**. Has estimation helpers only (`material_prices`, `rate_analysis`). |
| **Procurement (vs PM)** | **APPROVE** | Keeps indent/PO approve + GRN/stock (day-to-day delivery). Correctly drops PM-only `create_direct_po`, `override_rates`, `excess_order`. Owner intent scoped final approvals to estimates/COs, not procurement. |
| **Other PM trims** | **APPROVE** | No `proposal.create`, `portal.manage`, `petty_cash.approve`, `drawing.manage`, `boq.import`, `labor.wage_settle`, `tally.export`, `invoice.view`, `bill.view` — appropriate deputy cut. |

---

## Side-by-side (Owner cares about)

| Check | Owner | DPM | Call |
|-------|-------|-----|------|
| `estimate.approve` | yes | no (403 live) | Correct |
| `change_order.approve` | yes | no (403 live) | Correct |
| Create/submit estimate & CO | yes | yes | Correct |
| `financials.view_amounts` / `view_budget` | yes | yes | Correct |
| `invoice.*` / `bill.*` grants | yes | no | Correct |
| `settings.users` | yes | no (403) | Correct |

---

## Notes (not blocking APPROVE)

1. **Route hygiene:** `estimate.routes` `ESTIMATE_MUTATION_ROLES` includes DPM for approve/reject/convert; service already Owner-only for approve/reject. Prefer aligning the route guard with `estimate.approve` / Owner.
2. **Invoice list:** project invoice GET is auth-only (no `invoice.view`) — DPM got **200** `[]`. Prefer `requirePermission('invoice.view')` so “no invoice” is hard.
3. **DPM-role.md** missing — re-run role probe agent if a deeper endpoint matrix is needed.

No app code changed in this verdict pass.

**Checked:** 2026-09-19 · API `http://localhost:4000/api` · Owner `owner@reddyconst.com` · DPM `dpm@reddyconst.com`
