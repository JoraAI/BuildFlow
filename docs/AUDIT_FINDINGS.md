# BuildFlow — Consolidated Audit Findings

> Evidence base for the GLM-5.2 fix & enhancement effort. Every item below was
> found by a direct code read of the repository at commit `3c47058` (plus the
> uncommitted working-tree changes). File paths and line numbers are given so
> each finding is independently verifiable. Severities: **Critical** (data loss,
> money forgery, cross-tenant breach), **High** (correctness/security defect with
> real-world impact), **Medium** (workflow/UX/data-integrity defect), **Low**
> (hygiene, cosmetic, latent risk).
>
> Companion document: [`GLM_FIX_PROMPT.md`](GLM_FIX_PROMPT.md) — the prompt that
> instructs GLM-5.2 to fix these and add peer-benchmarked features.

## How to read the IDs

Findings are prefixed by domain so they can be referenced from the prompt and
from commit messages:

| Prefix | Domain |
| ------ | ------ |
| `SEC` | Security, auth, multi-tenancy, infrastructure |
| `EST` | Estimation, BOQ, rate analysis, procurement, change orders, subcontract |
| `FIN` | Accounting, GST/TDS, invoices, bills, payments, Tally, CPM, project ops |
| `MOB` | Mobile / web app (React Native + Expo Router + React Query) |
| `UI`  | Responsive / cross-device layout quality |
| `DAT` | Database schema, migrations, seed, tests, tooling, hygiene |

A note on confidence: **the payment-webhook flaw was independently discovered by
two separate audits** (`SEC-C1/SEC-C2` and `FIN-C1/FIN-C2`). Treat it as the
single highest-priority defect.

---

## 1. Security, Auth & Multi-Tenancy (`SEC`)

### Critical

- **SEC-C1 — Legacy Razorpay webhook processes payments with no signature verification.**
  `apps/backend/src/controllers/payment.controller.ts:34-47`. The tenant-invoice
  branch calls `handlePaymentCaptured(raw)` with no HMAC check; an unauthenticated
  caller who knows an invoice UUID can mark any tenant's invoice `PAID` and inject
  a journal entry. *Fix:* verify a per-company Razorpay HMAC signature before
  processing, and scope the lookup to the verified company.

- **SEC-C2 — Prisma tenant auto-scoping covers only reads and a partial model list.**
  `apps/backend/src/lib/prisma.ts:12-47`. `READ_ACTIONS` excludes
  `update/updateMany/delete/deleteMany/create/upsert/findUnique`, and
  `TENANT_SCOPED_MODELS` omits Task, DailyReport, PurchaseOrder,
  MaterialRequisition, GoodsReceiptNote, ChangeOrder, Subcontractor,
  SubcontractWorkOrder, ClientPortalAccess, Notification, etc. Any write or
  unlisted-model access relying on this middleware is IDOR-exploitable. *Fix:*
  enforce scoping on writes and cover all tenant models, or drop the middleware
  and mandate explicit `companyId` filters everywhere with tests.

### High

- **SEC-H3 — Rate limiter trusts client-supplied `X-Forwarded-For`.**
  `apps/backend/src/middleware/rateLimiter.ts:23-27,69`. An attacker rotates a
  spoofed header per request to bypass login/register/forgot brute-force limits.
  *Fix:* set `app.set('trust proxy', ...)` to the real proxy and key on `req.ip`.

- **SEC-H4 — Rate limiter fails open when Redis errors.**
  `apps/backend/src/middleware/rateLimiter.ts:56-61`. If Redis is down, all rate
  limiting silently disappears. *Fix:* fail closed (or fall back to an in-process
  limiter) for the auth limiter.

- **SEC-H5 — MCP identity verification is broken and weak.**
  `apps/mcp-server/src/identity.ts:26-43`. Wrong secret env name, reads
  `payload.userId` while backend signs `sub`, no `type==='access'` check, no
  blacklist check, and identity is resolved once at startup and never
  re-validated. *Fix:* verify with the access secret, read `sub`, require access
  type, check the Redis blacklist, re-validate periodically.

- **SEC-H6 — MCP Prisma client has no tenant-scoping layer.**
  `apps/mcp-server/src/prisma.ts:9`. Isolation depends on every tool hand-writing
  `companyId`; one forgetful tool leaks cross-tenant. *Fix:* add the same
  ALS/`companyId` middleware (covering writes) as the backend.

- **SEC-H7 — Shared platform webhook secret enables cross-tenant payment spoofing.**
  `apps/backend/src/services/integration.service.ts:330-347` +
  `payment.service.ts:91-104,125-136`. Companies without their own Razorpay fall
  back to a single platform `webhookSecret`; any payload signed with it passes for
  any `:companyId`, and the invoice is resolved by id ignoring the path company.
  *Fix:* require per-company webhook secrets and scope the invoice lookup.

- **SEC-H8 — Privilege escalation to OWNER via user role update.**
  `apps/backend/src/services/settings.service.ts:187-201`. Only demotion of an
  existing OWNER is blocked; a user granted `settings.users` can promote anyone
  (including themselves) to OWNER. *Fix:* forbid assigning OWNER via this endpoint
  and block self-role changes.

- **SEC-H9 — Webhook raw body is JSON-stringified instead of decoded.**
  `apps/backend/src/controllers/payment.controller.ts:35,52,62,72`.
  `express.raw()` yields a Buffer; `JSON.stringify(req.body)` produces
  `{"type":"Buffer",...}`, so every HMAC is computed over the wrong bytes and
  legitimate webhooks fail. *Fix:* use `req.body.toString('utf8')`.

### Medium

- **SEC-M10 — `optionalAuth` doesn't validate token type.**
  `apps/backend/src/middleware/auth.ts:108-130`. A refresh token is accepted
  wherever `optionalAuth` grants access. *Fix:* enforce `type==='access'`.

- **SEC-M11 — Subscription billing-exempt check uses router-relative `req.path`.**
  `apps/backend/src/middleware/auth.ts:26-36,88`. Absolute prefixes like
  `/api/settings/billing` never match inside a mounted router, so expired tenants
  are locked out of the very screens that let them renew. *Fix:* match on
  `req.originalUrl` / `req.baseUrl + req.path`.

- **SEC-M12 — Signature hash is unkeyed SHA-256 (no authenticity).**
  `apps/backend/src/services/signature.service.ts:26-40`. Anyone can recompute a
  matching hash after editing a signed PO/requisition; the REQUISITION hash also
  omits `vendorName`. *Fix:* use an HMAC with a server secret and include all
  economically-relevant fields.

- **SEC-M13 — Public portal handlers lack error handling.**
  `apps/backend/src/routes/subcontract-portal.routes.ts:23-55` and
  `controllers/portal.controller.ts:30-33`. Thrown service errors become
  unhandled rejections and the request hangs (DoS on unauthenticated endpoints).
  *Fix:* wrap in try/catch and forward to `next(err)`.

- **SEC-M14 — Count-based sequential document numbers (race + reuse).**
  `apps/backend/src/lib/id-generator.ts:30-82`. Concurrent creates collide;
  deletions cause number reuse on financial/legal documents. *Fix:* use an atomic
  per-company/year counter row or a DB sequence. (Same root cause as `EST-M5`,
  `FIN-H1`, `DAT-1.2`.)

- **SEC-M15 — Cross-tenant user activity leak in audit stats.**
  `apps/backend/src/services/settings.service.ts:168-177`. `lastActive` filters by
  `userId` only, so a caller can learn another tenant's user's last-activity
  timestamp. *Fix:* add `companyId` to the `where`.

### Low

- **SEC-L16 — JWT secrets allow weak values in production.**
  `apps/backend/src/config/env.ts:33-34` (min 16 chars; `.env.example` ships
  `...-change-me`). *Fix:* require >=32 chars and reject placeholders when
  `NODE_ENV=production`.
- **SEC-L17 — Error handler returns raw error message when not production.**
  `apps/backend/src/middleware/error.ts:118-127`. *Fix:* default to a generic
  message unless an explicit debug flag is set.
- **SEC-L18 — Health endpoint discloses environment.**
  `apps/backend/src/routes/health.routes.ts:11-17`. *Fix:* drop `env` from the
  public payload.
- **SEC-L19 — `loadPermissions` swallows load failures.**
  `apps/backend/src/middleware/permission.ts:100-114`. *Fix:* log and consider
  failing closed for permission-critical routes.
- **SEC-L20 — Body size limit vs error message mismatch.**
  `apps/backend/src/app.ts:60` (1mb) vs `error.ts:100` ("max 10MB"). *Fix:* align.
- **SEC-L21 — Drive storage passes base64 string as media body.**
  `apps/backend/src/lib/storage.ts:250`. Corrupts ciphertext under the `drive`
  provider. *Fix:* upload the raw Buffer/stream with correct encoding.
- **SEC-L22 — Global compression + potential reflected secrets (BREACH).**
  `apps/backend/src/app.ts:53`. *Fix:* avoid reflecting secrets; consider
  disabling compression on auth responses.

### Confirmed-correct (no action)

Local file storage hashes the key with SHA-1 before building the path (no path
traversal); portal/invite tokens are 256-bit random, stored as SHA-256 hashes
with expiry; AES-256-GCM per-company HKDF key derivation with a
production-required master key; `verifyWebhookSignature` uses
`crypto.timingSafeEqual`; cache keys are namespaced by `companyId`; `.env` is
gitignored and was never committed.

---

## 2. Estimation, BOQ, Procurement & Change Orders (`EST`)

### Critical

- **EST-C1 — Estimate sub-items are double-counted in every summary, export, and BOQ conversion.**
  `apps/backend/src/services/estimate.service.ts:1096-1106,1128` +
  `getEstimateWithSummary` (196-234) and `listEstimates` include all items with no
  `parentId: null` filter, so the rolled-up parent **and** each child are summed.
  Section subtotals, `computeSummary`, persisted `grandTotal`, project budget, and
  Excel/PDF exports inflate ~2x whenever sub-items exist;
  `convertEstimateToBoq` (`boq.service.ts:367`) duplicates the same way. *Fix:*
  filter `parentId: null` in summary/section/BOQ-conversion queries.

- **EST-C2 — Sub-estimate re-conversion nulls `estimateItemId` links before using them.**
  `apps/backend/src/services/boq.service.ts:333-352`. The first `updateMany` sets
  `estimateItemId = null`; the archive `updateMany` then matches zero rows, so old
  BOQ lines stay active while new duplicates are created and
  `budget: { increment: estimate.grandTotal }` (line 390) is applied again on every
  re-conversion. *Fix:* archive first (or capture ids before nulling), and only
  increment budget on first conversion.

- **EST-C3 — `convertEstimateToBoq` is not transactional.**
  `apps/backend/src/services/boq.service.ts:295-447`. Archive → createMany →
  budget update → indent generation are separate writes; a mid-way failure leaves
  the BOQ archived with nothing created. *Fix:* wrap archive/create/budget in one
  `$transaction`; run indent generation afterward as non-fatal.

### High

- **EST-H1 — Shortfall math subtracts full stock/open-indent from each BOQ line → under-ordering.**
  `apps/backend/src/services/material-demand.service.ts:164-168` and
  `previewBoqShortfalls:302-313`. Demand grouped by `resourceId:boqItemId` deducts
  the same stock N times for N lines of one resource. *Fix:* compute per-resource
  totals once and distribute stock/open quantities across grouped demands.

- **EST-H2 — Description safety-net match has no `companyId` scope (cross-tenant leak).**
  `apps/backend/src/services/material-demand.service.ts:104-122` (incl. the
  uncommitted diff which adds `type: MATERIAL` but still no tenant filter). Also
  the match direction is inverted (`resource.name CONTAINS full description`).
  *Fix:* add `companyId` and match description-contains-name / tokenized.

- **EST-H3 — GRN has no over-receiving or PO-line validation.**
  `apps/backend/src/services/procurement.service.ts:291-372`. Any resource in any
  quantity can be received against any PO (even `DRAFT`), incrementing stock and
  `procuredQty` uncapped. *Fix:* validate GRN lines against PO lines, cap
  cumulative received qty, and require PO status `APPROVED`.

- **EST-H4 — GRN → BOQ `procuredQty` posts the full quantity to the first matching requisition line.**
  `apps/backend/src/services/procurement.service.ts:356-368`. Two requisition
  lines for one resource against different BOQ items credit everything to the
  first. *Fix:* apportion GRN quantity across requisition lines by outstanding qty.

- **EST-H5 — Change-order approval status check is outside the transaction.**
  `apps/backend/src/services/change-order.service.ts:195-271`. Two concurrent
  approvals both pass the `status !== 'SUBMITTED'` check and double-apply BOQ
  quantities, WO value, and budget. *Fix:* use a guarded
  `updateMany({ where: { id, status: 'SUBMITTED' } })` inside the transaction.

- **EST-H6 — Change-order BOQ lines can never get a non-zero quantity.**
  `apps/backend/src/services/change-order.service.ts:397-408`. Lines are created
  with `qtyDelta: 0` and there is no endpoint to update them. *Fix:* add a
  line/CO update endpoint (or accept `qtyDelta` in `add-boq-lines`) and recompute
  `costImpact`.

- **EST-H7 — Rate change via `updateResource`/`bulkUpsertResources` writes no price-history row and is silently reverted.**
  `apps/backend/src/services/resource.service.ts:181-197,497-512` +
  `syncEffectiveResourceRate:287-313`. Opening the price-history screen overwrites
  the manual rate with the latest history rate. *Fix:* create a history row on
  every rate change.

