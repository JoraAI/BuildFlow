# SITE_SUPERVISOR — Owner verdict

**Verdict: TOO_MUCH**

**Intent:** site ops — reports, muster/attendance, snags, drawings, measure, petty cash. **No** money/budget, **no** accounting, **no** estimate/CO approve, **no** settings admin.

## Permission map (defaults + live `/auth/me`)
| Area | Tagged | Verdict |
|------|--------|---------|
| Reports (`report.view/create`, `reports.view`) | YES | APPROVE |
| Muster / attendance (`labor.view`, `labor.muster_edit`, `attendance.*`) | YES | APPROVE |
| Snags (`snag.view/create/rectify`) | YES | APPROVE |
| Drawings (`drawing.view/upload/manage`) | YES | APPROVE |
| Measure (`boq.view`, `boq.record_measurement`) | YES | APPROVE |
| Petty cash (`petty_cash.view/create`; no approve) | YES | APPROVE |
| Money (`financials.*`, `boq.view_rates`) | NO | APPROVE |
| Accounting (`bill.*`, `invoice.*`, `tally.*`) | NO | APPROVE |
| Estimate / CO approve | NO | APPROVE |
| Settings admin | NO | APPROVE |

On paper the role matches site intent (19 live perms = defaults). Nav tabs: `dashboard`, `projects`, `reports` — no accounting/settings.

## Live API (`site@reddyconst.com`)
| Area | Result | Verdict |
|------|--------|---------|
| Daily report create | 201 | APPROVE |
| Punch/snag create | 201 | APPROVE |
| Drawing create | 201 | APPROVE |
| Petty cash create | 201 | APPROVE |
| BOQ measurement POST | 201 (role allowed) | APPROVE |
| Labour cost-tracking | 403 OWNER/PM/ACCOUNTANT | APPROVE |
| Estimate / CO approve | 403 | APPROVE |
| CO create | 403 | APPROVE |
| Bills / settings users·permissions·integrations·export | 403 | APPROVE |
| Estimate create / list | **201/200** with `grandTotal` (no `estimate.*`) | TOO_MUCH |
| Estimate submit | ungated (409 status conflict, not 403) | TOO_MUCH |
| Invoices GET | **200** with totals/amounts (no `invoice.view`) | TOO_MUCH |
| BOQ GET | **200** with `rate`/`amount` (no `boq.view_rates`) | TOO_MUCH |
| Project summary | **200** budget/spend/estimate totals | TOO_MUCH |
| P&L / est-vs-actual PDF | **200** binary | TOO_MUCH |

## Why TOO_MUCH
Declared SITE_SUPERVISOR grants fit Owner site intent, and approve / bills / settings admin are correctly blocked. Enforcement still leaks money and estimate write/read via auth-only routes (invoices, BOQ rates/amounts, estimate create/list/totals, financial PDFs, project summary). Strip amounts and gate estimate/invoice/finance-PDF routes before re-review.

Checked: 2026-09-19 · API `localhost:4000/api` · Owner `owner@reddyconst.com` · Site `site@reddyconst.com`
