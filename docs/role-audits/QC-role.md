# QC role audit — BuildFlow Construction ERP

**Date:** 2026-09-19  
**API:** `http://localhost:4000/api`  
**User:** Vikram Patel (`qc@reddyconst.com`)  
**Company:** Reddy Constructions Pvt Ltd (`1f755862-fc64-471b-a08f-74ef1f700ba8`)  
**Sample project (probes):** NH-45 Road Widening (`bd7944de-1b4f-4d18-821e-56171eda66a6`)

---

## Login OK?

**Yes.** `POST /api/auth/login` `{ "email":"qc@reddyconst.com", "otp":"111111" }` → access token.  
`GET /api/auth/me` → `role: "QC"`, **19 permissions**, construction product mode. Live list **exactly matches** `DEFAULT_ROLE_PERMISSIONS.QC`.

---

## Nav tabs (ROLE_TABS)

Both `apps/mobile/constants/index.ts` and `packages/shared/src/constants/index.ts`:

| Tab | QC |
|-----|-----|
| dashboard | yes |
| projects | yes |
| reports | yes |
| proposals / planning / accounting / settings | **no** |

Matches intended QC surface (quality work via project screens, not money hubs).

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
planning.view
procurement.view
project.view
report.create
report.view
reports.download
reports.view
snag.create
snag.rectify
snag.view
stock.view
subcontract.view
```

**Absent (as intended in defaults):** `financials.view_*`, `estimate.*`, `invoice.*`, `bill.*`, `petty_cash.*`, `settings.*`, `boq.edit` / `boq.view_rates`.

---

## Endpoint matrix (live probe)

| Area | Request | HTTP | Notes |
|------|---------|------|-------|
| Projects list | `GET /projects` | **200** | **Empty** — QC not on any `ProjectMember` in seed |
| Project detail | `GET /projects/:id` | **200** | Works by ID; exposes `budget=95000000` |
| BOQ view | `GET /projects/:id/boq` | **200** | Items include **`rate` / `amount`** |
| BOQ measure | `POST /boq/:id/measurements` | **201** | Allowed (role gate includes QC) |
| BOQ create | `POST /projects/:id/boq` | **403** | OWNER/PM/DPM/ACCOUNTANT only |
| BOQ vs actual | `GET .../boq/vs-actual` | **200** | Exposes `boqAmount`, `actualSpend` |
| Drawings list | `GET /drawings?projectId=` | **200** | |
| Drawing upload | `POST /drawings` | **201** | Matches defaults (matrix doc outdated) |
| Snags list | `GET /punch-list?projectId=` | **200** | |
| Snag create | `POST /punch-list` | **201** | |
| Snag rectify | `PUT /punch-list/:id` status | **200** | |
| Daily report create | `POST /projects/:id/reports` | **201** | After valid `weather` enum |
| Reports PDF progress | `GET /reports/pdf/projects/:id/progress` | **200** | PDF |
| Petty cash list/summary | `GET /petty-cash`, `/summary` | **200** | **No** `petty_cash.view` perm — reads open |
| Petty cash create | `POST /petty-cash` | **403** | Correct |
| Invoices list/detail | `GET .../invoices`, `/invoices/:id` | **200** | **Full money** (subtotal/total/GST/paid) |
| Invoice create | `POST .../invoices` | **403** | Correct |
| Bills | `GET/POST .../bills` | **403** | `bill.view` / `bill.create` missing |
| Estimates list/detail | `GET .../estimates`, `/estimates/:id` | **200** | Readable without `estimate.view` |
| Estimate approve | `POST /estimates/:id/approve` | **403** | Correct |
| Financials API | `GET .../financials/pl` etc. | **403** | Role-gated |
| PDF P&L / est-vs-actual | `GET /reports/pdf/.../profit-loss` etc. | **200** | **PDF download succeeds** despite API 403 |
| Settings admin | users/audit/integrations/billing/export | **403** | Correct |
| Settings me/company | `GET /settings/me`, `/company` | **200** | Profile/company read OK |
| Analytics | `GET /analytics/dashboard` | **403** | OWNER only |

---

## Cross-check vs intent

| Capability | Defaults | Live API | Verdict |
|------------|----------|----------|---------|
| Projects / quality nav tabs | ROLE_TABS only dashboard/projects/reports | Matches | OK |
| BOQ view + measure | yes | 200 / 201 | OK |
| Drawings upload/manage | yes | 201 | OK |
| Snags create/rectify | yes | 201 / 200 | OK |
| Reports create/view | yes | 201 / 200 | OK |
| Petty cash | no | create 403; **list/summary 200** | Leak (read) |
| Invoices / bills | no | create/bills 403; **invoice read 200 + amounts** | Leak (invoice read) |
| Estimate approve | no | 403 | OK |
| Financial amounts | no `financials.view_*` | **BOQ rates, project budget, invoice totals, vs-actual spend, P&L PDF** | **Leak** |
| Settings admin | no | 403 | OK |

---

## Surprises

1. **Seed:** `GET /projects` returns `[]` for QC (user not assigned as project member), but any known project UUID is still readable — membership filters list only.
2. **Money without permission:** No `financials.view_amounts`, yet BOQ `rate`/`amount`, project `budget`, invoice detail totals, and BOQ vs-actual spend are returned in JSON.
3. **Accounting-adjacent reads open:** Invoice list/detail and estimate list/detail are auth-only (no permission/role gate on GET); PDF P&L bypasses the stricter `/financials/*` role gate.
4. **Petty-cash GET** has no `requirePermission('petty_cash.view')` — QC can read summaries.
5. `docs/ROLE_PERMISSION_API_MATRIX.md` still claims drawing upload blocked for QC; **live is fixed** (201).

---

## Summary

QC defaults and ROLE_TABS are coherent for quality work (measure, drawings, snags, reports). Mutations for money/approvals/settings are correctly denied. **Main gap:** financial and accounting **read** surfaces (BOQ rates, invoices, P&L PDF, petty-cash summary, project budget) are not gated on `financials.view_amounts` / role, so QC can see money in practice.