- **EST-H8 — `updateRateAnalysis`/`createRateAnalysis` delete-then-recreate components without a transaction.**
  `apps/backend/src/services/rate-analysis.service.ts:47-71,191-202`. A failure
  between delete and create permanently loses all components. *Fix:* wrap
  delete+create+total in `$transaction`.

- **EST-H9 — Integration test posts to a nonexistent route.**
  `apps/backend/src/__tests__/integration/estimate-links.test.ts:55-57,120` uses
  `/api/estimates/:id/items`; the only item route is
  `/api/estimates/:id/sections/:sid/items` (`estimate.routes.ts:107`). All three
  link-integrity tests fail. *Fix:* use the section-scoped path.

### Medium

- **EST-M1 — Open-requisition quantity is counted forever.**
  `material-demand.service.ts:36-47`. Requisitions stay `APPROVED` with no
  CLOSED/FULFILLED transition, so both resulting stock and the still-open
  requisition are subtracted — permanent under-ordering. *Fix:* exclude fully
  received requisitions or add a CLOSED status on full receipt.
- **EST-M2 — `approveEstimate` supersede cascade not transactional; SUPERSEDED→APPROVED reactivation.**
  `estimate.service.ts:726-818,962-968`. Concurrent approvals can leave two
  APPROVED versions. *Fix:* wrap in a transaction with guarded `updateMany`;
  reconsider reactivation.
- **EST-M3 — `duplicateEstimate` is a non-transactional multi-write loop and flattens sub-items.**
  `estimate.service.ts:887-930`. *Fix:* use `$transaction`, copy `parentId`.
- **EST-M4 — `updateItem` doesn't validate `sectionId` belongs to the estimate.**
  `estimate.service.ts:584-599`. An item can be moved to another estimate's
  section. *Fix:* validate the target section's `estimateId`.
- **EST-M5 — Requisition/PO number generation races and collides after deletions.**
  `apps/backend/src/lib/id-generator.ts:30-83`,
  `material-demand.service.ts:49-53`. *Fix:* atomic counter/sequence or retry on
  P2002.
- **EST-M6 — `createPO` doesn't validate lines against the approved requisition; client-supplied `poNumber`.**
  `procurement.service.ts:242-289`. *Fix:* validate PO lines ⊆ requisition lines
  with remaining qty; generate `poNumber` server-side.
- **EST-M7 — Proposal status machine can be bypassed and regresses on estimate resubmission.**
  `proposal.service.ts:205,384-390`. *Fix:* whitelist allowed transitions.
