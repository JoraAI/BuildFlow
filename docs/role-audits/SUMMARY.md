# Role access dual-agent audit — Owner verdict summary

Date: 2026-09-19  
Method: For each Construction ERP role, a **Role agent** logged in via OTP (`111111`) and probed live APIs; an **Owner agent** reviewed against Construction ERP intent.

## Enforcement fix pack (Owner-aligned live gates) — applied

| Fix | Live smoke |
|-----|------------|
| Money stripping (BOQ rates, budget, summary, stock) | QC BOQ `rate`/`amount` = null; PM sees rates; site summary money = null |
| Money PDF gates | Site P&L PDF → 403 |
| `invoice.view` / `invoice.create` | QC invoice GET 403; PM invoice POST 403 |
| Estimate permissions | QC estimate POST 403 |
| Project create/edit permissions | Accountant POST/PUT 403 |
| Accountant company-wide project list | List returns projects |
| BOQ mutations via `boq.edit` | Accountant no longer on mutation role list |
| Indent/GRN trust `requirePermission` | Store indent → 422 validation (not role 403) |
| DPM change-order + asyncHandler | DPM CO create → 201 |
| `estimate.convert_boq` on PM/DPM defaults | Added |

Per-role probe notes remain in `docs/role-audits/*-role.md` and `*-owner-verdict.md`.
