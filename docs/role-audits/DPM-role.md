# DPM role audit — BuildFlow Construction ERP

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Arjun Naidu (`dpm@reddyconst.com`) / OTP `111111`  
**Company:** Reddy Constructions Pvt Ltd (`1f755862-fc64-471b-a08f-74ef1f700ba8`)  
**Probe project (created by DPM):** DPM Probe Project (`b923a641-fc1f-4bdf-8f6c-84b316c28ee6`)  
**Seed project (not a member):** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`)

---

## Login OK?

**Yes.** `POST /api/auth/login` succeeded.  
`GET /api/auth/me` → `role: "DPM"`, **45 unique** permissions (49 raw entries with duplicate keys), construction product mode, `enabledModules` includes estimates / change_orders / invoices / bills / settings (module flags ≠ permission grants).

Live permissions **exactly match** `DEFAULT_ROLE_PERMISSIONS.DPM` in `packages/shared/src/permissions/defaults.ts` (no extras, no missing).

---

## Intent vs defaults

Comment in defaults: *“DPM: PM minus final approvals (submit, not approve estimates)”* and *“Same as PM but CANNOT approve estimates, change orders, or manage proposals”*.

| Expectation | Defaults / live | Live API |
|-------------|-----------------|----------|
| Create / submit estimates | `estimate.create`, `estimate.submit` | **yes** (create 201, submit → `REVIEWED`) |
| Approve / reject estimates | no `estimate.approve` | **403** “Only OWNER role can approve/reject estimates” (service hard-gate) |
| Create / submit change orders | `change_order.create` | **broken for DPM** — see Surprises |
| Approve change orders | no `change_order.approve` | **403** `requires one of: OWNER` (route `requireRole`) |
| Measure BOQ | `boq.record_measurement` | **yes** (201) |
| Petty cash create | `petty_cash.create` (no approve) | **yes** (201 PENDING) |
| Snags | `snag.create` / `snag.rectify` | **yes** (punch-list 201) |
| Drawings upload | `drawing.upload` (no `drawing.manage`) | **yes** (201) |
| Financial amounts / budget | `financials.view_amounts`, `financials.view_budget` | project `budget` visible; **no** P&L / company finance dashboard |
| Accounting invoices / bills | no `invoice.*` / `bill.*` | bills **403**; invoice **GET** soft-open, **POST** 403 |
| Settings admin | only `settings.material_prices`, `settings.rate_analysis` | users / permissions / company write **403** |

### PM − DPM (defaults DPM correctly drops)

`bill.view`, `boq.import`, `drawing.manage`, `invoice.view`, `labor.wage_settle`, `petty_cash.approve`, `portal.manage`, `procurement.create_direct_po`, `procurement.excess_order`, `procurement.override_rates`, `proposal.create`, `settings.rate_regions`, `tally.export`

Also neither role has `estimate.approve` / `change_order.approve` in the catalog (Owner-only in practice).

---

## Nav tabs expected

From `ROLE_TABS.DPM` (`packages/shared/src/constants/index.ts` + `apps/mobile/constants/index.ts`):

| Tab | Expected |
|-----|----------|
| dashboard | yes |
| projects | yes |
| planning | yes |
| reports | yes |
| proposals | **no** (PM has it) |
| accounting | **no** (PM has it) |
| settings | **no** |

Matches intent: field/PM ops without commercial accounting hub or proposals tab.  
Note: proposal **API** create still works (see Surprises) even though tab is omitted and `proposal.create` is not granted.

---

## Permissions (live unique)

```
attendance.checkin
attendance.view
boq.edit
boq.record_measurement
boq.view
boq.view_rates
change_order.create
change_order.view
drawing.upload
drawing.view
estimate.create
estimate.export
estimate.submit
estimate.view
financials.view_amounts
financials.view_budget
labor.muster_edit
labor.view
petty_cash.create
petty_cash.view
planning.edit
planning.view
procurement.approve_indent
procurement.approve_po
procurement.create_indent
procurement.indent_from_boq
procurement.record_grn
procurement.view
procurement.view_rates
project.create
project.edit
project.view
proposal.view
report.view
reports.download
reports.view
settings.material_prices
settings.rate_analysis
snag.create
snag.rectify
snag.view
stock.adjust
stock.manage
stock.view
subcontract.view
```

**Notably absent:** `estimate.approve`, `change_order.approve`, `petty_cash.approve`, `invoice.view`, `bill.view`, `proposal.create`, `settings.users`, `settings.permissions`, `settings.company`, `financials.view_profit`.

---

## Seed / membership note

Seed assigns NH-45 members: OWNER, PM, SUPERVISOR, STORE_INCHARGE — **not DPM**.  
Non-OWNER list is membership-filtered → DPM `/projects` is empty until DPM creates a project (then appears as member with role `DPM`).  
Direct GET by UUID still returns NH-45 (company-scoped get, no membership gate).

---

## Endpoint matrix (live probe)

| Path | Method | Status | Can? | Note |
|------|--------|--------|------|------|
| `/auth/login` | POST | 200 | yes | OTP |
| `/auth/me` | GET | 200 | yes | role DPM + 45 perms |
| `/projects` | GET | 200 | yes | membership-filtered (0 until create) |
| `/projects` | POST | 201 | yes | created probe project; budget returned |
| `/projects/:id` (own) | GET | 200 | yes | budget visible |
| `/projects/:id` (NH-45) | GET | 200 | yes | not a member; detail still open |
| `/projects/:id/estimates` | GET | 200 | yes | NH-45 + own |
| `/projects/:id/estimates` | POST | 201 | yes | draft |
| `/estimates/:id` sections/items | POST | 201 | yes | after valid body |
| `/estimates/:id/submit` | POST | 200 | yes | status → `REVIEWED` |
| `/estimates/:id/approve` | POST | 403 | **no** | OWNER-only service gate |
| `/estimates/:id/reject` | POST | 403 | **no** | OWNER-only |
| `/projects/:id/boq` | GET | 200 | yes | rates/totals present |
| `/boq/:id/measurements` | POST | 201 | yes | qty recorded |
| `/projects/:id/change-orders` (own) | GET | 200 | yes | empty list |
| `/projects/:id/change-orders` (NH-45) | GET | **timeout** | **broken** | expected 403 (not member); hangs |
| `/projects/:id/change-orders` | POST | **timeout** | **broken** | route allows DPM; service `assertProjectAccess(..., ['OWNER','PM'])` throws; no `asyncHandler` → hang |
| `/…/change-orders/:id/submit` | POST | **timeout** | **broken** | same OWNER\|PM project-role gate + hang |
| `/…/change-orders/:id/approve` | POST | 403 | **no** | `requireRole(OWNER)` — correct |
| `/projects/:id/scope-summary` | GET | 200 | yes* | *no membership check; amounts exposed |
| `/projects/:id/invoices` | GET | 200 | soft | no `invoice.view`; totals visible |
| `/projects/:id/invoices` | POST | 403 | **no** | role list excludes DPM |
| `/projects/:id/bills` | GET | 403 | **no** | `bill.view` |
| `/bills` | GET | 403 | **no** | `bill.view` |
| `/company/financials/dashboard` | GET | 403 | **no** | OWNER / ACCOUNTANT / INVENTORY_MANAGER |
| `/projects/:id/financials/pl` | GET | 403 | **no** | OWNER / PM / ACCOUNTANT — **DPM excluded** despite amount/budget perms |
| `/projects/:id/financials/cashflow` | GET | 403 | **no** | same |
| `/projects/:id/financials/estimate-vs-actual` | GET | 403 | **no** | same |
| `/petty-cash` | GET | 200 | yes | |
| `/petty-cash` | POST | 201 | yes | PENDING voucher |
| `/petty-cash/:id/approve` | POST | n/a | **no** | no `petty_cash.approve`; not probed as success |
| `/drawings` | GET | 200 | yes | |
| `/drawings` | POST | 201 | yes | |
| `/punch-list` | GET | 200 | yes | snags |
| `/punch-list` | POST | 201 | yes | |
| `/proposals` | GET | 200 | yes | `proposal.view` |
| `/proposals` | POST | 201 | **over** | no `proposal.create` in defaults; POST ungated |
| `/rate-analysis` | GET | 200 | yes | |
| `/settings/company` | GET | 200 | yes‡ | unguarded read |
| `/settings/company` | PUT | 403 | **no** | `settings.company` |
| `/settings/users` | GET | 403 | **no** | |
| `/settings/permissions` | GET | 403 | **no** | |
| `/settings/audit` | GET | 403 | **no** | |
| `/settings/integrations` | GET | 403 | **no** | |
| `/settings/subscription` | GET | 403 | **no** | |
| `/settings/rate-regions` | GET | 200 | yes† | `requireAnyPermission(rate_regions \| material_prices)` |
| `/settings/me` | GET | 200 | yes | |
| `/analytics/dashboard` | GET | 403 | **no** | OWNER-only |

‡ GET company has no permission guard.  
† Read allowed via `settings.material_prices`; writes still need `settings.rate_regions` (DPM lacks).

---

## Surprises

1. **Change-order create/submit unusable for DPM (defaults vs service vs hang)**  
   - Defaults + route: DPM may create/submit (`change_order.create`, `requireRole(OWNER|PM|DPM)`).  
   - Service: `assertProjectAccess(..., ['OWNER', 'PM'])` — project membership role **DPM** is rejected.  
   - Controllers are not wrapped in `asyncHandler`, so the thrown `FORBIDDEN` never reaches the error handler → **client timeout (HTTP 000)** instead of 403.  
   - Same hang on NH-45 CO **list** (not a member → throw → hang).  
   - Approve correctly returns **403** because `requireRole(OWNER)` is synchronous middleware.

2. **Estimate approve route lists DPM, service blocks OWNER-only**  
   `ESTIMATE_MUTATION_ROLES` includes DPM for approve/reject/convert, but `approveEstimate` / reject enforce OWNER. Live deny is correct; route guard is broader than intent.

3. **Invoice list soft-open; create blocked**  
   No `invoice.view` / `invoice.create`. `GET …/invoices` → 200 with monetary totals. `POST` → 403 (role gate). Matches “no accounting invoices typically” for writes only.

4. **Financial amounts yes; finance dashboards no**  
   Budget / estimate totals / scope-summary amounts work. Company finance dashboard and project P&L/cashflow/EVA require PM (or OWNER/ACCOUNTANT) — DPM gets **403** despite `financials.view_amounts` / `view_budget`. Stricter than the permission tags imply.

5. **Proposal create over-granted**  
   Defaults omit `proposal.create`; `ROLE_TABS` omits proposals. `POST /proposals` still **201** (auth + module only). Promote remains OWNER-only.

6. **Seed: DPM not on NH-45**  
   Empty project list until DPM creates a project; many probes needed an ad-hoc project. Direct UUID access still reaches NH-45 data.

7. **`docs/ROLE_PERMISSION_API_MATRIX.md` UNDER rows for DPM are partly stale**  
   Punch-list / petty-cash / drawing MUT roles now include DPM (live create works). Change-order create UNDER remains true (and worse: hang). `estimate.approve` OVER (route) remains true with service OWNER gate.

---

## Cross-check summary

| Source | Verdict |
|--------|---------|
| `DEFAULT_ROLE_PERMISSIONS.DPM` | Matches `/auth/me` |
| `ROLE_TABS.DPM` | dashboard / projects / planning / reports — no accounting / proposals / settings |
| Estimate create/submit | OK |
| Estimate / CO approve | Denied as intended |
| CO create/submit (tagged yes) | **Fail live** (service OWNER\|PM + hang) |
| BOQ measure, snags, drawings, petty cash | OK |
| Bills / settings admin | Denied as intended |
| Invoice GET | Soft leak |

No app code was modified in this audit.