- **EST-M8 — Excel "Rate Analysis Used" sheet shows the wrong analyses.**
  `estimate-export.service.ts:237-252` (ignores each item's `rateAnalysisId`).
  *Fix:* collect and query `item.rateAnalysisId`.
- **EST-M9 — Tender soft-match is inverted, so AI import rarely links items.**
  `tender-extract.service.ts:202-239`. *Fix:* match name-in-description or token
  overlap.
- **EST-M10 — `createWorkOrderFromBoq` rejects sub-estimate SUBCONTRACTOR items.**
  `subcontract.service.ts:360-363` (`!== 'SUBCONTRACTOR'` vs
  `SUBCONTRACTOR/Extra Scope`). *Fix:* use `startsWith('SUBCONTRACTOR')`.
- **EST-M11 — Subcontract measurements can over-certify and use arbitrary rates.**
  `subcontract.service.ts:596-626,456`. *Fix:* validate lines against contract
  balance/rate; whitelist updatable fields and status transitions.
- **EST-M12 — `postApprovedMeasurementToBoq` runs outside the approval transaction.**
  `subcontract.service.ts:766`. *Fix:* move inside the transaction or add a
  reconciliation job.
- **EST-M13 — BOQ / rate-analysis mutation routes have no role/permission guard.**
  `boq.routes.ts:24-34`, `estimate.routes.ts:172`, `rate-analysis.routes.ts`. Any
  member can archive the entire BOQ / overwrite budget. *Fix:* add
  `requireRole`/`requirePermission`.
- **EST-M14 — Change-order approval can drive BOQ quantity negative and skips CPM.**
  `change-order.service.ts:207-215,241-253`. *Fix:* clamp `newQty >= executedQty >= 0`
  and trigger CPM recompute.
- **EST-M15 — No unit-conversion handling in demand/procurement math.**
  `material-demand.service.ts:74-98`, `procurement.service.ts:322-353`. MT vs kg
  are added raw. *Fix:* validate/convert units.
- **EST-M16 — GST computed only on direct item cost, excluding overhead/contingency/profit.**
  `estimate.service.ts:110-117`. *Fix:* apply GST on the marked-up base (confirm
  intent).

### Low

`EST-L1` wrong enum in `estimateQuerySchema` (`validators/estimate.ts:125`);
`EST-L2` dead `demandsFromEstimateItems` and mismatched test helper;
`EST-L3` unmounted `estimateToBoqRouter` (`boq.routes.ts:43-45`);
`EST-L4` ignored `reqNumber` in `createRequisitionSchema`;
`EST-L5` sub-item creation requires a dummy `sectionId`;
`EST-L6` NaN passes `scopeQty <= 0` (`material-demand.service.ts:69-70`);
`EST-L7` unbounded `listRequisitions` + N+1 in `resolveFromLastPo` and rate
variance; `EST-L8` duplicate `VO-${co.number}` item codes;
`EST-L9` REJECTED bills inconsistently included in WO summaries;
`EST-L10` collision-prone `generateProposalCode()`;
`EST-L11` Excel header fill uses `bgColor` instead of `fgColor` (white-on-white);
`EST-L12` octet-stream Excel fed to LLM as UTF-8; `EST-L13` silent
insufficient-stock skips in `issueStockForDailyReport`;
`EST-L14` non-transactional `deleteRateRegion`; `EST-L15` project material-rate
upsert lacks type check + non-transactional; `EST-L16` bulk generation creates
one requisition per line (approval spam).

---

## 3. Accounting, Finance, GST/TDS, Tally & Project Ops (`FIN`)

### Critical

- **FIN-C1 — Razorpay legacy webhook accepts unsigned payloads → forge payments.**
  `apps/backend/src/controllers/payment.controller.ts:34-47`. (Same defect as
  `SEC-C1`; confirmed independently.) *Fix:* verify signature before
  `handlePaymentCaptured`.
- **FIN-C2 — `handlePaymentCaptured` trusts client amount, defaults to full total, no tenant scope.**
  `apps/backend/src/services/payment.service.ts:125-165`. Invoice looked up by
  `id` only; captured amount defaults to `invoice.total * 100`; no idempotency
  beyond a `status==='PAID'` short-circuit. *Fix:* scope by verified `companyId`,
  require an explicit captured amount, dedupe on the Razorpay payment id.

### High

- **FIN-H1 — `invoiceNumber` is globally unique but generated per-company.**
  `schema.prisma:945` (`@unique`) vs `id-generator.ts:55-62`. Cross-tenant
  collisions (P2002) + count-race duplicates. *Fix:* `@@unique([companyId, invoiceNumber])`
  + atomic sequence. (Same as `DAT-1.2`.)
- **FIN-H2 — Invoice `recordPayment`: no overpayment guard, no status guard, not transactional.**
  `apps/backend/src/services/invoice.service.ts:366-399`. Contrast with
  `recordBillPayment`, which does it correctly. *Fix:* reject `DRAFT`, clamp
  `newPaid <= total`, wrap update + journal in `$transaction`.
- **FIN-H3 — Editing an invoice silently flips CGST/SGST → IGST and drops retention.**
  `apps/backend/src/services/invoice.service.ts:281-354`. `clientState` isn't
  persisted/defaulted, `total` ignores retention on update, RA/certified fields
  aren't recomputed. *Fix:* persist and default `clientState`; re-apply retention;
  recompute RA fields.
- **FIN-H4 — `createInvoice` multi-step write not transactional; RA sequence/retention race + base mismatch.**
  `apps/backend/src/services/invoice.service.ts:197-278`. *Fix:* wrap read-then-create
  in a `$transaction` with a lock; compute retention on the current certified
  delta.
- **FIN-H5 — Tally sales voucher does not balance with retention; bills always booked as IGST.**
  `apps/backend/src/services/tally.service.ts:41-113,116-170`. *Fix:* emit a
  retention ledger entry (or use pre-retention total for the party line); split
  bill GST into CGST/SGST vs IGST by vendor state.
- **FIN-H6 — CPM Finish-to-Finish forward-pass formula is wrong.**
  `apps/backend/src/services/cpm.service.ts:105-108` (spurious `+ pDur` / `- pDur`).
  Correct: `es = Math.max(es, pEF + p.lagDays - dur)`. Wrong float/critical path
  for any FF dependency. *Fix:* correct the formula.
- **FIN-H7 — CPM silently "breaks" cycles; task creation has no cycle/tenant validation.**
  `apps/backend/src/services/cpm.service.ts:62-66`, `task.service.ts:94-103`. *Fix:*
  detect residual cycles and throw; validate each `predecessorId` is a task in the
  same project; reject cycle-creating edges.
- **FIN-H8 — Company dashboard aggregates include soft-deleted projects.**
  `apps/backend/src/services/financial-report.service.ts:292-303`. *Fix:* add
  `isDeleted: false` (and likely `isTemporary: false`).

### Medium

- **FIN-M1 — Pervasive float money math (Decimal → Number + `round2`).**
  `gst.service.ts:29-55`, `invoice.service.ts:177-226`, `bill.service.ts:179-224`,
  financial-report/analytics. Penny drift between Σ line items and totals. *Fix:*
  arithmetic in `Decimal`/paise; round only at persistence.
- **FIN-M2 — GST/TDS reports pass string dates to a `@db.Date` filter and are unbounded.**
  `financial-report.service.ts:379-388,446-455` + controller `33-42`. *Fix:*
  coerce to `Date`, validate the range, paginate.
- **FIN-M3 — Tally/report date formatting uses server-local timezone (IST vs UTC).**
  `tally.service.ts:26-32` + many `toISOString().slice(0,10)`. Off-by-one day /
  wrong month in GST reports. *Fix:* format in a fixed IST zone or use date-only
  UTC accessors consistently.
- **FIN-M4 — `getEstimateVsActual` dominant-type logic is a dead comma-expression + fragile mapping.**
  `financial-report.service.ts:219-234`. *Fix:* remove dead expression; map
  estimate sections to bill categories explicitly.
- **FIN-M5 — `loadProjectSummary` "planned progress" formula is nonsensical.**
  `project.service.ts:257-260` (can exceed 100). *Fix:* duration-weighted
  `Σ(dur*progress)/Σ(dur)`.
- **FIN-M6 — `daily-report.createReport` uniqueness + progress updates outside transaction.**
  `daily-report.service.ts:126-192`. *Fix:* normalize `reportDate` to date-only
  (+ DB unique constraint) and move side-effects into the transaction.
- **FIN-M7 — Chatbot history/context leaks across users and skips project membership.**
  `chatbot.service.ts:164-169,37-61` (history by `companyId` not `senderId`).
  *Fix:* scope history by `senderId`; enforce project membership in `buildContext`.
- **FIN-M8 — Financial endpoints have no role restriction.**
  `financial-report.routes.ts:22-25`. Any user (incl. SUPERVISOR) can read
  project financials / export Tally. *Fix:* add `requireRole(OWNER, PM, ACCOUNTANT)`.
- **FIN-M9 — Analytics cash baseline uses only last-6-months invoices; arbitrary estimate chosen.**
  `analytics.service.ts:99-102,252,96,301-306` (`take:1` with no `orderBy`). *Fix:*
  all-time paid flows for cash; order estimates by version/`approvedAt`.
- **FIN-M10 — SaaS webhooks: no idempotency, Stripe `payment_status` not checked, trial fields overloaded.**
  `saas-billing.service.ts:159-233`, `subscription.service.ts:47-49`. *Fix:* dedupe
  on payment ref/event id, check `payment_status`, track renewal in a dedicated
  field.
- **FIN-M11 — `getBillSummary` counts REJECTED bills in spend totals.**
  `bill.service.ts:362-399`. *Fix:* exclude REJECTED (decide PENDING treatment).
- **FIN-M12 — `report-schedule` ignores `cronExpr` and doesn't scope recipients by company.**
  `report-schedule.service.ts:35-73`. *Fix:* honor `cronExpr`; constrain recipients
  to `s.companyId`.

### Low

`FIN-L1` no-op `assignedTo: { not: undefined }` over-notifies
(`notification.service.ts:110-116`); `FIN-L2` no state-machine on `sendInvoice`,
no `CANCELLED`/`APPROVED` `InvoiceStatus` (`schema.prisma:96-101`);
`FIN-L3` unbounded in-memory `exportCompanyData` (`settings.service.ts:259-287`);
`FIN-L4` subcontract advance-recovery capped at arbitrary `gross*0.1` + TDS base
(`subcontract.service.ts:150-156`); `FIN-L5` subcontract/manual bills never split
CGST/SGST; `FIN-L6` `listAttendance` local-time day window off-by-one
(`attendance.service.ts:112-116`); `FIN-L7` Stripe SaaS charges add no GST;
`FIN-L8` `PLAN_ANNUAL_INR` omits ENTERPRISE (`pricing.ts:12-15`).
Also `gst.service.ts` `amountInWords` breaks for values ≥ 100 crore
(`twoDigits(crore)` can't render 3-digit groups).

### Confirmed-correct (no action)

`recordBillPayment`/`payBill` (`bill.service.ts:273-347`) correctly guard status,
block overpayment, and wrap update + journal in `$transaction` — this is the
pattern the invoice path (`FIN-H2`) should copy. Company Razorpay and SaaS
webhooks do verify signatures; only the legacy `/webhooks/razorpay` path is
unprotected. `bill_snapshot` capture is reasonable (but stores `Number(...)` of
Decimals and the manual `createBill` snapshot relies on input fields not present
in `createBillSchema`).

---

## 4. Mobile / Web App (`MOB`)

### Critical

- **MOB-C1 — Queued requests hang forever when token refresh throws.**
  `apps/mobile/lib/api-client.ts:88-92` (and `183-187`). `processQueue` runs only
  on success; a network blip during refresh leaves every queued promise unsettled.
  *Fix:* call `processQueue(null)` in both catch blocks before logout.
- **MOB-C2 — Any failed retry after a successful refresh force-logs-out.**
  `apps/mobile/lib/api-client.ts:79-92`. The post-refresh retry throws inside the
  same try whose catch treats every exception as a refresh failure (403/422/500 or
  non-JSON body → wrong "Session expired" + logout). *Fix:* move the retry outside
  the try/catch, rethrow non-401 `ApiError`s.

### High

- **MOB-H3 — `apiFetchList` never refreshes on 401.**
  `apps/mobile/lib/api-client.ts:119-150`. All list queries die on token expiry
  (×3 with `retry: 2`). *Fix:* route through the shared refresh/queue logic.
- **MOB-H4 — Rotated refresh tokens are dropped.**
  `apps/mobile/lib/api-client.ts:285-298` (persists only `accessToken`). *Fix:*
  persist `refreshToken` when present.
- **MOB-H5 — Opening the app offline destroys the session.**
  `apps/mobile/stores/auth.store.ts:106-123`. `/auth/me` throwing `NETWORK_ERROR`
  deletes all tokens. *Fix:* on status 0, keep cached user/tokens and proceed
  degraded.
- **MOB-H6 — Tokens in `localStorage` on web.**
  `apps/mobile/shims/expo-secure-store.js`. The long-lived refresh token is
  readable by any XSS. *Fix:* httpOnly cookie for the refresh token on web.
- **MOB-H7 — `setNetworkStatus` is never called → the entire offline pipeline is dead.**
  `apps/mobile/stores/app.store.ts`. `OfflineBanner` never shows; the proactive
  offline branch in `useCreateReport` (`report.queries.ts:123-148`) never runs;
  queued reports replay only on next app launch. `@react-native-community/netinfo`
  isn't in `package.json`. *Fix:* wire NetInfo (native) / online-offline events
  (web) to `setNetworkStatus`.
- **MOB-H8 — Sign PO/indent invalidates the wrong query key.**
  `apps/mobile/services/procurement.queries.ts:25,36` invalidate
  `['projects', projectId, 'procurement']` but requisitions live under
  `['procurement', 'requisitions', projectId]`. Signature block never updates.
  *Fix:* invalidate `expansionKeys.requisitions(projectId)`.
- **MOB-H9 — GST/TDS report date filters silently ignored.**
  `apps/mobile/services/accounting.queries.ts:357-403`. `from`/`to` are in the
  query key but the fetch URL is fixed. *Fix:* append `?from=&to=`.
- **MOB-H10 — Composite BOQ explode silently fails when RA detail is already cached.**
  `apps/mobile/components/projects/IndentDraftLineCard.tsx:288`. Effect deps are
  only `[raDetailQ.data]`; picking the same composite twice never re-runs.
  *Fix:* add `pendingExplodeBoqId` to deps.
- **MOB-H11 — Lines without a catalog resource are silently dropped from the indent.**
  `apps/mobile/components/projects/ProcurementTab.tsx:289-303`. UI counts
  BOQ-only lines but the payload filters them out (user sees "3 items", saves 2);
  the `missingMaterial` check is dead. *Fix:* include BOQ-only lines or block save
  with an explicit error.
- **MOB-H12 — `expo-document-picker: ^57.0.1` is an impossible version for this SDK line.**
  `apps/mobile/package.json`. Breaks `expo install --check` / EAS builds. *Fix:*
  align to the SDK's validated version.

### Medium

`MOB-M1` in-memory `accessToken` in auth store goes stale after refresh;
`MOB-M2` payments don't invalidate `['financials', …]` (P&L/cashflow/GST/TDS
stay stale for 5 min); `MOB-M3` creating an indent leaves shortfalls/stock stale
(`expansion.queries.ts:439-451`); `MOB-M4` measurement submit doesn't refresh WO
summary (`expansion.queries.ts:686`); `MOB-M5` `useBoq` `?_t=Date.now()`
cache-buster disables HTTP caching (`boq.queries.ts:84`); `MOB-M6`
`invalidateProjectCore` nukes the whole `['projects']` prefix
(`lib/project-query-invalidation.ts:6-10`); `MOB-M7` materials beyond first 100 /
analyses beyond 50 unselectable (`IndentDraftLineCard.tsx:164,173`); `MOB-M8`
wrong unit `'unit'` persisted for materials past the loaded page
(`ProcurementTab.tsx:312-316`); `MOB-M9` debug `console.log`s in
`EstimateBuildStep.tsx:49,225,234`; `MOB-M10` unhandled promise rejections on
inline mutations (`EstimateBuildStep.tsx:333,681,553`); `MOB-M11` template apply
is an N+1 mutation storm (`EstimateBuildStep.tsx:230-251`); `MOB-M12` template
link resolution silently misses beyond the loaded page; `MOB-M13` template data
errors — mismatched RA links in the uncommitted `estimate-templates-legacy.ts`
(PCC 1:4:8→M15, BC 25mm→BC 40mm, Gypsum 100mm→75mm); `MOB-M14` material-prices
trend/sparkline permanently dead (`material-prices.tsx:416`); `MOB-M15` category
"Other" and `gstRate` never saved (`material-prices.tsx:193,585`); `MOB-M16`
`Select` "No matches" state unreachable (`Select.tsx:104-125,218`); `MOB-M17` no
list virtualization for large BOQs (`BoqTab.tsx` map inside outer ScrollView);
`MOB-M18` `Alert.alert` used for errors on web (`BoqTab.tsx:103`);
`MOB-M19` SDK mismatch (expo ~51 vs SDK 52 brief; router ~3.5.14);
`MOB-M20` missing `@react-native-community/netinfo` dependency.

### Low

`MOB-L1` platform admin client has no expiry handling + leaky logout
(`platform.store.ts`); `MOB-L2` `Tabs key={user.role}` remounts the navigator
(`app/(app)/_layout.tsx:90`); `MOB-L3` tab-sync effect fights the URL
(`projects/[id].tsx:67-75`); `MOB-L4` hardcoded `https://app.buildflow.in`
fallback (`projects/[id].tsx:604`); `MOB-L5` unnormalized route param
(`estimation/[id].tsx:189`); `MOB-L6` dead `'pos'` sub-tab
(`ProcurementTab.tsx:94,119`); `MOB-L7` manual component-qty edits overwritten
(`IndentDraftLineCard.tsx:291-303`); `MOB-L8` both export buttons share one
loading state (`estimation/[id].tsx:498,511`); `MOB-L9` per-row `useMaterials`
duplicate cache entries (`estimation/[id].tsx:120`); `MOB-L10` estimate rename
doesn't refresh project list (`estimate.queries.ts:581-585`); `MOB-L11`
`refetchType: 'active'` leaves stale RA detail (`estimate.queries.ts:724,735`);
`MOB-L12` fake progress bar on project cards (`projects/index.tsx:194`);
`MOB-L13` screens bypass the granular permission system with hardcoded roles;
`MOB-L14` `daysBetween` off-by-one (`utils/format.ts:35-38`).

---

## 5. Responsive / Cross-Device UI (`UI`)

Overall strategy: adaptivity lives in one hook (`useViewport`) with a single
768px threshold, and every "bigger than phone" flag is AND-ed with
`Platform.OS === 'web'`. Two structural consequences: **native iPads are treated
as phones**, and **web at 768–1100px is treated as full desktop**.

### Critical

- **UI-C1 — Native tablets (iPad/Android tablet) always get the phone layout.**
  `apps/mobile/hooks/useViewport.ts:9-21`. Every adaptive flag requires `isWeb`.
  *Fix:* base `isTablet`/`isDesktop` on width (plus pointer type), not
  `Platform.OS`.
- **UI-C2 — Entire estimation flow has no desktop layout (full-width stretch).**
  `apps/mobile/app/(app)/estimation/[id].tsx:310`,
  `components/estimation/EstimateBuildStep.tsx:271-274`. Core money screens stretch
  edge-to-edge on wide browsers. *Fix:* wrap in `ScreenContainer` + `PageHeader`
  with max-width.

### High

- **UI-H3 — Fixed-width master-detail panes break at 768–1100px web widths.**
  `settings/material-prices.tsx:327-333`, `settings/users.tsx:123,172`,
  `accounting/invoice/[id].tsx:283`, `bill/[id].tsx:205`, `create-bill.tsx:285-289`.
  *Fix:* raise the desktop threshold to ~1024px and stack panes on narrow content.
- **UI-H4 — `ActionBar` stacks up to 7 full-width buttons on phones.**
  `components/layout/ActionBar.tsx:21`, `estimation/[id].tsx:446-520`. *Fix:*
  primary action + overflow "More" menu on mobile.
- **UI-H5 — Horizontal scroll regions are unusable with a mouse (no scrollbar, no wheel).**
  `components/projects/ScheduleTab.tsx:315-318` (Gantt), `projects/[id].tsx:134-137`
  (11-tab bar). Tabs beyond the viewport are unreachable on desktop web. *Fix:*
  show scroll indicators on web / wrap tabs on desktop; responsive Gantt task
  column.
- **UI-H6 — Auth screens ignore the top safe area on phones.**
  `components/auth/AuthScreenShell.tsx:87-89` (`edges={['bottom']}`). *Fix:* add
  `'top'`.
- **UI-H7 — Fixed 480/640px auth panel squeezed from 768px up.**
  `components/auth/AuthScreenShell.tsx:38-50` (`shrink-0`). *Fix:* `max-w-*` with a
  flex basis; drop the hero below ~1024px.

### Medium

`UI-M8` `AdaptiveSheet` left-anchored on tablets (`AdaptiveSheet.tsx:90-94`);
`UI-M9` `Select` modal mixes `md:` classes with the JS `isDesktop` flag
(`Select.tsx:178-187`); `UI-M10` stale module-level `Dimensions.get` sizes the
photo grid (`reports/[id].tsx:25,182`); `UI-M11` no hover/focus affordances on
web (one `hover:` in the whole app); `UI-M12` sub-44px touch targets on dense
editors (`EstimateBuildStep.tsx:480-497`, `Button.tsx:45`); `UI-M13` pervasive
hardcoded 10–11px text with no scaling strategy; `UI-M14` BOQ/estimate line items
are card-stacks only — no tabular view on wide screens (`BoqTab.tsx:209-313`);
`UI-M15` `ResponsiveGridList` never virtualizes on desktop
(`ResponsiveGrid.tsx:133-147`).

### Low

`UI-L16` invalid `h-30`/`h-50` collapse dashboard skeletons
(`dashboard/index.tsx:92-98`); `UI-L17` inconsistent safe-area edges between
sibling screens; `UI-L18` inconsistent desktop max-width per screen
(`max-w-6xl` vs `max-w-7xl` vs none); `UI-L19` `Input` multiline uses a
nonexistent `text-top` class (`Input.tsx:62`); `UI-L20` `DateField`/`DateCalendar`
fixed 280–320px popovers not anchored on web.

### Top structural changes

1. Decouple form factor from platform — make `useViewport` width-driven.
2. Raise the desktop threshold to 1024px and add a true 768–1023 tablet tier.
3. Bring the estimation flow into `ScreenContainer` + `PageHeader`.
4. Make every `min-w-[N]` two-pane layout stack on narrow content width.
5. Add a desktop data-table primitive (cards on phones, aligned columns from
   `lg:` up) + visible horizontal scrollbars on web.
6. Web polish pass: `hover:`/`focus-visible:`, mobile `ActionBar` overflow, 12px
   type floor, 44px touch targets.

The foundation (sidebar shell, `ScreenContainer`, `AdaptiveSheet`,
`ResponsiveGrid`) is genuinely good; failures concentrate in the platform-gated
breakpoint hook, the untreated estimation flow, and fixed-width panes.

---

## 6. Database, Schema, Migrations, Seed, Tests & Tooling (`DAT`)

Verification: full read of `schema.prisma`, all 24 migrations, seed + data files;
`tsc --noEmit` clean (0 errors); `pnpm audit --prod` = 40 vulns; jest suite run
twice against the isolated `buildflow_test` DB = 12 failed / 75 passed both times.

### Critical

- **DAT-1.1 — Seed process never exits (open Redis handle) — hangs `db:seed`, `db:reset`, `migrate reset`, `test-backend.sh`.**
  `apps/backend/prisma/seed.ts:239-243` dynamically imports
  `src/utils/cache` → `src/lib/redis.ts:30`, creating an ioredis client that's
  never closed. The whole test pipeline is effectively broken. *Fix:* export and
  call `disconnectRedis()` in the seed's `finally` (or skip the cache flush when
  run as the seed).
