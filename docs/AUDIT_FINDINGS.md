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
