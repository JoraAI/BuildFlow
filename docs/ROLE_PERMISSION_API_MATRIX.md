# Role × Permission × API Access Matrix

Generated from `DEFAULT_ROLE_PERMISSIONS` + backend route guards (`requirePermission` / `requireRole`).
Reverified: 2026-09-19.

## Legend

| Column | Meaning |
|--------|---------|
| **tagged** | Role has this permission in default matrix (`YES`/`NO`) |
| **api** | `PASS` = API allows · `FAIL` = API denies · `UNGATED` = any authenticated user · `FIELD` = UI/field only · `PARTIAL` = mixed routes |
| **align** | `MATCH` = tag and API agree · `OVER` = API allows but not tagged · `UNDER` = tagged but API blocks · `N/A` = ungated/field/partial |

## Files

- Excel: [`ROLE_PERMISSION_API_MATRIX.xlsx`](./ROLE_PERMISSION_API_MATRIX.xlsx)
- Long form: [`ROLE_PERMISSION_API_MATRIX.csv`](./ROLE_PERMISSION_API_MATRIX.csv)
- Wide form: [`ROLE_PERMISSION_API_MATRIX_WIDE.csv`](./ROLE_PERMISSION_API_MATRIX_WIDE.csv)

## Totals (869 role×permission cells)

| Align | Count |
|-------|------:|
| MATCH | 460 |
| OVER (API > tag) | 22 |
| UNDER (tag > API) | 13 |
| N/A (ungated/field/partial) | 374 |

| API outcome | Count |
|-------------|------:|
| PASS | 145 |
| FAIL | 350 |
| UNGATED | 264 |
| FIELD | 44 |
| PARTIAL | 66 |

## OVER — API allows, not tagged (22)

| Role | Permission | API reason |
|------|------------|------------|
| PM | `estimate.approve` | approve/reject use ESTIMATE_MUTATION_ROLES (broader than tagged estimate.approve=OWNER only) |
| DPM | `estimate.approve` | approve/reject use ESTIMATE_MUTATION_ROLES (broader than tagged estimate.approve=OWNER only) |
| ACCOUNTANT | `estimate.approve` | approve/reject use ESTIMATE_MUTATION_ROLES (broader than tagged estimate.approve=OWNER only) |
| PM | `estimate.convert_boq` | convert-to-boq uses BOQ_MUTATION_ROLES |
| DPM | `estimate.convert_boq` | convert-to-boq uses BOQ_MUTATION_ROLES |
| ACCOUNTANT | `estimate.convert_boq` | convert-to-boq uses BOQ_MUTATION_ROLES |
| ACCOUNTANT | `boq.edit` | BOQ_MUTATION_ROLES |
| SUPERVISOR | `boq.record_measurement` | SITE_SUPERVISOR not included; QC/DPM tagged but blocked |
| DPM | `boq.import` | BOQ_MUTATION_ROLES |
| ACCOUNTANT | `boq.import` | BOQ_MUTATION_ROLES |
| STORE_INCHARGE | `stock.adjust` | inventory-stock uses stock.manage not stock.adjust |
| PM | `subcontract.create_wo` | Several WO mutations OWNER/PM |
| PM | `subcontract.approve_measurement` | Approve paths OWNER/PM |
| PM | `invoice.create` | requireRole(OWNER|PM|ACCOUNTANT|INVENTORY_MANAGER) |
| PM | `financials.view_profit` | P&L/cashflow requireRole |
| SITE_SUPERVISOR | `drawing.upload` | requireRole(OWNER|PM|SITE_SUPERVISOR|DPM) |
| DPM | `drawing.manage` | Same MUT as upload |
| SITE_SUPERVISOR | `drawing.manage` | Same MUT as upload |
| SITE_SUPERVISOR | `snag.rectify` | Same MUT group |
| DPM | `settings.rate_regions` | [route requirePermission ×6] |
| INVENTORY_MANAGER | `settings.rate_regions` | [route requirePermission ×6] |
| ACCOUNTANT | `settings.rate_analysis` | RA_MUTATION_ROLES for writes; reads auth |

## UNDER — Tagged YES, API blocks (13)

| Role | Permission | API reason |
|------|------------|------------|
| DPM | `boq.record_measurement` | SITE_SUPERVISOR not included; QC/DPM tagged but blocked |
| QC | `boq.record_measurement` | SITE_SUPERVISOR not included; QC/DPM tagged but blocked |
| DPM | `change_order.create` | requireRole(OWNER|PM) |
| DPM | `petty_cash.create` | requireRole(OWNER|PM|SITE_SUPERVISOR|ACCOUNTANT) |
| STORE_INCHARGE | `petty_cash.create` | requireRole(OWNER|PM|SITE_SUPERVISOR|ACCOUNTANT) |
| SUPERVISOR | `petty_cash.create` | requireRole(OWNER|PM|SITE_SUPERVISOR|ACCOUNTANT) |
| QC | `drawing.upload` | requireRole(OWNER|PM|SITE_SUPERVISOR|DPM) |
| QC | `drawing.manage` | Same MUT as upload |
| DPM | `snag.create` | punch-list MUT |
| MECHANICAL_MANAGER | `snag.create` | punch-list MUT |
| SUPERVISOR | `snag.create` | punch-list MUT |
| DPM | `snag.rectify` | Same MUT group |
| PM | `proposal.create` | proposal mutations OWNER |

## Enforcement coverage

Permissions with `requirePermission` on routes: `bill.approve`, `bill.create`, `bill.record_payment`, `bill.view`, `procurement.approve_indent`, `procurement.approve_po`, `procurement.create_indent`, `procurement.record_grn`, `procurement.view`, `settings.audit`, `settings.billing`, `settings.company`, `settings.export`, `settings.integrations`, `settings.material_prices`, `settings.permissions`, `settings.rate_regions`, `settings.tickets`, `settings.users`, `stock.manage`, `stock.view`