- **DAT-1.2 — `Invoice.invoiceNumber` is globally unique across all tenants.**
  `schema.prisma:945`. (Same as `FIN-H1`.) *Fix:*
  `@@unique([companyId, invoiceNumber])` + migration.

### High

- **DAT-2.1 — Company deletion fails: `onDelete: Cascade` to users collides with 10+ `RESTRICT` FKs.**
  `schema.prisma:275` + init migration `627-774`. Company offboarding / GDPR
  delete cannot work at the DB level. *Fix:* decide a per-relation policy
  (`SetNull`/ordered app-level delete) and migrate.
- **DAT-2.2 — Test suite is red: 12/87 tests fail consistently, and suites are non-idempotent.**
  Failing: `procurement`, `daily-report`, `material-rate`,
  `material-rate-variance`, `estimate-links` (integration). Hard-coded seed-value
  assertions drifted (e.g. `material-rate.test.ts:51` expects 445, gets 500);
  `resource-catalog.test.ts` permanently mutates cement's rate (order-dependent).
  *Fix:* derive expectations from seed constants; mutating tests create their own
  fixtures.
- **DAT-2.3 — ~35 of 48 services have zero test coverage.**
  Untested: auth refresh/rotation, estimate, project, task/CPM, boq
  import/convert, proposal, portal/subcontract-portal token auth, platform,
  payment/saas-billing, invoice export, tally, twilio, chatbot, analytics,
  financial-report, export-zip, report-schedule, signature, permission. *Fix:*
  prioritize CPM, BOQ import/convert, portal token auth, permission checks.
- **DAT-2.4 — 40 dependency vulnerabilities (1 critical, 26 high).**
  Backend-reachable: `brace-expansion` (DoS, high), `uuid <11.1.1` (moderate),
  `body-parser <1.20.6` (low). Mobile expo/metro chain incl. critical `tar` DoS.
  Stale: Prisma 5.16 (v6 current), Express 4, Twilio v6, bcryptjs 2.x, uuid 9.
  *Fix:* upgrade + dedupe.
- **DAT-2.5 — `patch-template-links.cjs` writes literal `resourceName: 'null'`.**
  `scripts/patch-template-links.cjs:83-91,138,140`. Three-element entries are
  destructured as two; the RA-prefixed element is dropped. *Fix:* handle the third
  element or delete the one-shot script.

### Medium

- **DAT-3.1 — Seed TRUNCATEs every table unguarded.**
  `apps/backend/prisma/seed.ts:100-107`. `pnpm db:seed` against any `DATABASE_URL`
  wipes the DB with no confirmation; the "idempotent-ish" comment is false. *Fix:*
  guard with `NODE_ENV !== 'production'` / `SEED_ALLOW_TRUNCATE=1`.
- **DAT-3.2 — 25 duplicate catalog entries with conflicting HSN codes.**
  `apps/backend/prisma/catalog-data.ts` (e.g. `BC Mix Material` HSN 2715 vs 2713).
  *Fix:* dedupe + a uniqueness unit test on `name+type`.
- **DAT-3.3 — Eight one-off/misplaced files committed in `apps/backend/prisma/`.**
  Worst: `prisma/boq.service.ts` — a 514-line stale copy of the real service.
  Also `backfill-*.ts` (one converts MISC items into MATERIAL resources with
  `gstRate: 0`), `test-boq-ra.ts`, `query-multi-material-boq.ts`, `verify-sac.mts`.
  *Fix:* delete the stale copy; move keepers to `scripts/one-off/`.
- **DAT-3.4 — `apps/backend/src/__` is an orphaned extension-less test file (5 tests never run).**
  A complete "Resource bulk operations" integration test missing its `.ts`
  extension, so tsc/jest ignore it. *Fix:* rename to
  `src/__tests__/integration/resource-bulk.test.ts` and fix assertions.
- **DAT-3.5 — `.filestore/` committed to git and not gitignored.**
  `apps/backend/.filestore/**` (2 encrypted blobs, commit 77e9580) is the runtime
  upload dir. *Fix:* `git rm -r --cached apps/backend/.filestore` + add to
  `.gitignore`.
- **DAT-3.6 — Missing tenant column / composite indexes on hot paths.**
  `SubcontractWorkOrder` has no `companyId`; `MaterialRequisition` /
  `GoodsReceiptNote` carry `companyId` with no `Company` relation (no FK
  integrity); `StockMovement` has no index on `resourceId`/`referenceId`;
  `InvoiceLineItem.boqItemId` un-indexed; add composite `@@index([companyId, status])`
  to Invoice/Bill/Estimate. *Fix:* add relations + indexes in one migration.
- **DAT-3.7 — `attendances` allows unlimited concurrent open check-ins.**
  `schema.prisma:916-935`. Double check-ins double-count payroll. *Fix:* partial
  unique index `WHERE check_out_at IS NULL`.
