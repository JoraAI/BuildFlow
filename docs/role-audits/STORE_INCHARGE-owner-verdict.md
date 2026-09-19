# STORE_INCHARGE — Owner verdict

**Verdict: TOO_LITTLE** (core indent/GRN writes blocked) **+ TOO_MUCH** (money leaks)

**Intent:** store — indents, GRN, stock, petty cash. **No** money/budget/rates. **No** accounting. **No** settings admin. **No** estimate approve.

**Sources:** `DEFAULT_ROLE_PERMISSIONS.STORE_INCHARGE` (= live `/auth/me`), `procurement.service` project-role gates, live probes `store@reddyconst.com` (2026-09-19). No `STORE_INCHARGE-role.md` present.

## Permission map (defaults + live `/auth/me`)
| Area | Tagged | Verdict |
|------|--------|---------|
| Indents (`procurement.create_indent`) | YES | APPROVE (catalog) |
| GRN (`procurement.record_grn`) | YES | APPROVE (catalog) |
| Stock (`stock.view` / `stock.manage`) | YES | APPROVE |
| Petty cash (`petty_cash.view` / `create`) | YES | APPROVE |
| Money (`financials.*`, `boq.view_rates`, `procurement.view_rates`) | NO | APPROVE |
| Indent/PO approve | NO | APPROVE |
| Accounting (`bill.*`, `invoice.*`, `tally.*`) | NO | APPROVE |
| Estimate approve | NO | APPROVE |
| Settings admin | NO | APPROVE |
| Extras (`drawing.view`, `report(s).view`, `attendance.view`, `boq.view`) | YES | APPROVE (soft) |

On paper the matrix matches store intent. Live enforcement does not.

## Live API (`store@reddyconst.com`)
| Area | Result | Verdict |
|------|--------|---------|
| Indent list / next-numbers / stock summary | 200 | APPROVE (read) |
| Indent **create** | **403** `project role: OWNER, PM, SUPERVISOR` despite `procurement.create_indent` | **TOO_LITTLE** |
| GRN **create** (valid PO/body) | **403** same project-role gate despite `procurement.record_grn` | **TOO_LITTLE** |
| Stock issue | 201 | APPROVE |
| Petty cash list / create | 200 / 201 | APPROVE |
| Indent approve | 403 `procurement.approve_indent` | APPROVE |
| Estimate approve | 403 (OWNER/PM/DPM/ACCOUNTANT) | APPROVE |
| Bills / invoice POST / settings users & permissions | 403 | APPROVE |
| Settings company GET | 200 (profile read) | APPROVE (soft) |
| Rate regions | 403 | APPROVE |
| Invoices list | **200 with total/paid/GST/subtotal** (no `invoice.view`) | **TOO_MUCH** |
| Estimates list | **200 with `grandTotal`** | **TOO_MUCH** |
| BOQ GET | **200 with `rate`/`amount`** | **TOO_MUCH** |
| Stock summary | **`catalogRate` / `gstRate` / costs** | **TOO_MUCH** |
| Indent lines | **`expectedRate`** | **TOO_MUCH** |

## Why TOO_LITTLE + TOO_MUCH
Declared grants fit Owner intent, and approve / bills / settings admin / estimate approve are correctly blocked. **Indent and GRN mutations are hard-gated to OWNER/PM/SUPERVISOR** in `procurement.service` (`createRequisition`, `createGRN`), so Store cannot perform its primary job despite permission tags. Separately, auth-only reads still leak money (invoices, BOQ rates, estimate totals, catalog rates).

**Before re-review:** add `STORE_INCHARGE` to indent/GRN project-role allow-lists (or drop those role lists and trust permissions); strip amounts / gate invoice & estimate & rate fields for roles without money perms.

Checked: 2026-09-19 · API `localhost:4000/api` · `store@reddyconst.com` / `owner@reddyconst.com` otp `111111`
