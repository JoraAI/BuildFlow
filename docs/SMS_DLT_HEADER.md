# India DLT SMS header (VILPOWER / MSG91)

## Decision (Oct 2026)

| Field | Value |
|--------|--------|
| Principal Entity | **StaffingPros** (registered business) |
| Brand name (register on VILPOWER) | **StaffingPros** (same as entity) |
| SMS Header / Sender ID | **`VIDTL`** (approved) |
| Product using OTPs | BuildFlow (operated by StaffingPros / Jora AI) |

**Do not resubmit `BLDFLO`.** It was rejected because it matched the product name, not the entity name.

## Do you need a Brand to create a template?

| Requirement | Needed? |
|-------------|---------|
| Brand name **inside the SMS body** | **Yes** — templates are often rejected without it |
| Brand selected in VILPOWER dropdown | **Recommended** — dropdown is empty until you register + enable a brand; VILPOWER marks the field optional, but registering avoids “No header associated with the brand name” / empty-dropdown friction |
| Template name = entity name | **No** — use any label, e.g. `buildflow_otp` |

**Practical path:** register brand **StaffingPros** first (docs below), enable it, then create the Content Template with header **VIDTL**.

## Support PDFs — Brand (upload with Brand → + Add)

| File | Use |
|------|-----|
| [docs/dlt-support/StaffingPros_Brand_Name_Declaration.pdf](dlt-support/StaffingPros_Brand_Name_Declaration.pdf) | Full signed declaration |
| [docs/dlt-support/StaffingPros_Brand_Name_Declaration_Simple.pdf](dlt-support/StaffingPros_Brand_Name_Declaration_Simple.pdf) | Short supporting note |

## Support PDFs — Header (archive / if re-applying a header)

| File | Use |
|------|-----|
| [docs/dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration.pdf](dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration.pdf) | Full signed declaration |
| [docs/dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration_Simple.pdf](dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration_Simple.pdf) | Short supporting note |

## Brand registration checklist (VILPOWER)

1. **Brand** → **+ Add** → name **`StaffingPros`**
2. Upload signed `StaffingPros_Brand_Name_Declaration.pdf` (+ PAN/GST if asked)
3. Wait until status = **Approved**, then **Enable** the brand
4. Content Templates → **+ Add** → header **VIDTL** → select brand **StaffingPros**

## MSG91 + BuildFlow after template approval

Template text (must match DLT template exactly; brand in body; OTP is always **6 digits**):

```text
Your BuildFlow login code is {#var#}. Valid for 10 minutes. Do not share this code. - StaffingPros
```

(In MSG91 Flow you may use `##OTP##` instead of `{#var#}` — keep the rest identical. `{#var#}` will be a 6-digit number for Construction ERP + Inventory login/signup OTPs.)

```bash
MSG91_SENDER_ID=VIDTL
MSG91_AUTH_KEY=...
MSG91_FLOW_ID=...
MSG91_FLOW_OTP_VAR=OTP
SMS_PROVIDER=msg91
```

Redeploy API after changing `MSG91_SENDER_ID`.

## Why this should pass

| Rule | How it is satisfied |
|------|---------------------|
| Brand = entity name | StaffingPros ↔ Principal Entity |
| Header on same PE | VIDTL approved under StaffingPros |
| Brand in SMS body | “… - StaffingPros” |
| Not a third-party brand | Same PE owns BuildFlow |
| Transactional use only | OTP / authentication |

Code: `apps/backend/src/services/msg91.service.ts` (sender from env only).