- **DAT-3.8 — Test infra hazards.**
  `src/__tests__/setup.ts:8` `dotenv.config` doesn't `override`, so a shell
  `DATABASE_URL` could point tests at a real DB; `package.json:13`
  `jest --forceExit` papers over the never-closed handles (DAT-1.1);
  `db:test:reset` is byte-identical to `db:reset` (doesn't target the test DB);
  `turbo.json` `test` declares no env inputs (may serve cached green results).
  *Fix:* `override: true` + assert DB name ends in `_test`; add `globalTeardown`;
  fix `db:test:reset`; declare turbo test inputs.

### Low

`DAT-4.1` `audit_logs.oldValue` lacks `@map("old_value")`; `DAT-4.2` deprecated
`SUPERVISOR` enum value kept alongside `SITE_SUPERVISOR`; `DAT-4.3` `Role` enum
expansion migration hazard on PG≤11 (fine on pinned PG15); `DAT-4.4` polymorphic
`referenceId`/`entityId` without FKs; `DAT-4.5` unconstrained `progressPct` Int
(no 0–100 CHECK); `DAT-4.6` `daily_reports @@unique([projectId, reportDate])`
blocks two supervisors reporting the same day; `DAT-4.7` `UserInvite.invitedBy`
cascade deletes others' pending invites; `DAT-4.8` seed prints weak fixed
passwords; `DAT-4.9` `.npmrc prefer-frozen-lockfile=false` lets CI drift;
`DAT-4.10` deprecated `version: "3.9"` in `docker-compose.yml`; `DAT-4.11` stale
doc comments (seed "4 users", schema "24 models").

### Confirmed-correct (no action)

Money columns are correctly `Decimal` — the only `Float`s are geo coordinates and
metres (appropriate). `.env` is gitignored and was never committed; only
`.env.example` and `apps/backend/.env.test` (dummy secrets, localhost) are
tracked.

---

## Severity roll-up

| Domain | Critical | High | Medium | Low |
| ------ | -------- | ---- | ------ | --- |
| Security (SEC) | 2 | 7 | 6 | 7 |
| Estimation/Procurement (EST) | 3 | 9 | 16 | 16 |
| Accounting/Finance (FIN) | 2 | 8 | 12 | 8 |
| Mobile (MOB) | 2 | 10 | 20 | 14 |
| Responsive UI (UI) | 2 | 5 | 8 | 5 |
| Data/Schema/Tests (DAT) | 2 | 5 | 8 | 11 |

The payment-webhook flaw (SEC-C1/C2 = FIN-C1/C2) is counted once per domain but
is a single defect; fix it first.

---

# Remediation Review — Round 1 (GLM-5.2)

> Verification of the changes GLM-5.2 made (commit `66a40eb` "updates" plus
> uncommitted working-tree edits) against the register above. Baseline for the
> diff was the audit commit `3c47058`. Each original finding was re-checked in the
> current code; a companion set of **new regressions (NR-\*)** that GLM introduced
> is listed after the status tables. The Round-2 work order in
> [`GLM_FIX_PROMPT.md`](GLM_FIX_PROMPT.md) is driven by this review.

## Headline

- **Backend `tsc --noEmit` is clean; the test suite is green (91 passed / 1
  skipped, was 12 failed / 75 passed); the seed no longer hangs.** Real, verified
  progress.
- **The payment-webhook forgery is genuinely fixed end-to-end** (raw-body decode →
  per-company HMAC with `timingSafeEqual` → company-scoped lookup → required
  amount → idempotent, capped, guarded transaction). This was the top priority and
  it is closed.
- **But several fixes are cosmetic** — correct-looking code and confident
  `// FIX(...)` comments that do not take effect (UI-C1 written to a dead file,
  FIN-H3 `clientState ?? undefined` no-op, FIN-H5 reads a nonexistent field).
- **GLM introduced ~19 new issues**, including one **critical runtime regression**
  (audit logging broken by an unmigrated schema `@map`) and one **high** build
  breakage (lockfile not regenerated).

## Status legend

FIXED = verified correct · PARTIAL = fix present but incomplete or with a residual
bug · NOT-FIXED = unchanged from baseline · REGRESSED = change made things worse.

## Security (SEC) + payment

| ID | Status | Note |
| -- | ------ | ---- |
| SEC-C1 / FIN-C1 | FIXED | Legacy webhook returns 401; tenant payments via per-company HMAC path. |
| SEC-C2 | PARTIAL | Reads+writes now scoped for all `companyId` models, but `findFirstOrThrow`/`findUniqueOrThrow` (~28 sites) bypass the safety net. |
| FIN-C2 | FIXED | Company-scoped lookup, required amount, idempotent guarded `$transaction`. |
| SEC-H3, H4 | FIXED | `trust proxy` + `req.ip`; auth limiter fails closed. |
| SEC-H5, H6 | FIXED | MCP verifies access token/`sub`/type/blacklist + periodic re-validate; scoping middleware added. (See NR-15.) |
| SEC-H7 | FIXED | Platform webhook-secret fallback removed; per-company secret required. |
| SEC-H8 | FIXED | OWNER assignment + self-role-change rejected. (See NR-16.) |
| SEC-H9 | FIXED | `Buffer.toString('utf8')`. |
| SEC-M10, M11, M12, M13, M15 | FIXED | token-type, `originalUrl`, HMAC signature, portal `next(err)`, audit `companyId`. |
| SEC-M14 | FIXED | Atomic `documentCounter.upsert`. (See NR-17 backdated migration.) |
| FIN-M7 | FIXED | Chat history scoped by `senderId`; membership check in `buildContext`. |
| SEC-L18, L19 | FIXED | `env` dropped from health; permission lookup fails closed. |
| SEC-L16, L17, L20, L21, L22 | NOT-FIXED | JWT strength, raw error msg, body-limit msg, drive base64, global compression. |

## Estimation / Procurement (EST)

| ID | Status | Note |
| -- | ------ | ---- |
| EST-C1 | PARTIAL | Summary/list/persisted totals + BOQ conversion filter `parentId:null`, but **section subtotals** (and Excel/PDF export) and **material-demand generation** still use all items → still double-count. |
| EST-C2 | PARTIAL | Archive-before-null ordering fixed; **budget delta math wrong** (subtotal basis vs grandTotal basis) — see NR (EST budget). |
| EST-C3 | NOT-FIXED | `convertEstimateToBoq` still has no `$transaction`. |
| EST-H1 | PARTIAL | `previewBoqShortfalls` fixed; `createDraftIndentsFromDemand` (the path that actually creates indents) still double-deducts stock. |
| EST-H2 | PARTIAL | `companyId` + `type` added, but new token-OR match over-matches stopwords (NR-7). |
| EST-H3 | FIXED | PO must be APPROVED; over-receive capped (residual TOCTOU, NR). |
| EST-H4 | NOT-FIXED | GRN qty still credited entirely to the first matching req line. |
| EST-H5 | FIXED | Guarded `updateMany` inside the transaction. |
| EST-H6 | NOT-FIXED | Still no endpoint to set line `qtyDelta`; lines stay 0. |
| EST-H7 | PARTIAL | `updateResource` writes history; `bulkUpsertResources` still doesn't. |
| EST-H8 | FIXED | delete+create+total wrapped in `$transaction`. |
| EST-H9 | FIXED | Correct section-scoped route (one test `it.skip`-ed, coverage reduced). |
| EST-M2, M4, M10 | FIXED | approve guard; `sectionId` validation; `startsWith('SUBCONTRACTOR')`. |
| EST-M1, M3, M5, M11, M12 | PARTIAL | see per-item notes; M3 still flattens sub-items (NR-8); M12 now swallows errors (NR-9); M15 relabels units without converting (NR-6). |
| EST-M6, M7, M8, M9, M13, M14, M15, M16 | NOT-FIXED | PO validation, proposal status, export RA links, tender match, route guards, negative-qty/CPM, unit conversion, GST base. |

## Accounting / Finance (FIN)

| ID | Status | Note |
| -- | ------ | ---- |
| FIN-H1 | FIXED | Tenant-scoped `invoiceNumber` + migration + atomic counter. |
| FIN-H2 | PARTIAL | DRAFT/overpay guards + `$transaction`, but read/compute outside txn (TOCTOU, NR-11); OVERDUE→SENT regression. |
| FIN-H3 | PARTIAL | RA recompute done; **CGST/SGST→IGST flip NOT fixed** (`clientState ?? undefined` no-op, no `clientState` column). Plus NR-5 (retention zeroed on non-RA). |
| FIN-H4 | PARTIAL | Wrapped in `$transaction`, retention on current delta — but **no real lock**; RA sequence race remains; `nextSequentialNumber` on global client inside txn (NR-12). |
| FIN-H5 | PARTIAL/REGRESSED | Retention balancing NOT done; bill split reads nonexistent `bill.vendorState` → every bill now CGST/SGST (NR-4). |
| FIN-H6 | FIXED | FF forward pass corrected; forward/backward passes consistent. |
| FIN-H7 | PARTIAL | `topoSort` throws on cycles, but `task.service` still doesn't validate predecessors/cycles → 500 on Gantt (NR-19). |
| FIN-H8 | NOT-FIXED | Dashboard still counts soft-deleted projects. |
| FIN-M2, M4, M9 | PARTIAL | date coercion (no validation/pagination); dead expr removed (mapping not done); ordered estimate fixed (cash baseline not). |
| FIN-M8 | FIXED | `requireRole` on project financial routes. |
| FIN-M1, M3, M5, M6, M10, M11, M12 | NOT-FIXED | Decimal money, IST timezone, planned-progress, daily-report txn, SaaS idempotency, REJECTED bills, report-schedule. |
| FIN-L* | NOT-FIXED | incl. `amountInWords` still wrong ≥ 1,000 crore (NR-14). |

## Mobile + Responsive UI (MOB / UI)

| ID | Status | Note |
| -- | ------ | ---- |
| MOB-C1 | FIXED | Queue flushed on refresh failure. |
| MOB-C2 | PARTIAL | Non-401 rethrown, but retry still in try/catch and `retryRes.json()` unguarded → non-JSON/network retry still wrong-logout. |
| MOB-H3 | PARTIAL | Refreshes, but bypasses the shared mutex/queue (NR-10). |
| MOB-H4, H5, H8, H9, H10 | FIXED | rotated token persisted; offline hydrate; correct invalidation key; GST/TDS params; explode deps. |
| MOB-H6 | NOT-FIXED | Web tokens still in `localStorage`. |
| MOB-H7 | PARTIAL | Wiring correct, but lockfile not regenerated + shim unwired → inert / native build breaks (NR-3). |
| MOB-H11 | PARTIAL/REGRESSED | BOQ-only lines no longer silently dropped, but now fail the whole save at the zod validator (NR-13). |
| MOB-H12 | FIXED (pending install) | `expo-document-picker ~12.0.2` in package.json, not yet in lockfile. |
| MOB-M13, L14 | FIXED | template RA links corrected; `daysBetween` normalized. |
| MOB-M19 | NOT-FIXED | Expo SDK/router still on 51 line. |
| UI-C1 | REGRESSED | Fix written to dead file `apps/mobile/hooks/use`; real hook unchanged (NR-2). |
| UI-C2 | FIXED | Estimation screens get a constrained `max-w-6xl w-full self-center` (blocked on UI-C1 for native). |
| UI-H3 | PARTIAL | Fixed min-widths removed; no tablet-tier stacking (depends on UI-C1). |
| UI-H6 | NOT-FIXED | Auth still `edges={['bottom']}`. |
| UI-H7 | FIXED (bonus) | Hero panel gated to wide desktop. |
| UI-L16 | FIXED | `h-30`/`h-50` → valid classes. |

## Data / Schema / Tests (DAT)

| ID | Status | Note |
| -- | ------ | ---- |
| DAT-1.1 | FIXED | `disconnectRedis()` in seed `finally`; pipeline exits. |
| DAT-1.2 / FIN-H1 | FIXED | Composite unique + migration + `document_counters` table. |
| DAT-2.2 | FIXED | 19/19 suites green (but audit-log errors swallowed — NR-1). |
| DAT-2.5 | FIXED | Template patch script writes `rateAnalysisName` correctly. |
| DAT-3.1 | FIXED | TRUNCATE guarded by env + `SEED_ALLOW_TRUNCATE`. |
| DAT-3.4 | FIXED | `src/__` renamed to `resource-bulk.test.ts` (runs). |
| DAT-3.5 | FIXED | `.filestore` untracked + gitignored. |
| DAT-3.7 | FIXED | Partial unique index for open check-ins (migration). |
| DAT-3.6 | PARTIAL | Indexes added; `SubcontractWorkOrder.companyId` + MR/GRN `Company` relation still missing. |
| DAT-3.3 | PARTIAL | Stale `prisma/boq.service.ts` deleted; other one-off scripts remain. |
| DAT-3.8 | PARTIAL | `override:true` + `_test` guard + globalTeardown; `--forceExit`, fake `db:test:reset`, turbo inputs remain. |
| DAT-2.1 | NOT-FIXED | Company cascade vs RESTRICT FKs unchanged. |
| DAT-2.4 | NOT-FIXED | Still 40 vulns. |
| DAT-4.1 | REGRESSED | `@map("old_value")` with no migration → audit logging broken (NR-1). |
| DAT-4.2, 4.5, 4.8, 4.9 | NOT-FIXED | (4.5 falsely annotated as CHECK-enforced — NR-18.) |
| DAT-4.10 | FIXED | compose `version` removed. |

---

## New Regressions Introduced by GLM-5.2 (NR-\*)

Ordered by severity. These did not exist at baseline `3c47058`.

### Critical
- **NR-1 — Audit logging is broken at runtime (schema drift).** The uncommitted
  `oldValue Json? @map("old_value")` on `AuditLog` (`schema.prisma:~1147`) has **no
  migration**; the DB column is still `"oldValue"`. The regenerated client queries
  a nonexistent column, so every `recordAudit` throws — masked only because the
  error is swallowed. Fix: add an `ALTER TABLE audit_logs RENAME COLUMN "oldValue"
  TO old_value` migration, or revert the `@map`.

### High
- **NR-2 — UI-C1 fix is dead code.** The corrected width-driven `useViewport` was
  written to `apps/mobile/hooks/use` (extensionless, committed, imported by
  nothing); `apps/mobile/hooks/useViewport.ts` is unchanged and still
  platform-gated. iPads still get the phone layout. Fix: move the content into
  `useViewport.ts` and delete `hooks/use`.
- **NR-3 — `pnpm-lock.yaml` not regenerated.** It still resolves
  `expo-document-picker@57.0.1` and has no `@react-native-community/netinfo`
  entry. `pnpm install --frozen-lockfile` (CI/EAS) fails, and the native NetInfo
  `require` in `app/_layout.tsx` can't resolve → MOB-H7 inert, native bundle
  breaks. The web NetInfo shim `shims/react-native-netinfo.ts` is also never
  registered in `metro.config.js`. Fix: run `pnpm install`, commit the lockfile,
  register or delete the shim.
- **NR-4 — Tally bill GST split reads a nonexistent field.** `tally.service.ts`
  branches on `bill.vendorState`, absent from the `Bill` model and the query, so
  it is always `undefined` → **every** bill is now booked CGST/SGST regardless of
  vendor state (newly wrong for inter-state vendors). Fix: add `vendorState` to
  `Bill` (+ migration) and select it, or derive state from `vendorGstin`.
- **NR-5 — `updateInvoice` zeroes retention on non-RA invoices.** The update path
  recomputes retention only for `RUNNING_ACCOUNT`; editing any STANDARD invoice
  that had retention writes `retentionAmount: 0` and inflates `total`. Fix: apply
  retention on update for all invoice types, matching `createInvoice`.

### Medium
- **NR-6 — Unit "canonicalization" without conversion (EST-M15).**
  `resolveCanonicalUnit` relabels a demand line's unit to the resource's unit
  without converting the quantity (5 MT → "5 kg"). Regression vs baseline, which
  carried the true unit. Fix: convert quantity or reject mismatched units.
- **NR-7 — Description safety-net over-matches (EST-H2).** The new `OR` over every
  ≥3-char word (including "and"/"for"/"the") with `findFirst` and no ordering can
  auto-link the wrong material into procurement indents. Fix: token-score and
  require a strong match, or drop stopwords and rank.
- **NR-8 — `duplicateEstimate` double-count resurrected.** Item-level `parentId`
  is still not copied (EST-M3), so children become top-level in the copy and the
  new `parentId:null` summary filter double-counts the duplicate. Fix: copy
  `parentId` relationships in the duplicate.
- **NR-9 — `postApprovedMeasurementToBoq` failures now swallowed (EST-M12).**
  Wrapped in `.catch(console.error)` with no reconciliation → BOQ `executedQty`
  can silently drift from approved measurements. Fix: move inside the approval
  transaction or add a reconciliation/retry.
- **NR-10 — `apiFetchList` refresh bypasses the shared mutex.** Concurrent list
  queries at token expiry fire parallel `/auth/refresh`; with rotation now
  persisted (MOB-H4), the losing call submits a consumed token and can invalidate
  the session. Fix: route through the shared `isRefreshing`/`failedQueue`.
- **NR-11 — `recordPayment` overpay guard is TOCTOU.** The invoice read and
  `newPaid` computation are outside the `$transaction`; concurrent payments both
  pass and the absolute `paidAmount` write loses one. Also OVERDUE→SENT on partial
  payment. Fix: read inside the transaction and use a relative increment with a
  guarded update.
- **NR-12 — FIN-H4 lock is illusory + numbering inside txn.** ReadCommitted with
  no `@@unique([projectId, raSequence])` still races; `nextSequentialNumber` (global
  client) is called inside the `$transaction`, so a rollback leaves numbering gaps
  and it consumes a second pooled connection. Fix: add the unique constraint (or
  `Serializable`/`FOR UPDATE`) and use the tx-bound counter variant.
- **NR-13 — MOB-H11 now fails the whole save.** A draft with a BOQ-only line
  (blank `resourceId`) is rejected wholesale by `requisitionLineSchema`
  (`resourceId: z.string().uuid()`); previously 2 of 3 saved, now 0 of 3. Fix:
  extend the backend to accept resource-less BOQ lines, or block just that line
  with a clear message.

### Low
- **NR-14 — `amountInWords` arab/kharab powers off by 10×** (`gst.service.ts`):
  uses `1e10`/`1e12` instead of `1e9`/`1e11`; wrong words for values ≥ ₹1,000
  crore.
- **NR-15 — MCP scoping list includes models without `companyId`**
  (`RegionalMaterialRate`, `ProjectMaterialRate`, `Notification`, `ProjectMember`,
  `StockBalance`, `StockMovement`) → latent `PrismaClientValidationError` for any
  future tool touching them.
- **NR-16 — Role normalization inverted:** maps `SITE_SUPERVISOR` → deprecated
  `SUPERVISOR` (opposite of the comment and of DAT-4.2's intent).
- **NR-17 — Backdated migration timestamps:** the two new migrations are dated
  `20260711…`/`20260712…`, sorting before applied `20260720…` migrations (and
  colliding with an existing `20260712000000_boq_sections` prefix) →
  `prisma migrate dev` history divergence on existing DBs.
- **NR-18 — False/misleading fix comments:** `schema.prisma` claims `progressPct`
  is "0–100 enforced via DB CHECK" (no such constraint exists); several
  `// FIX(...)` comments describe fixes the code doesn't perform (FIN-H3,
  mislabeled FIN-M3/FIN-L5). These actively mislead future audits.
- **NR-19 — Assorted:** dead exports (`nextSequentialNumberTx`); GRN over-receive
  TOCTOU; `topoSort` throws a plain `Error` → 500 on the Gantt endpoint while task
  cycle creation is still allowed; `it.skip` disabled a link-integrity test
  (coverage reduced); redundant ternaries and swallowed-semicolon comments
  (cosmetic).

## Revised priorities for Round 2

1. **Regressions first:** NR-1 (audit-log migration) and NR-3 (lockfile) are
   shipping-blockers; NR-2, NR-4, NR-5 are user-visible correctness/UX breaks.
2. **Finish the partials that matter for money/quantities:** EST-C1 (section
   subtotals + material demand), EST-C2 budget math, EST-C3 transaction, EST-H1
   indent path, FIN-H3 (real `clientState`), FIN-H4 lock.
3. **Then the untouched highs:** EST-H4, EST-H6, FIN-H7 (task side), FIN-H8,
   FIN-M1 (Decimal money).
4. **Process discipline** to stop the recurring failure modes — see the Round-2
   section of [`GLM_FIX_PROMPT.md`](GLM_FIX_PROMPT.md).

---

# Remediation Review — Round 2 (GLM-5.2, second pass)

> Re-verification of GLM's **second** fix pass (all changes **uncommitted** in the
> working tree; last commit remains `66a40eb`). Compared against the Round-1
> review above and the original register. Backend tests were run locally;
> `tsc --noEmit` was run on `apps/backend`.

## Headline

- **Major progress on Round-1 regressions and partials.** NR-1 (audit-log
  migration), NR-2/UI-C1 (width-driven `useViewport`), NR-5 (retention on
  invoice update), NR-13 (optional `resourceId` on requisition lines), FIN-H3
  (`clientState` column + persistence), FIN-H4 (RA sequence unique index),
  EST-C2/C3 (transactional BOQ conversion + budget delta), EST-H1/H4/H7,
  FIN-H2/H7/H8, and several UI items are **verified fixed** in the current code.
- **EST/FIN caveats:** EST-H6 endpoint exists but **always 404s** (R2-1);
  EST-C1 material-demand path still double-counts sub-items; FIN-H5 Tally retention
  balancing still open despite NR-4 bill-GST fix.
- **The backend does not compile.** GLM added Phase 5 features (RFIs,
  submittals, drawings, sync, petty cash, etc.) with **~16 TypeScript errors**
  — broken route validation, invalid `AuditAction` enum values, and
  `sync.service.ts` querying `updatedAt` on models that have no such column.
  **The app cannot ship until these are fixed.**
