# QC — Owner verdict

**Verdict: TOO_MUCH**

**Intent:** quality work (measure, drawings, snags) — no money (`view_amounts` / budget / rates), no accounting, no estimate approve, no settings admin.

## Permission map (defaults + live `/auth/me`)
| Area | Tagged | Verdict |
|------|--------|---------|
| Measure (`boq.view`, `boq.record_measurement`) | YES | APPROVE |
| Drawings (`drawing.view/upload/manage`) | YES | APPROVE |
| Snags (`snag.view/create/rectify`) | YES | APPROVE |
| Money (`financials.view_*`, `boq.view_rates`, `procurement.view_rates`) | NO | APPROVE |
| Estimate approve / convert | NO | APPROVE |
| Accounting (`bill.*`, `invoice.*`, `tally.*`) | NO | APPROVE |
| Settings admin (`settings.users/permissions/…`) | NO | APPROVE |
| Extra reads (`procurement.view`, `stock.view`, `subcontract.view`) | YES | TOO_MUCH (beyond quality scope) |

On paper the role matches intent; extras are procurement/stock/subcontract read.

## Live API (`qc@reddyconst.com`)
| Area | Result | Verdict |
|------|--------|---------|
| Punch/snag create | 201 | APPROVE |
| Drawings list / mutate (role) | 200 / validation-only fail | APPROVE |
| BOQ measurement POST | 422 validation (not 403) — role allowed | APPROVE |
| Estimate approve / reject | 403 (OWNER/PM/DPM/ACCOUNTANT) | APPROVE |
| Bills | 403 `bill.view` | APPROVE |
| Settings users / permissions / integrations / audit / export | 403 | APPROVE |
| Estimate create / get / list | **201/200** — ungated; cost fields + `grandTotal` | TOO_MUCH |
| Estimate submit | ungated (400 empty items, not 403) | TOO_MUCH |
| Invoices list | **200 with `total`/`paidAmount`/`gstAmount`** (no `invoice.view`) | TOO_MUCH |
| BOQ GET | **200 with `rate`/`amount`** (no `boq.view_rates`) | TOO_MUCH |
| Settings company GET | 200 (profile read; not full admin) | APPROVE (soft) |

## Why TOO_MUCH
Declared QC grants fit Owner intent, and approve / bills / settings admin are correctly blocked. Enforcement still leaks money and estimate write/read via auth-only routes (invoices, BOQ rates/amounts, estimate create/list/totals). Strip amounts and gate estimate/invoice routes before re-review; optionally drop `procurement.view` / `stock.view` / `subcontract.view` if QC should stay quality-only.

Checked: 2026-09-19 · API `localhost:4000/api`
