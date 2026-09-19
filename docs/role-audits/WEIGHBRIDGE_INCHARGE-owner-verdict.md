# WEIGHBRIDGE_INCHARGE — Owner verdict

**Verdict: TOO_LITTLE**

**Intent:** weighbridge — GRN + daily reports + stock view; no money; no accounting; no PO approve.

## Permission map (defaults + live `/auth/me`)
Live list matches defaults (11): `project.view`, `boq.view`, `procurement.view`, `procurement.record_grn`, `stock.view`, `drawing.view`, `report.view`/`create`, `attendance.*`, `reports.view`. No `approve_po`, `financials.*`, `bill.*`, `invoice.*`, `petty_cash.*`, `stock.manage`. On paper → intent fit (mild extras: `boq.view`, `drawing.view`).

## Live API (`weighbridge@reddyconst.com`)
| Area | Result | Verdict |
|------|--------|---------|
| GRN `POST .../procurement/grn` | **403** project roles OWNER/PM/SUPERVISOR only (despite `record_grn`) | TOO_LITTLE |
| Daily reports list / create | 200 / create allowed (409 if date exists) | APPROVE |
| Stock view / movements | 200 | APPROVE |
| Stock issue / indent / **PO approve** | 403 | APPROVE |
| Bills / settings users·permissions | 403 | APPROVE |
| Invoices list | **200 with total/paid/GST** | TOO_MUCH |
| BOQ GET / stock summary / requisitions | **rates·amounts / catalogRate / expectedRate** | TOO_MUCH |
| Estimate create | **201** ungated | TOO_MUCH |
| Seed project membership | Not on NH-45 by default (assigned for probe) | ops |

## Why TOO_LITTLE
Core weighbridge job is GRN; tagged `procurement.record_grn` is overridden by a narrower project-role gate, so the role cannot weigh/receive. Reports + stock view work; PO approve and accounting writes are correctly blocked. After unlocking GRN for this role, strip money fields / gate estimates·invoices before APPROVE (same leak class as QC/Mechanical).

Checked: 2026-09-19 · API `localhost:4000/api`