- **Petty cash table will never be created.** The migration SQL was written to
  the stray file `apps/backend/prisma/m` instead of
  `migrations/<timestamp>/migration.sql` — the same anti-pattern as Round-1's
  dead `hooks/use` file, despite explicit Round-2 rules against it.
- **Tests: 90 passed, 1 failed, 1 skipped** on fresh run (18/19 suites); **non-idempotent**
  — consecutive run can hit 2 failures (`daily-report.test.ts` 409). `tsc` was clean
  after Round 1; now **16 errors** in Phase 5 files.
- **Cross-device UI:** the viewport hook fix is real (native iPad ≥1024 gets
  sidebar). Tablet tier (768–1023) uses bottom tabs + 2-column grids but no
  dedicated tablet nav or master-detail stacking — usable but not fully polished.
- **Lockfile:** `pnpm install --frozen-lockfile` **FAILS** — manifest bumped Expo
  SDK 51→52 / RN 0.74→0.76 in `package.json` but lockfile still pins SDK 51 (NR-24).

## Round-1 regression status (NR-1 … NR-19)

| ID | Round-1 status | Round-2 status | Evidence |
| -- | -------------- | -------------- | -------- |
| NR-1 | REGRESSED | **FIXED** | Migration `20260730120000_rename_audit_log_oldvalue_to_old_value` renames `"oldValue"` → `old_value`. |
| NR-2 / UI-C1 | REGRESSED | **FIXED** | `hooks/use` deleted; `useViewport.ts` is width-driven (`isDesktop >= 1024`). |
| NR-3 | High | **PARTIAL** | NetInfo shim wired (`metro.config.js`, `app/_layout.tsx`); lockfile contains `@react-native-community/netinfo`. **But NR-24:** `--frozen-lockfile` fails — SDK 52 manifest vs SDK 51 lockfile. |
| NR-4 | High | **FIXED** | `tally.service.ts` derives vendor state from `vendorGstin` via `stateFromGstin()` — no phantom `vendorState` field. |
| NR-5 | High | **FIXED** | `invoice.service.ts:401-411` recomputes retention for all invoice types on update. |
| NR-6 | Medium | **PARTIAL** | Stopwords dropped in description match (`material-demand.service.ts`); unit relabel-vs-convert needs re-check. |
| NR-7 | Medium | **PARTIAL** | Stronger token matching added; verify no false positives in production data. |
| NR-8 | Medium | **FIXED** | `duplicateEstimate` preserves item `parentId` and maps IDs (`estimate.service.ts:922-972`). |
| NR-9 | Medium | **PARTIAL** | Needs re-check of `subcontract.service.ts` — may still swallow posting errors. |
| NR-10 | Medium | **FIXED** | `apiFetchList` uses shared `isRefreshing`/`failedQueue` (`api-client.ts:133-170`). |
| NR-11 | Medium | **FIXED** | Payment read + guarded increment inside `$transaction` (`invoice.service.ts:469-528`). |
| NR-12 | Medium | **PARTIAL** | Partial unique index + RA read in txn; DRAFT invoices still counted by index but excluded from seeding query → P2002 + request hang (NR-23); `nextSequentialNumberTx` unused (R2-13). |
| NR-13 | Medium | **PARTIAL** | Backend validator + migration done; **client still sends `resourceId: ''`** for BOQ-only lines → whole save 400s (`ProcurementTab.tsx:316`, NR-51). |
| NR-14 | Low | **FIXED** | Arab/kharab divisors corrected (`gst.service.ts:104-122`). |
| NR-15 | Low | **FIXED** | MCP scoping list trimmed; models without `companyId` removed. |
| NR-16 | Low | **FIXED** | `settings.service.ts` maps legacy `SUPERVISOR` → `SITE_SUPERVISOR`. |
| NR-17 | Low | **PARTIAL** | New migrations dated `20260730…` / `20260731…`; Round-1 backdated `20260711*` / duplicate-prefix `20260712*` folders remain. |
| NR-18 | Low | **FIXED** | Migration `20260730120200` adds real CHECK constraints on `progress_pct`. |
| NR-19 | Low | **PARTIAL** | CPM cycle → 400 fixed; `nextSequentialNumberTx` dead; estimate-links test still skipped. |

## Original findings — Round-2 delta (high-signal only)

| ID | Was (Round 1) | Now (Round 2) |
| -- | ------------- | ------------- |
| EST-C1 | PARTIAL | **PARTIAL** — section subtotals + BOQ conversion fixed; **material-demand path** still maps all `estimate.items` (sub-items included) → duplicate indent demand. |
| EST-C2 | PARTIAL | **FIXED** — budget delta compares BOQ amounts old vs new inside `$transaction`. |
| EST-C3 | NOT-FIXED | **FIXED** — `convertEstimateToBoq` wrapped in `$transaction`. Indent gen post-txn is awaited without catch (500 after commit). |
| EST-H1 | PARTIAL | **FIXED** — stock/open-req pro-rated per resource in `createDraftIndentsFromDemand`. |
| EST-H2/NR-7 | PARTIAL | **FIXED** — tenant-scoped token overlap matcher in material-demand. |
| EST-H4 | NOT-FIXED | **FIXED** — GRN qty apportioned across requisition lines by outstanding BOQ qty. |
| EST-H6 | NOT-FIXED | **REGRESSED** — `updateChangeOrderLine` exists but passes `''` as projectId to `assertProjectAccess` → every call 404s (R2-1). |
| EST-H7 | NOT-FIXED | **FIXED** — `bulkUpsertResources` writes price-history on rate change. |
| EST-M13 | NOT-FIXED | **PARTIAL** — BOQ/rate-analysis routes guarded; `estimate.routes.ts` has zero role guards — `approve` and `convert-to-boq` open to any member (R2-3). |
| EST-M8 | NOT-FIXED | **NOT-FIXED** — export still ignores `item.rateAnalysisId`. |
| EST-M11 | NOT-FIXED | **NOT-FIXED** — `updateMeasurement` still has no rate/qty validation. |
| FIN-H2/NR-11 | PARTIAL | **FIXED** — payment read + guarded increment inside `$transaction`. |
| FIN-H3 | PARTIAL | **FIXED** — `clientState` column + migration; persisted on create/update. |
| FIN-H4/NR-12 | PARTIAL | **PARTIAL** — RA read inside txn + partial unique index in migration; still uses global `nextSequentialNumber` inside txn (R2-13); index not in `schema.prisma` (R2-11 drift risk). |
| FIN-H5/NR-4 | PARTIAL/REGRESSED | **PARTIAL** — bill GST via `vendorGstin` fixed; **Tally sales retention balancing still open**; state-code fallback bug (R2-7). |
| FIN-H7 | NOT-FIXED | **PARTIAL** — `createTask` validates predecessors + self-loops; CPM cycle → 400; `updateTask` has no predecessor validation; multi-edge cycles only caught at read time. |
| FIN-H8 | NOT-FIXED | **FIXED** — dashboard excludes `isDeleted`/`isTemporary` projects. |
| FIN-M1 | NOT-FIXED | **PARTIAL** — GST math in paise; line-item totals still float. |
| FIN-M9 | NOT-FIXED | **NOT-FIXED** — analytics cash baseline still PAID+invoiceDate filter. |
| MOB-C2 | PARTIAL | **PARTIAL** — non-401 rethrow; JSON parse on retry may still wrong-logout. |
| MOB-H6 | NOT-FIXED | **PARTIAL** — httpOnly cookie backend wired, but `refreshAccessToken` omits `credentials:'include'`; web stores literal `"undefined"` in localStorage → session dies at first expiry cross-origin (NR-52). |
| MOB-H11/NR-13 | PARTIAL | **PARTIAL** — backend chain complete; client `resourceId: ''` still rejects (NR-51). |
| MOB-H7 | PARTIAL | **PARTIAL** — wired; SDK lockfile mismatch may block native builds. |
| UI-C1 | REGRESSED | **FIXED** |
| UI-C2 | FIXED | **FIXED** — estimation `max-w-6xl self-center` retained. |
| UI-H4 | NOT-FIXED | **FIXED** — ActionBar horizontal scroll on phone. |
| UI-H6 | NOT-FIXED | **FIXED** — `edges={['top', 'bottom']}` on auth mobile. |
| UI-H3 | PARTIAL | **FIXED** — flex-based panes on invoice/bill/users/material-prices; stack below 1024. At 1024 with sidebar (~764px content) panes squeeze but don't overflow. |
| UI-M8 | NOT-FIXED | **PARTIAL** — `AdaptiveSheet` centers at ≥768 ✓; `Select.tsx` md:/isDesktop mismatch at 768–1023 (NR-41). |
| UI-M11 | NOT-FIXED | **FIXED** — `Button`/`Card` hover and focus-visible rings on web. |
| UI-M12 | NOT-FIXED | **PARTIAL** — `Button` hitSlop gives ~52px effective target; visual min-height not enforced. |
| UI-L16 | NOT-FIXED | **FIXED** — dashboard skeleton uses valid Tailwind heights. |
| UI-L18 | NOT-FIXED | **FIXED** — `ScreenContainer` tiered `max-w-7xl/6xl/4xl` for desktop and tablet. |
| DAT-3.3 | PARTIAL | **FIXED** — one-off scripts moved to `scripts/one-off/`; stale `prisma/boq.service.ts` gone. |
| DAT-3.6 | PARTIAL | **PARTIAL** — `SubcontractWorkOrder.companyId` migration added; MR/GRN `Company` FK may remain. |

Items still **NOT-FIXED** from Round 1 (unchanged or not re-touched): EST-M8,
FIN-M9, FIN-M1 (line-item Decimal), SEC-L16–L22, DAT-2.1, DAT-2.4, MOB-M19
(SDK alignment), MOB-H6 (localStorage refresh). **PARTIAL:** EST-M11 (create
validates; `updateMeasurement` still unvalidated).

### EST/FIN deep re-verification (R2-1 … R2-13)

Dedicated EST+FIN audit on the uncommitted tree (two independent passes, merged).
Confirms most money/quantity partials are genuinely fixed; `tsc` was clean after
Round 1 but is broken again with 16 errors. Highlights one **regressed** fix and
several follow-through gaps.

| ID | Sev | Issue |
| -- | --- | ----- |
| R2-1 | High | **EST-H6 dead code** — `updateChangeOrderLine` passes `''` to `assertProjectAccess`; controller never forwards `req.params.id`; every `PUT …/lines/:lineId` 404s. Fix: fetch CO first, pass `co.projectId`. |
| R2-2 | High | Same as **NR-21** — petty cash CREATE TABLE in stray `prisma/m`. |
| R2-3 | Med | **EST-M13 guard bypass** — `estimate.routes.ts` has no role guards; `approve` and unguarded `POST /estimates/:id/convert-to-boq` bypass `BOQ_MUTATION_ROLES`. |
| R2-4 | Med | **createGRN EST-M1 block is a no-op** — fulfilment check uses global `prisma` inside `$transaction`; sets `status: 'APPROVED'` when already APPROVED; dead `reqLineIds` (TS6133). Real mitigation is `getOpenRequisitionQty`. |
| R2-5 | Low | **EST-M14 CPM call is read-only** — `approveChangeOrder` awaits `getGantt()` non-fatally; qty clamp ≥ 0 works. Cosmetic FIX comment overstates side effect. |
| R2-6 | Med | **BOQ-only req lines un-orderable** — null `resourceId` lines save (NR-13) but `createPO` validation map ignores them. |
| R2-7 | Low | **Tally state fallback** — `companyStateCode` compares 2-digit code to state *name* when no GSTIN → all bills IGST. |
| R2-8 | Low | Client-supplied `poNumber` / `invoiceNumber` still accepted when provided. |
| R2-9 | Low | Unit mixing upstream — shortfall math subtracts stock (resource units) from demand (demand units) before conversion; GRN/PO paths still compare raw qty with no unit validation. |
| R2-10 | Low | Misleading FIX comments across several touched files. |
| R2-11 | Med | **RA partial unique index schema drift** — `invoices_projectid_rasequence_unique` exists only in migration SQL, not `schema.prisma`; next `prisma migrate dev` may generate `DROP INDEX` and remove the FIN-H4 race guard. |
| R2-12 | Low | **Incompatible-unit demand silently dropped** — `resolveCanonicalUnitAndQty` returns `null` and caller `continue`s with no log → under-ordering in auto-indents. |
| R2-13 | Med | **NR-12 half-done** — `createInvoice` still calls global `nextSequentialNumber` inside `$transaction`; `nextSequentialNumberTx` remains unused; P2002 race → unhandled 500. |

**EST/FIN scorecard (Round 2, reconciled):**

| Verdict | Items |
| ------- | ----- |
| FIXED | EST-C2, EST-C3, EST-H1, EST-H2/NR-7, EST-H4, EST-H7, EST-M3/NR-8, EST-M9, EST-M14, EST-M16, FIN-H2/NR-11, FIN-H3, FIN-H8, FIN-M3, FIN-M5, FIN-M6, FIN-M10, FIN-M11, NR-5, NR-14 |
| PARTIAL | EST-C1 (demand path), EST-M6, EST-M7, EST-M11, EST-M12/NR-9, EST-M13, EST-M15/NR-6, FIN-H4/NR-12, FIN-H5/NR-4, FIN-H7, FIN-M1, FIN-M12 |
| NOT-FIXED | EST-M8, FIN-M9 |
| REGRESSED | EST-H6 (R2-1) |

### SEC/DAT deep re-verification (Round 2)

