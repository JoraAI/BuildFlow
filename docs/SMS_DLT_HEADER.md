# India DLT SMS header (VILPOWER / MSG91)

## Rejection (Oct 2026)

Header **`BLDFLO`** was rejected by VILPOWER:

> Header should match with entity name

`BLDFLO` abbreviates the **product** (BuildFlow). DLT headers must match the **Principal Entity (PE)** registered on VILPOWER — typically **StaffingPros** or **Jora AI**, not the product name.

## What to do on VILPOWER

1. Sign in → open your **Principal Entity**.
2. Copy the **exact Entity Name** as shown (including Pvt Ltd / LLP wording if present).
3. **Do not resubmit `BLDFLO`.**
4. Create a new **Header** (usually **6 letters**, A–Z) derived only from that entity name.
5. Category: **Transactional** (OTP / account verification).
6. After the header is **Approved**, map it in MSG91 and update templates + env (below).

### Suggested headers (pick the set that matches *your* PE name)

| If PE name contains… | Submit these (in order) | Avoid |
|----------------------|-------------------------|--------|
| StaffingPros / Staffing Pros | **`STAFFP`**, then `STFPS`, `STFPRO` | `BLDFLO`, `BLDFLOW` |
| Jora AI / JoraAI / Jora | **`JORAAI`**, then `JORAII` | Product-only headers |
| BuildFlow *as legal PE name* | `BLDFLO` only if PE literally contains BuildFlow | Using it when PE is StaffingPros |

India headers are commonly **exactly 6 characters**. Prefer letters that appear in the PE name.

## After approval — MSG91 + BuildFlow

1. **MSG91** (control.msg91.com): set Sender ID = approved header; Flow must use that sender and a DLT-approved template.
2. **Recommended DLT / Flow template text** (must match character-for-character once registered):

   ```text
   StaffingPros: Your BuildFlow login code is ##OTP##. Valid for 10 minutes. Do not share this code.
   ```

   Same pattern for invite / buyer OTP templates if separate.

3. **Render (API) env:**

   ```bash
   MSG91_AUTH_KEY=...
   MSG91_SENDER_ID=<APPROVED_6_CHAR_HEADER>
   MSG91_FLOW_ID=...
   MSG91_FLOW_OTP_VAR=OTP
   SMS_PROVIDER=msg91
   ```

4. Redeploy API after changing `MSG91_SENDER_ID`.

Code reads sender from env only — see `apps/backend/src/services/msg91.service.ts` and `apps/backend/src/config/env.ts`.

## Checklist

- [ ] PE entity name confirmed on VILPOWER
- [ ] New header submitted (not BLDFLO unless PE is BuildFlow)
- [ ] Header status = Approved
- [ ] DLT templates approved for that header
- [ ] MSG91 Flow linked to template + sender
- [ ] `MSG91_SENDER_ID` updated on Render and API redeployed
- [ ] Test OTP to an Indian mobile
