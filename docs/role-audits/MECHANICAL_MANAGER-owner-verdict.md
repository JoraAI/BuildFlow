# MECHANICAL_MANAGER — Owner verdict

**Verdict: TOO_MUCH**

**Intent:** equipment/site mechanical — reports + snags + limited views; no money; no accounting; no BOQ edit.

## Permission map (defaults + live `/auth/me`)
Fits intent on paper: `report.*`, `snag.view/create`, limited `project/planning/boq/drawing/procurement/stock/subcontract` views. No `financials.*`, `invoice.*`, `bill.*`, `tally.*`, `petty_cash.*`, `boq.edit`, or `boq.view_rates`.

## Live API (mechanical@reddyconst.com)
| Area | Result |
|------|--------|
| Reports create / snags create | OK (201) |
| BOQ edit | Blocked (403) |
| Bills / accounting writes | Blocked (403) |
| Invoices list | **200 with totals/paid** (no `invoice.view`) |
| BOQ GET | **200 with `rate`/`amount`** |
| Material rates | **200 with rates** |
| Estimates list | **200 with `grandTotal`** |
| Project list | Empty (user not a project member — ops/seed, not matrix) |

## Why TOO_MUCH
Declared grants are close to APPROVE, but enforcement leaks money (invoices, BOQ rates/amounts, material rates, estimate totals) despite “no money.” Fix route guards / amount stripping before re-review.

Checked: 2026-09-19 · API `localhost:4000/api`