| ID | Status | Notes |
| -- | ------ | ----- |
| SEC-C2 (OrThrow) | **NOT-FIXED** | `READ_ACTIONS` still lacks OrThrow variants; ~52 call sites bypass ALS tenant scoping. |
| SEC-L16 | **PARTIAL** | `min(32)` on JWT secrets; no placeholder rejection in prod. |
| SEC-L17 | **NOT-FIXED** | Raw `err.message` still returned to clients in non-prod; "fix" only redacts prod **server log** (hurts prod debuggability). |
| SEC-L20 | **FIXED** | Body limit message now "max 1MB". |
| SEC-L21 | **PARTIAL** | Upload streams Buffer ✓; download uses `String(res.data)` without `responseType: 'arraybuffer'` — binary ciphertext UTF-8 mangled. |
| SEC-L22 | **NOT-FIXED** | `removeHeader('Content-Encoding')` before response is a no-op; compression still applies to auth routes. |
| DAT-2.1 | **NOT-FIXED / worse** | Company→User Cascade vs RESTRICT FKs; Phase 5 models add ~6 more RESTRICT user FKs. |
| DAT-2.4 | **PARTIAL** | 34 vulns (1 critical, 22 high) vs 40; pnpm overrides added but `body-parser` still resolves `<1.20.6`; most crit/high in Expo/mobile chain. |
| DAT-3.3 | **FIXED** | One-offs in `scripts/one-off/`. |
| DAT-3.6 | **PARTIAL** | SWO `companyId` migration done; MR/GRN still have `companyId` without Company relation. |
| DAT-3.8 | **NOT-FIXED** | `--forceExit`, `db:test:reset` identical to `db:reset`, turbo test env unset. |
| DAT-4.9 | **FIXED** | `.npmrc` `prefer-frozen-lockfile=true`. |

**Migration ↔ schema consistency (verified):**

| Model / change | Migration folder | Status |
| -------------- | ---------------- | ------ |
| Invoice.clientState + RA unique index | `20260730120100` | OK |
| Requisition `resourceId` nullable | `20260731040000` | OK |
| PunchItem | `20260731050000` | OK |
| RFI + Submittal | `20260731060000` | OK |
| Drawing + DrawingVersion | `20260731070000` | OK |
| SubcontractWorkOrder.companyId | `20260731080000` | OK |
| **PettyCashEntry** | **none — SQL in stray `prisma/m`** | **BROKEN (NR-21)** |

No reverse drift (no migration creates a table absent from schema). **CI gap:** jest
runs ts-jest in `isolatedModules` (transpile-only) mode — all 19 suites execute
despite 16 `tsc` errors; `build`/`typecheck` in CI will still fail.

---

## New issues introduced in Round 2 (NR-20+)

### Critical / shipping blockers

- **NR-20 — Backend TypeScript does not compile (16 errors).** Phase 5 modules
  break the build:
  - `drawing.routes.ts` / `rfi-submittal.routes.ts`: `validate()` called with
    `{ params, body }` wrapper schemas that don't match the middleware's
    `Partial<{ body, query, params }>` shape (NR-31 — silent runtime bypass).
  - `drawing.service.ts` / `rfi-submittal.service.ts`: audit actions `"UPLOAD"`,
    `"ANSWER"`, `"REVIEW"` not in the `AuditAction` enum.
  - `sync.service.ts`: queries `updatedAt` on `Task` and `DailyReport` — **neither
    column exists**; also spreads `{ companyId }` on `DailyReport`, which has **no
    `companyId` column** (NR-46). Requires schema migrations, not query edits alone.
  - Trivial unused symbols: `app.ts` (`req`), `accounting-export.service.ts`
    (`Decimal`), `labour.service.ts` (`ApiError`), `procurement.service.ts`
    (`reqLineIds`).
  **Fix:** correct validate usage, extend `AuditAction` enum (+ migration) or use
  `CUSTOM`, add `updatedAt` (+ backfill) to syncable models and fix DailyReport
  company scoping, run `tsc --noEmit` until clean.

- **NR-21 — Petty cash migration in wrong path (`apps/backend/prisma/m`).**
  Full `CREATE TABLE petty_cash_entries` SQL exists in an untracked extensionless
  file; `PettyCashEntry` is declared in `schema.prisma` but **no proper migration
  folder** exists. Runtime: `prisma migrate deploy` never creates the table; petty
  cash API calls will 500. **Fix:** move SQL to
  `migrations/20260731xxxxxx_add_petty_cash/migration.sql`, delete `prisma/m`.

### High

- **NR-22 — Phase 5 features are stubs with compile/runtime holes.** Punch list,
  RFIs/submittals, drawings, inventory traceability, labour, portal-enhanced,
  accounting export, i18n, and sync routes are wired in `app.ts`, but several
  cannot run until NR-20/NR-21 are fixed. No corresponding **mobile UI** was added
  for these modules — backend-only stubs.

- **NR-23 — Test regression: `invoice-ra.test.ts` + RA sequence logic bug.** Suite
  **18/19** on fresh run; root cause: partial unique index counts all non-null
  `ra_sequence` rows, but seeding query excludes `status: DRAFT` — a DRAFT RA bill #1
  makes bill #2 recompute `raSequence = 1` → P2002 at `invoice.service.ts:242`. Request
  then **hangs** (30s jest timeout) instead of returning an error. Second consecutive
  run can also fail `daily-report.test.ts` (409 duplicate) — suite is non-idempotent
  (NR-55). Procurement tests may log P2002 on `po_number` when document_counters drift
  from seeded numbers.

- **NR-51 — NR-13 client not wired.** `ProcurementTab.tsx:316` sends
  `resourceId: l.resourceId`; BOQ-only draft lines carry `resourceId: ''` which fails
  `z.string().uuid().optional()`. Fix: `resourceId: l.resourceId || undefined`.

- **NR-52 — MOB-H6 web refresh broken cross-origin.** `refreshAccessToken` omits
  `credentials:'include'`; login no longer returns refreshToken on web so
  `persistSession` stores literal `"undefined"` in localStorage. Web sessions die at
  first access-token expiry unless API is same-origin.

- **NR-53 — Auth full-bleed regression at 1024–1279.** `AuthScreenShell` hero split
  now requires `isWideDesktop` (≥1280); fallback branch has no max-width — login forms
  stretch edge-to-edge on iPad landscape / narrow desktop web.

- **NR-54 — Native iPad desktop chrome ignores status bar.** `AppTopBar` fixed `h-16`
  with no safe-area inset; sidebar/topbar now render on native iPad ≥1024 under the
  status bar.

- **NR-55 — Test suite non-idempotent.** Back-to-back runs can flip from 1 failed to
  2 failed; `--forceExit` masks open handles (DAT-3.8).

- **NR-24 — Expo SDK manifest vs lockfile drift (CI blocker).** `apps/mobile/package.json`
  bumps `expo ~51→~52`, `react-native 0.74.2→0.76.5`, `react-native-web ~0.19.6→~0.19.13`,
  but `pnpm-lock.yaml` still pins SDK 51. **`pnpm install --frozen-lockfile` fails**
  with 3 specifier mismatches. A plain install triggers an untested major SDK upgrade.
  **Fix:** either revert manifest to SDK 51 or regenerate lockfile and validate Expo 52
  end-to-end (`expo install --check`, native build smoke test).

### Medium (cross-device UI)

- **NR-25 — Tablet tier (768–1023) nav gap.** With UI-C1 fixed, `isDesktop` is
  false below 1024, so iPad portrait (768) gets bottom tabs only — no sidebar or
  icon rail. Master-detail panes now flex/stack correctly (UI-H3 fixed), but
  marketing pages hide About/Pricing links until ≥1024 (`MarketingNav.tsx`) with
  no hamburger fallback.
  **Fix:** consider sidebar or compact rail from `isTablet` (768+) on web/iPad.

- **NR-26 — Tablet-tier polish gaps (768–1023).** UI-H3 master-detail is fixed,
  but rough edges remain: `Select` pickers slide up like phones while forms use
  centered dialogs (NR-41); `ResponsiveGridList` stays 1-column while
  `ResponsiveGrid` goes 2-column at 768; inconsistent gutters when screens use
  phone `p-4` inside `ScreenContainer`'s `px-6`; ActionBar pins first child
  full-width on phone — on estimation that's the secondary "Edit" button (cosmetic).

- **NR-27 — Phase 5 mobile/offline incomplete.** No mobile UI for sync status or
  conflict resolution. Queue rough edges (NR-42): storage-key bump `v1→v2` silently
  orphans un-synced v1 reports; replay destructuring strips a nonexistent `payload`
  key; new op types have replay configs but zero producers. See also NR-35.

### Low

- **NR-28 — Estimate-links test still skipped** (`it.skip` line 119) — coverage
  gap for submitForReview MATERIAL blocking.
- **NR-29 — `--forceExit` still on jest**; DAT-3.8 partially addressed only.
- **NR-30 — Stray untracked `apps/backend/prisma/m`** must not be committed.
- **NR-39 — Tracked dead route file `app/(app)/reports-hub/index`** (extensionless,
  ~18KB stale copy alongside `index.tsx`). Same anti-pattern as Round-1's `hooks/use`.
  **Fix:** delete the extensionless file.
- **NR-40 — Tablet FAB / tab-bar overlap.** `ScreenContainer` tablet branch uses
  `pb-10` (40px) while `AssistantFab` + tab bar reserve ~150px. Last list items
  can sit under the FAB on 768–1023. **Fix:** apply bottom padding when
  `isTablet && !isDesktop`.
- **NR-41 — Select half-state at 768–1023.** `Select.tsx:180-187` — Tailwind `md:`
  classes fire at ≥768 while JS `isDesktop` (`max-w-lg`) fires at ≥1024 → full-width
  vertically-centered slab on tablet tier.
- **NR-42 — Deprecated `columns` alias in `useViewport.ts`** disagrees with
  `gridColumns` (2-col at ≥1024 vs ≥768). No consumers — delete before use.

### Critical / High — Phase 5 deep verification (Round 2 supplement)

These were confirmed by a dedicated Phase 5 audit after the general Round-2
review. They are **in addition to** NR-20/NR-21 above.

- **NR-31 — Silent validation bypass on 6 Phase 5 mutation endpoints (runtime
  security hole).** `drawing.routes.ts` and `rfi-submittal.routes.ts` pass whole
  wrapper schemas like `z.object({ params, body })` into `validate()`, but the
  middleware expects separate `{ params: schema, body: schema }`. At runtime
  `.body` is `undefined`, so **no validation runs** on RFI update/answer,
  submittal update/review, drawing update/add-version — arbitrary status strings
  can be written, bypassing enums and any state machine. This is both a compile
  error and a silent bypass. **Fix:** split schemas like every other route in the
  codebase; add integration tests that reject invalid status values.

- **NR-32 — RFI/Submittal numbers consume the invoice document counter.**
  `rfi-submittal.service.ts` calls `nextSequentialNumber(companyId, 'invoice')`
  and string-replaces `INV` → `RFI`/`SUB`. Every RFI/submittal creates a **gap in
  the GST-sensitive invoice sequence** and RFIs/submittals share one counter.
  **Fix:** add `'rfi'` and `'submittal'` (or `'rfi_submittal'`) types to
  `document_counters` and generate numbers independently.

- **NR-33 — Cross-tenant leak in inventory traceability.**
  `inventory-traceability.service.ts` `getResourceTraceability` does not verify
  `projectId` belongs to the caller's `companyId`; requisition-line queries filter
  by `projectId` only. A user can pass another tenant's project UUID and read
  requisition numbers/quantities/statuses. **Fix:** assert project membership or
  add `companyId` to every query in the chain.

- **NR-34 — No state machines on Phase 5 entities.** RFI, Submittal, PunchItem,
  and PettyCashEntry accept arbitrary status transitions via generic updates (and
  RFI/Submittal validation is bypassed per NR-31). e.g. CLOSED→OPEN, re-answering
  a closed RFI, un-reconciling petty cash. **Fix:** whitelist transitions per
  entity; use guarded `updateMany({ where: { id, status: EXPECTED } })`.

- **NR-35 — Mobile offline replay targets wrong endpoints.** `offline-sync.service.ts`
  replays attendance to `POST /projects/:id/attendance` and
  `PUT /projects/:id/attendance/:id`, but real routes are check-in/check-out.
  These ops 404 forever with no retry cap or dead-letter. `Idempotency-Key` is
  only honored on daily-report/payment — punch/RFI replays can duplicate on retry.
  **Fix:** align replay URLs with actual API; add idempotency to all queued
  mutation types; implement conflict log (§8.1 spec).

- **NR-36 — Drawing acknowledgement missing (§8.3 core feature).** No
  `DrawingAcknowledgement` model, endpoint, or UI — only a drawing register with
  versions. Superseded-revision locking also unenforced. **Fix:** add model +
  migration + `POST /drawings/:id/acknowledge` + portal notification of who saw
  Rev-C.

- **NR-37 — Phase 5 spec shortfalls (thin wrappers vs audit requirements).**
  - **8.5 Inventory:** read-only traceability only; no issue/return notes, stock
    transfers, or BOQ consumption variance.
  - **8.7 Accounting export:** CSV + QuickBooks only; no Zoho Books, Busy,
    GSTR-1/GSTR-3B; no debit=credit balance check; header falsely claims Excel.
  - **8.8 Labour:** analytics only with hardcoded ₹500 wage; no muster by
    trade/gang, piece-rate vs day-rate, weekly payment register.
  - **8.6 Portal:** list/revoke + token data only; no client selections/approvals
    (sign-off) flow.
  Either implement to spec or document as deferred and **unmount** incomplete routes.

