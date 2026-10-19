# India DLT SMS header (VILPOWER / MSG91)

## Decision (Oct 2026)

| Field | Value |
|--------|--------|
| Principal Entity | **StaffingPros** (registered business) |
| SMS Header / Sender ID | **`STAFFP`** |
| Why it matches | `STAFFP` = abbreviation of **StaffingPros** (entity name) |
| Product using OTPs | BuildFlow (operated by StaffingPros / Jora AI) |

**Do not resubmit `BLDFLO`.** It was rejected because it matched the product name, not the entity name.

## Support PDFs (upload with header application)

| File | Use |
|------|-----|
| [docs/dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration.pdf](dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration.pdf) | Full signed declaration |
| [docs/dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration_Simple.pdf](dlt-support/StaffingPros_STAFFP_Sender_ID_Declaration_Simple.pdf) | Short supporting note |

Also copied to Windows Downloads as:

- `C:\Users\vlaks\Downloads\StaffingPros_STAFFP_Sender_ID_Declaration.pdf`
- `C:\Users\vlaks\Downloads\StaffingPros_STAFFP_Sender_ID_Declaration_Simple.pdf`

## VILPOWER submission checklist

1. PE entity name on VILPOWER must be **StaffingPros** (or contain StaffingPros).
2. New header: **`STAFFP`** — category **Transactional**.
3. Attach both STAFFP PDFs above (sign the full declaration).
4. Attach business website screenshot / registration if asked: https://staffingpros.tech
5. App / opt-in links: https://build-flow-frontend-jet.vercel.app/ and `/sms-opt-in`
6. Wait until header status = **Approved** before sending SMS.

## MSG91 + BuildFlow after approval

Template text (must match DLT template exactly):

```text
StaffingPros: Your BuildFlow login code is ##OTP##. Valid for 10 minutes. Do not share this code.
```

Render / API env:

```bash
MSG91_SENDER_ID=STAFFP
MSG91_AUTH_KEY=...
MSG91_FLOW_ID=...
MSG91_FLOW_OTP_VAR=OTP
SMS_PROVIDER=msg91
```

Redeploy API after changing `MSG91_SENDER_ID`.

## Why this should pass

| Rule | How STAFFP satisfies it |
|------|-------------------------|
| Header matches entity name | STAFFP ↔ StaffingPros |
| Not a third-party brand | Same PE owns BuildFlow |
| Transactional use only | OTP / authentication |
| Traceable brand sites | staffingpros.tech + BuildFlow URL |

Code: `apps/backend/src/services/msg91.service.ts` (sender from env only).
