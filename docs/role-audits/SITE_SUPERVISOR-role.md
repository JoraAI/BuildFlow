# SITE_SUPERVISOR role audit — BuildFlow Construction ERP

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Mahesh Singh (`site@reddyconst.com`) / OTP `111111`  
**Company:** Reddy Constructions Pvt Ltd (`1f755862-fc64-471b-a08f-74ef1f700ba8`)  
**Sample project:** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`)

---

## Login OK?

**Yes.** `POST /api/auth/login` → access token.  
`GET /api/auth/me` → `role: "SITE_SUPERVISOR"`, **19 permissions**, construction mode. Live list **exactly matches** `DEFAULT_ROLE_PERMISSIONS.SITE_SUPERVISOR`.

---

## Nav tabs (ROLE_TABS)

Both `packages/shared/src/constants/index.ts` and `apps/mobile/constants/index.ts`:

| Tab | SITE_SUPERVISOR |
|-----|-----------------|
| dashboard / projects / reports | yes |
| proposals / planning / accounting / settings | **no** |

Matches field-ops surface (site work via project screens, not money hubs).

---

## Permissions (live = defaults)

```
attendance.checkin
attendance.view
boq.record_measurement
boq.view
drawing.manage
drawing.upload
drawing.view
labor.muster_edit
labor.view
petty_cash.create
petty_cash.view
planning.view
project.view
report.create
report.view
reports.view
snag.create
snag.rectify
snag.view
```

**Absent (intended):** `financials.view_*`, `estimate.*`, `invoice.*`, `bill.*`, `settings.*`, `boq.edit` / `boq.view_rates`.

Defaults header comment still says *“daily reports + attendance + project view (no amounts)”* — actual grant set is broader (BOQ measure, drawings, snags, petty cash, labor).

---

## Endpoint matrix (live probe)

| Area | Request | HTTP | Notes |
|------|---------|------|-------|
| Projects list/detail | `GET /projects`, `/projects/:id` | **200** | Member of NH-45; exposes **`budget=24522500`** |
| Daily report create | `POST /projects/:id/reports` | **201** | OK (unique date; same-day → 409) |
| Drawings list | `GET /drawings?projectId=` | **200** | |
| Drawing upload | `POST /drawings` | **201** | Matches `drawing.upload` |
| Drawing manage | `PUT /drawings/:id` + version | **200** / **201** | Matches `drawing.manage` |
| Snags list | `GET /punch-list?projectId=` | **200** | |
| Snag create | `POST /punch-list` | **201** | |
| Snag rectify | `PUT /punch-list/:id` status | **200** | Matches `snag.rectify` |
| BOQ view | `GET .../boq` | **200** | Items include **`rate` / `amount`** |
| BOQ measure | `POST /boq/:id/measurements` | **201** | Matches `boq.record_measurement` |
| BOQ create | `POST .../boq` | **403** | Correct (mutation roles) |
| BOQ vs-actual | `GET .../boq/vs-actual` | **200** | Exposes `boqAmount` / `actualSpend` |
| Petty cash list/summary | `GET /petty-cash`, `/summary` | **200** | |
| Petty cash create | `POST /petty-cash` | **201** | PENDING voucher |
| Labor attendance / productivity | `GET .../labour/attendance-summary`, `/productivity` | **200** | |
| Labor cost-tracking | `GET .../labour/cost-tracking` | **403** | OWNER/PM/ACCOUNTANT only |
| Labor muster write | — | **n/a** | `labor.muster_edit` tagged; **no muster mutation route** found |
| Invoices list/detail | `GET .../invoices`, `/invoices/:id` | **200** | **Full totals** (no `invoice.view`) |
| Invoice create | `POST .../invoices` | **403** | Correct |
| Bills | `GET .../bills` | **403** | `bill.view` missing |
| Estimates list/detail | `GET .../estimates`, `/estimates/:id` | **200** | Approved estimate **summary + item rates** |
| Estimate approve | `POST /estimates/:id/approve` | **403** | requires OWNER/PM/DPM/ACCOUNTANT |
| Financials API | `GET .../financials/pl` etc. | **403** | Role-gated |
| PDF P&L | `GET /reports/pdf/.../profit-loss` | **200** | PDF download succeeds despite API 403 |
| Settings admin | users / permissions / audit / billing / export | **403** | Correct |
| Settings me/company | `GET /settings/me`, `/company` | **200** | Profile/company read OK |
| Settings company write | `PUT /settings/company` | **403** | Correct |

---

## Cross-check vs intent (defaults)

| Capability | Defaults | Live API | Verdict |
|------------|----------|----------|---------|
| `boq.record_measurement` | **yes** | **201** | **OK** (matrix doc outdated — SITE_SUPERVISOR is in `requireRole`) |
| `drawing.upload` / `drawing.manage` | **yes** | **201** / **200** | **OK** |
| `snag.create` / `snag.rectify` | **yes** | **201** / **200** | **OK** |
| Daily reports create | `report.create` | **201** | OK |
| Petty cash create | `petty_cash.create` | **201** | OK |
| Labor muster | `labor.muster_edit` | read-only labour GETs | **Gap** — perm unused by API |
| Amounts / budget | **no** `financials.view_*` | budget, BOQ rates, invoices, estimate totals, P&L PDF | **Leak** |
| Invoice create / estimate approve | no | **403** | OK |
| Settings admin | no | **403** | OK |

---

## Surprises

1. **“No amounts” is not enforced:** no `financials.view_amounts` / `view_budget`, yet project `budget`, BOQ `rate`/`amount`, vs-actual spend, invoice totals, and estimate `summary.grandTotal` (₹66.5L) are returned in JSON.
2. **PDF P&L bypass:** `/financials/pl` is 403; `/reports/pdf/.../profit-loss` returns a PDF (~23KB).
3. **Accounting reads open:** invoice/estimate GET are auth-only; bills correctly permission-gated.
4. **`labor.muster_edit` orphan:** tagged in defaults; only labour summary/productivity GETs exist (cost-tracking correctly denied).
5. **Matrix CSV** still claims SITE_SUPERVISOR blocked on `boq.record_measurement` / drawing upload mismatches — **live code is aligned** with defaults for measure + drawings + snag rectify.

---

## Summary

SITE_SUPERVISOR defaults and ROLE_TABS fit site ops: reports, BOQ measure, drawings upload/manage, snags create/rectify, petty cash, attendance. Money mutations and settings admin are correctly denied. **Main gap:** financial **reads** (budget, rates, invoices, estimates, P&L PDF) ignore the “no amounts” design. Secondary: `labor.muster_edit` has no write API.