- **NR-38 — Sync is pull-only skeleton, not offline-first (even after compile fix).**
  `sync.service.ts`: `boqItems` ignores `since` (full dump capped at 500 rows);
  punch/RFI/submittal deltas capped at 200 with no cursor; `tasks` ignores
  `projectIds`; `since` unvalidated; errors swallowed with `.catch(() => [])`.
  **No push/upload endpoint** — mobile offline queue replays against regular routes,
  and nothing in `apps/mobile` calls `/api/sync`. Schema blockers (NR-46): `Task` and
  `DailyReport` need `updatedAt` migrations; `DailyReport` cannot be company-filtered
  as written. **Fix:** schema migrations + honest delta filters + push path + mobile
  client wiring, or unmount until real.

- **NR-43 — Phase 5 models omitted from `TENANT_SCOPED_MODELS`.** `PunchItem`, `RFI`,
  `Submittal`, `Drawing`, `PettyCashEntry`, and `SubcontractWorkOrder` (now has
  `companyId`) were not added to the ALS auto-scoping set in `src/lib/prisma.ts`.
  `DocumentCounter` is in the MCP list but **not** the backend list despite comments
  requiring parity. Services scope explicitly (defense-in-depth gap, not a live leak
  on spot-check). **Fix:** add all models with direct `companyId` to both lists.

- **NR-44 — Drawings migration drift.** Migration `20260731070000` is missing the
  unique index on `drawings.current_version_id` required by the schema's `@unique`
  on `Drawing.currentVersionId`. The 1:1 back-relation is unenforced at DB level.
  **Fix:** add `CREATE UNIQUE INDEX drawings_current_version_id_key …` migration.

- **NR-45 — Portal enhanced leaks project budget.** Public route
  `/api/portal/:token/enhanced` returns `project.budget` to every token holder
  regardless of scopes. Existing `portal.service.ts` never exposes budget. **Fix:**
  remove budget from public payload or gate behind an explicit scope.

- **NR-46 — Sync schema prerequisites.** Beyond compile errors: `DailyReport` has
  no `updatedAt` and no `companyId`; `Task` has no `updatedAt`. Delta sync cannot
  work without migrations adding these columns (+ backfill strategy for `updatedAt`).

- **NR-47 — Inventory `currentBalance` wrong for multi-location projects.**
  `inventory-traceability.service.ts` uses `findFirst` on stock locations instead of
  summing balances across all project locations.

- **NR-48 — i18n is dead code on mobile.** Backend `/api/i18n` returns config
  metadata only (no translations). `apps/mobile/constants/i18n.ts` has a 5-language
  dictionary but **nothing imports it** — the referenced `useTranslation()` hook
  does not exist. Role-dashboard config duplicated in backend and mobile (drift risk).

- **NR-49 — Accounting export quality gaps.** Promised Excel workbook via exceljs not
  implemented; `findMany` unbounded on large tenants; `csvEscape` does not neutralize
  formula injection (`=`, `+`, `-`, `@` prefixes in vendor/client names execute in
  Excel). Date query params unvalidated.

### Phase 5 per-module verdict (Round 2 deep review)

| Module | Verdict | Notes |
| ------ | ------- | ----- |
| Punch list | **WORKING** | Best of batch; validation wired correctly via `.shape.body` |
| RFIs/submittals | **BROKEN** | Compile + NR-31 + NR-32 counter bug |
| Drawings | **BROKEN** | Compile + NR-44 migration drift; design sound once fixed |
| Inventory traceability | **LEAK** | Compiles; NR-33, NR-47 |
| Labour | **BROKEN** (trivial) | Unused import; analytics only, IST timezone bug |
| Petty cash | **BROKEN** (runtime) | Code good; NR-21 missing migration |
| Portal enhanced | **BUGGY** | Compiles; NR-45 budget leak on public route |
| Sync | **BROKEN** | NR-20, NR-38, NR-46; pull-only skeleton |
| Accounting export | **BROKEN** (trivial) | Unused import; NR-49 quality gaps |
| i18n | **STUB** | NR-48 dead mobile dictionary |

### Phase 5 feature matrix (Round 2)

| §8 Feature | Backend status | Mobile UI | Blockers |
| ---------- | -------------- | --------- | -------- |
| 8.1 Offline sync | **BROKEN** (schema + compile) | No `/api/sync` client; queue broken (NR-35) | NR-20, NR-38, NR-46 |
| 8.2 RFIs/submittals | **BROKEN** (compile + counter) | None | NR-31, NR-32, NR-34, NR-43 |
| 8.3 Drawings | **BROKEN** (compile + migration drift) | None | NR-31, NR-36, NR-44 |
| 8.4 Punch list | **WORKING** | None | NR-34, NR-43 |
| 8.5 Inventory traceability | **LEAK** + wrong balance | None | NR-33, NR-37, NR-47 |
| 8.6 Portal enhanced | **BUGGY** (budget leak) | None | NR-37, NR-45 |
| 8.7 Accounting export | CSV/QB; compile trivial | None | NR-37, NR-49 |
| 8.8 Labour | Analytics stub; compile trivial | None | NR-37 |
| 8.9 i18n + petty cash | i18n stub; petty cash **no table** | Dead i18n dict (NR-48) | NR-21, NR-48 |

---

## Cross-device UI consistency (Round 2 snapshot — re-verified)

Dedicated UI re-verification confirmed Round-1 UI items are **genuinely fixed**;
breakpoint model is coherent across 360→1920. Weakest band remains **768–1023**.

| Width | App shell | Content / layout | Known rough edges |
| ----- | --------- | ---------------- | ----------------- |
| **360 / 414** | Bottom tabs + mobile header | Phone tier everywhere | Solid — ActionBar scroll, auth safe-area, ≥44px hit targets |
| **768** (iPad portrait) | Bottom tabs, no sidebar | Centered dialogs, 2-col grids | Select slab (NR-41); ScreenContainer tablet tier bypassed on many screens; FAB overlap (NR-40) |
| **1024** (iPad landscape) | Sidebar + top bar (NR-54: no safe-area) | Flex master-detail | Auth full-bleed until 1280 (NR-53); settings loses 2-col layout |
| **1280** | Desktop shell | `max-w-7xl`, 3-col grids | Consistent |
| **1920** | Desktop shell | Content capped at `max-w-7xl`, centered | No ultrawide stretch |

**Verdict:** Usable on phone and wide desktop; native iPad landscape (≥1024) gets
the real desktop shell. Tablet portrait / 768–1023 web is functional but not
peer-grade until NR-25, NR-40, NR-41 are addressed.

---

## Tests & tooling (Round 2)

| Check | Result |
| ----- | ------ |
| `pnpm --filter @buildflow/backend test` | **18–19/19 suites** — run 1: 89 pass/2 fail/1 skip; run 2: 90 pass/1 fail/1 skip (non-idempotent, NR-55). Jest compiles via `isolatedModules` despite 16 `tsc` errors. |
| `tsc --noEmit -p apps/backend` | **FAIL** (16 errors in Phase 5 files) |
| `pnpm install --frozen-lockfile` | **FAIL** — Expo SDK 52 manifest vs SDK 51 lockfile (NR-24) |
| Audit log runtime | Migration present — should work once DB migrated |
| Seed exit | Round-1 fix retained |

---

## Round-3 priorities (see [`GLM_FIX_PROMPT.md`](GLM_FIX_PROMPT.md))

1. **Make the backend compile and migrate cleanly** (NR-20, NR-21) — nothing else
   ships until `tsc` and `prisma migrate deploy` succeed.
2. **Fix `invoice-ra.test.ts`** (NR-23: align DRAFT handling with unique index or fix
   hang on P2002) and re-enable the skipped estimate-links test; fix test idempotency
   (NR-55).
3. **Align Expo lockfile** with manifest (NR-24) or revert SDK bump.
4. **Finish remaining EST/FIN gaps:** R2-1 (EST-H6 projectId), EST-C1 demand
   path, FIN-H5 Tally retention balance, R2-3/R2-11/R2-13 (guards, RA index drift,
   `nextSequentialNumberTx`), R2-6 BOQ-only PO path, EST-M11 update validation.
5. **Tablet-tier UI polish** (NR-25/26/40/41): optional sidebar rail at 768+,
   Select sheet alignment, FAB bottom padding, delete dead `reports-hub/index` (NR-39).
6. **Phase 5:** either complete each feature (schema + migration + auth + mobile
   screen + test) or **remove/gate** incomplete modules — do not leave compile-
   broken stubs in the tree. See **NR-31 … NR-49**, per-module verdict table, and
   Phase 5 feature matrix above.

## Round 8–9 Remediation (PROC-B / VAR-B)

| ID | Finding | Fix | Commit |
| -- | ------- | --- | ------ |
| PROC-B1 | Button said "Create Bill" after GRN | Renamed to "Record vendor bill"; PO deep-link pre-fill | `b04b144` |
| PROC-B2 | listRequisitions omitted vendor/bills | Added vendorName, vendorGstin, totalAmount, bills summary | `b04b144` |
| PROC-B3 | createBill never persisted purchaseOrderId FK | Fixed snapshot-without-FK bug; Zod schema updated | `b04b144` |
| PROC-B4 | Create-bill had no PO context pre-fill | Pre-fill vendor/GSTIN/category from PO deep-link params | `1c29ef6` |
| PROC-B5 | No attachment upload or AI extract UI | Schema + hooks; DocumentPicker + Extract button (R9-B2) | `e38656f`, R9 |
| PROC-B6 | PO card lacked bill status | Added "Vendor bill pending/recorded" badges | `b04b144` |
| PROC-B7 | No integration test for GRN→bill workflow | procurement-vendor-bill.test.ts (2 tests) | `1c29ef6` |
| PROC-B8 | Bill routes used requireRole not requirePermission | All routes → requirePermission('bill.*'); ACCOUNTANT lost bill.approve | `a644015` |
| PROC-B9 | No LLM bill extraction | bill-extract.service.ts reusing tender-extract pipeline; extract/batch/bulk routes | `a644015`, `e38656f` |
| PROC-B10 | No bulk import screen | import-bills.tsx route + review table (R9-B3) | R9 |
| PROC-B11 | Chatbot lacked bill extract tools | extract_vendor_bill + create_vendor_bill in TOOL_CAPABILITIES | `a644015` |
| PROC-B12 | No extract permission test | bill-extract.test.ts (5 tests) | `e38656f` |
| VAR-B1 | Variation material picker showed full catalog | Scoped to BOQ resourceId or RA components only | `7dc4da5` |
| VAR-B2 | RA-linked BOQ had no component picker | RaComponentPicker with MATERIAL component chips | `7dc4da5` |
| VAR-B3 | No explode for composite BOQ variations | ExplodeButton + explodeCompositeBoq into N lines | `7dc4da5` |
| VAR-B4 | listEligibleBoqItems omitted RA/resource metadata | Added estimateItem relation select | `a644015` |
| VAR-B5 | Full catalog shown when no BOQ linked | Collapsed ad-hoc catalog expander | `7dc4da5` |
| VAR-B6 | No variation scoping test | Covered by VAR-B4 backend test + R9-B8 docs | `7dc4da5` |

### EST-VO — Variation → BOQ → Estimate → Indent sync (Rounds 12–14)

| ID | Finding | Fix | Status | Commit |
| -- | ------- | --- | ------ | ------ |
| EST-VO-1 | Estimate mutated on variation approve | **Fixed** — estimate frozen as baseline; revised scope derived via `getProjectScopeSummary` API + mobile banner | Fixed | `804f0a6` |
| EST-VO-2 | BOQ line rate not updated when variation rate differs | **Partial** — budget delta applied; BOQ rate stays as original. Documented as R14-O1 (deferred) | Partial | `804f0a6` |
| EST-VO-3 | Auto-indent qty mismatch on composite BOQ | **Fixed** — removed auto-indent on approve; single shortfall path via `fetchBoqMaterialDemands` (RA-explodes consistently) | Fixed | `804f0a6` |
| EST-VO-4 | VARIATION BOQ rows invisible to shortfalls | **Fixed** — `fetchBoqMaterialDemands` includes `category: 'VARIATION'` + ChangeOrderLine fallback resource resolution | Fixed | `804f0a6` |
| EST-VO-5 | No revised scope summary | **Fixed** — `GET /projects/:id/scope-summary` + Estimate screen `ScopeSummaryBanner` | Fixed | `804f0a6` |
| EST-VO-6 | BOQ qty could go below executedQty | **Fixed** — `approveChangeOrder` rejects 422 if `rawNewQty < executedQty` | Fixed | `804f0a6` |
| EST-VO-7 | No post-approve impact API | **Fixed** — `GET /projects/:id/change-orders/:coId/impact` returns boqChanges + budgetDelta + indentsCreated | Fixed | `804f0a6` |
| EST-VO-8 | Approved variation cards showed no BOQ impact | **Fixed** — `ApprovedImpactSection` with qtyBefore→qtyAfter + View BOQ / Review shortfalls CTAs | Fixed | `2aa8d98` |
| EST-VO-9 | BOQ lines had no variation provenance | **Fixed** — `variationNumbers[]` on list response + `Via CO-xxx` chip in BoqTab | Fixed | `2aa8d98`, R14 |
| EST-VO-10 | No integration test for variation → BOQ → scope | **Fixed** — 2 tests: impact endpoint (qtyBefore→qtyAfter) + scope-summary | Fixed | `804f0a6` |
