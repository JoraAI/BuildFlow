# BuildFlow — Fix & Enhancement Prompt for GLM-5.2

> **How to use this document.** Paste this entire file to GLM-5.2 as the task
> brief. It is the authoritative work order. Every issue it references is
> catalogued with file paths and line numbers in
> [`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md); read that file first, then execute the
> phases below in order. IDs like `SEC-C1`, `FIN-H6`, `UI-C1`, `MOB-H7`,
> `DAT-1.1` refer to entries in that register.

---

## 1. Role & Context

You are a senior full-stack engineer taking ownership of **BuildFlow**, a
multi-tenant SaaS construction-management platform for the Indian construction
industry. It is intended to be sold to and operated by many different
construction companies (general contractors, subcontractors, developers), so
**professional polish, correctness, multi-tenant safety, and ease of use are
non-negotiable product requirements**, not nice-to-haves.

### 1.1 What the product does

BuildFlow spans the full project lifecycle:

- **Pre-construction:** cost estimation, rate analysis (composite rates broken
  into material/labour/equipment/subcontractor components), Bill of Quantities
  (BOQ), tender import, proposals.
- **Procurement:** material demand → indent/requisition → purchase order (PO) →
  goods receipt note (GRN) → stock → issue/consumption, with vendor management.
- **Execution:** work breakdown structure, tasks, CPM scheduling/Gantt, daily
  progress reports, labour attendance, change orders (variations), subcontractor
  work orders and measurements.
- **Accounting & finance (India-specific):** GST (CGST/SGST/IGST), TDS, tax
  invoices, RA (running-account) bills, vendor bills, payments, journal entries,
  Tally export, financial reports (P&L, cash flow, GST/TDS registers).
- **Platform:** SaaS subscription/billing, notifications, chatbot, client and
  subcontractor portals, an MCP server, granular per-company permissions,
  e-signatures, and encrypted file storage.

### 1.2 Tech stack

- **Monorepo:** Turborepo + pnpm workspaces.
- **Mobile/Web app** (`apps/mobile`): React Native, **Expo SDK 52**, Expo Router,
  NativeWind 4 (Tailwind), Zustand, React Query. **The same codebase ships to iOS,
  Android, iPad/tablet, and desktop web** — all four are first-class targets.
- **Backend** (`apps/backend`): Node.js 20, Express, TypeScript, Prisma,
  PostgreSQL 15, Redis.
- **Shared** (`packages/shared`): Zod schemas, types, enums, constants, pricing.
- **MCP server** (`apps/mcp-server`): exposes tools over the same database.

### 1.3 Product goals you must uphold in every change

1. **Correct money and quantities.** This is a financial + quantity-surveying
   tool; a rupee or a cubic-metre that is wrong is a shipped bug.
2. **Airtight tenant isolation.** No company may ever read or write another
   company's data through any endpoint, tool, webhook, or query.
3. **Trustworthy workflows.** Draft → submit → approve → execute state machines
   must be enforced and safe under concurrency.
4. **Usable on every device by non-technical site and office staff.** It must
   look professional and be easy to operate on a phone in the field, an iPad on
   site, and a desktop browser in the office.
5. **Competitive feature depth.** It should match or beat peers (Procore,
   Buildertrend, Fieldwire, Powerplay, SiteSetu) on the workflows Indian
   construction firms actually need.

---

## 2. Global Engineering Rules (apply to every phase)

Follow these rules on **all** changes. They encode the root-cause patterns behind
the audit findings.

1. **Tenant scoping is mandatory.** Every Prisma `findUnique/findFirst/findMany/
   update/updateMany/delete/deleteMany/create/upsert/aggregate/groupBy/count` on a
   tenant-owned model must be constrained by the authenticated `companyId` (via
   the scoping middleware once it covers writes, or explicitly). Never resolve a
   record by `id` alone for a tenant resource. Add a test that a second company
   gets `404`/`FORBIDDEN`, not the record.
2. **Wrap multi-step writes in `prisma.$transaction`.** Any operation that writes
   more than one row that must succeed or fail together (conversions, approvals,
   payment + journal entry, component rewrites, snapshot + status change) must be
   atomic. Do side-effects that may legitimately fail independently (notifications,
   cache flush, PDF gen) *after* the transaction, and make them non-fatal.
3. **Money stays exact.** Do arithmetic in Prisma `Decimal` (or integer paise)
   end to end. Do **not** convert to JS `number` for intermediate math. Round only
   once, at persistence/display, and make the sum of rounded line items reconcile
   to the rounded total. Keep DB money columns as `Decimal` (they already are —
   do not regress).
4. **Enforce state machines with guarded updates.** Replace
   "read status → check → later write status" with a single guarded
   `updateMany({ where: { id, status: EXPECTED }, data: { status: NEXT } })` and
   treat `count === 0` as a conflict. Define and enforce the allowed transition
   sets in one place per domain.
5. **Validate at the boundary with Zod, trust internal invariants.** Reject
   negative quantities, zero/negative rates where nonsensical, over-receiving,
   over-certification, and out-of-range percentages at the request boundary and
   with DB CHECK constraints. Coerce dates to `Date` and normalize date-only
   values.
6. **Sequential document numbers must be race-safe and non-reusable.** Use an
   atomic per-company (and per-year where applicable) counter row updated inside a
   transaction, or a DB sequence, and never derive the next number from `count()`.
   Numbers must be tenant-scoped-unique, not globally unique.
7. **No silent failures.** Do not swallow errors, do not `continue` past skipped
   business data without surfacing it, and do not fall through to permissive
   behavior on error for anything security- or money-related (fail closed).
8. **Dates and timezones.** The product is India-first: format and bucket dates
   in IST (`Asia/Kolkata`) consistently for reports, Tally, GST periods, and
   attendance day windows. Store timestamps in UTC.
9. **Backwards compatibility.** Do not break existing REST contracts or the
   mobile client without updating the client in the same change. Every schema
   change ships a Prisma migration; never edit an already-applied migration.
10. **Every fix gets a regression test.** Add or extend a test that fails before
    your fix and passes after. Keep `pnpm typecheck`, `pnpm lint`, and the backend
    test suite green at the end of every phase.
11. **Security hygiene.** Never commit secrets or runtime upload artifacts. Verify
    all webhook signatures over the exact raw bytes. Use HMAC (keyed) for
    tamper-evidence, never bare hashes.
12. **Keep it simple.** Fix the root cause; do not add speculative abstractions,
    feature flags, or compatibility shims that the task does not require.

---

## 3. Phase 0 — Stop-the-Bleeding: Security & Data Integrity

These are exploitable or data-destroying. Do this phase first, as a dedicated set
of small PRs, before anything else.

### 3.1 Payment webhook forgery (HIGHEST PRIORITY — `SEC-C1`, `SEC-C2`-adjacent, `SEC-H7`, `SEC-H9`, `FIN-C1`, `FIN-C2`)

This single flaw was found independently by two audits. On the legacy
`/api/webhooks/razorpay` path:

- **Decode the raw body correctly.** `express.raw()` gives a `Buffer`; use
  `req.body.toString('utf8')` for the signature payload — not
  `JSON.stringify(req.body)` (`SEC-H9`,
  `apps/backend/src/controllers/payment.controller.ts:35,52,62,72`).
- **Verify the HMAC signature before doing anything** with the payload. Require a
  **per-company** Razorpay webhook secret; remove the shared platform-secret
  fallback that lets one tenant settle another's invoices (`SEC-H7`,
  `integration.service.ts:330-347`). Reject on mismatch with `crypto.timingSafeEqual`.
- **Scope the invoice lookup to the verified company** and require an explicit
  captured amount from the payload — never default to `invoice.total`
  (`FIN-C2`, `payment.service.ts:125-165`).
- **Make it idempotent:** dedupe on the Razorpay payment id so retries/replays
  can't inflate `paidAmount`, and only transition status forward.
- Wrap the invoice update + journal entry in a `$transaction`.

### 3.2 Prisma tenant auto-scoping is incomplete (`SEC-C2`)

`apps/backend/src/lib/prisma.ts:12-47` scopes only read actions and a partial
model list. Either (a) extend the middleware to inject/validate `companyId` on
`create/update/updateMany/delete/deleteMany/upsert` and cover **all** tenant
models, or (b) remove the middleware entirely and require explicit `companyId`
filters everywhere, backed by tests. Do not leave the current false sense of
safety. Audit every service for `findUnique`/write calls that assumed the
middleware was protecting them.

### 3.3 Document numbering: tenant-scoped + race-safe (`FIN-H1`, `DAT-1.2`, `SEC-M14`, `EST-M5`)

- Change `Invoice.invoiceNumber` from global `@unique` to
  `@@unique([companyId, invoiceNumber])` with a migration (`schema.prisma:945`).
- Replace all `count()`-based numbering in
  `apps/backend/src/lib/id-generator.ts:30-83` (invoices, bills, POs, GRNs,
  requisitions) and `material-demand.service.ts:49-53` with an atomic counter
  table (per company, per document type, per financial year) incremented inside a
  transaction, or a DB sequence. Numbers must not be reused after deletion.
- Generate `poNumber` server-side too (`EST-M6`).

### 3.4 MCP server auth & isolation (`SEC-H5`, `SEC-H6`)

In `apps/mcp-server`: verify tokens with the same access secret the backend
signs with, read the `sub` claim, require `type === 'access'`, check the Redis
blacklist, and re-validate periodically instead of once at startup
(`identity.ts:26-43`). Add the same tenant-scoping Prisma middleware (covering
writes) as the backend (`prisma.ts:9`).

### 3.5 Auth & permission hardening

- **Rate limiter** (`rateLimiter.ts`): configure `app.set('trust proxy', ...)`
  and key on `req.ip`; stop reading the client `X-Forwarded-For` (`SEC-H3`). Make
  the auth limiter **fail closed** (or use an in-process fallback) when Redis is
  down (`SEC-H4`).
- **OWNER escalation** (`settings.service.ts:187-201`): forbid assigning the OWNER
  role via the user-update endpoint and block self-role changes (`SEC-H8`).
- **`optionalAuth`** (`auth.ts:108-130`): require `type === 'access'` (`SEC-M10`).
- **Billing-exempt check** (`auth.ts:26-36,88`): match on `req.originalUrl` so
  expired tenants can still reach Settings/Billing to renew (`SEC-M11`).
- **E-signatures** (`signature.service.ts:26-40`): switch from bare SHA-256 to an
  HMAC keyed with a server secret and include all economically-relevant fields
  (incl. `vendorName` for requisitions) (`SEC-M12`).
- **Public portal handlers** (`subcontract-portal.routes.ts:23-55`,
  `portal.controller.ts:30-33`): wrap in try/catch → `next(err)` so token errors
  don't hang the request (`SEC-M13`).
- **Audit stats leak** (`settings.service.ts:168-177`): add `companyId` to the
  `lastActive` lookup (`SEC-M15`).

### 3.6 Chatbot cross-user leak (`FIN-M7`)

`chatbot.service.ts:164-169` fetches history by `companyId` (+`projectId`) but
not `senderId`, so one user's assistant sees other users' messages — a data leak
and prompt-injection surface. Scope history by `senderId` and enforce project
membership in `buildContext` (`:37-61`).

### 3.7 Low-risk security cleanups

Apply `SEC-L16` (require ≥32-char JWT secrets, reject placeholders in prod),
`SEC-L17` (generic error messages unless an explicit debug flag),
`SEC-L18` (drop `env` from `/health`), `SEC-L19` (log + fail closed on permission
load failure), `SEC-L20` (align body-size limit and error message),
`SEC-L21` (drive storage: upload raw Buffer, not a base64 string),
`SEC-L22` (avoid reflecting secrets; consider no compression on auth responses).

---

## 4. Phase 1 — Financial & Workflow Correctness

Fix the money and state-machine bugs. Each item needs a regression test asserting
the corrected number/behavior.

### 4.1 Estimate sub-item double-count (`EST-C1`)

`estimate.service.ts`: in `getEstimateWithSummary` (196-234), `listEstimates`,
`computeSummary`, and `convertEstimateToBoq` (`boq.service.ts:367`), include only
top-level items (`parentId: null`) — or exclude parents that have children — so
totals, section subtotals, persisted `grandTotal`, project budget, and exports
are not inflated ~2x. Add a test with a parent + two children asserting the
grand total equals the intended (non-doubled) value.

### 4.2 BOQ conversion integrity (`EST-C2`, `EST-C3`)

`boq.service.ts:295-447`:

- Archive existing BOQ lines **before** nulling `estimateItemId` (or capture the
  matching ids first), so re-converting a sub-estimate supersedes the old lines
  instead of leaving duplicates.
- Only apply `budget: { increment: estimate.grandTotal }` on the **first**
  conversion; never re-increment on re-conversion.
- Wrap archive + createMany + budget update in one `$transaction`; run indent
  generation afterward as a non-fatal step.

### 4.3 Material demand / procurement math

- **Stock double-deduction** (`EST-H1`, `material-demand.service.ts:164-168` and
  `previewBoqShortfalls:302-313`): compute per-resource stock and open-indent
  totals once and distribute them across grouped demands, so a resource used by N
  BOQ lines isn't credited N× stock.
- **Cross-tenant description fallback** (`EST-H2`, `:104-122`): add `companyId`
  to the `resource.findFirst`, keep the `type: MATERIAL` filter, and correct the
  match direction (resource name contained in / token-overlapping the description).
- **Open-requisition double counting** (`EST-M1`): exclude requisitions whose POs
  are fully received, or introduce a `CLOSED`/`FULFILLED` transition set on full
  receipt.
- **Unit consistency** (`EST-M15`): validate that a line's unit matches the
  resource's stock unit (or convert via a conversion table) before adding to
  `StockBalance`.
- **NaN guard** (`EST-L6`): reject non-finite quantities.
- **One indent per run** (`EST-L16`): group generated lines into a single
  requisition instead of one per line.

### 4.4 GRN correctness (`EST-H3`, `EST-H4`)

`procurement.service.ts:291-372`:

- Require PO status `APPROVED`; reject GRN lines whose resource isn't on the PO;
  cap cumulative received quantity at the PO line quantity.
- Apportion GRN quantity across requisition lines by outstanding quantity per
  BOQ item, instead of crediting the first matching line.
- Validate PO lines against the approved requisition (`EST-M6`).

### 4.5 Rate analysis & resources (`EST-H7`, `EST-H8`)

- `resource.service.ts`: on every rate change in `updateResource` /
  `bulkUpsertResources`, write a `MaterialPriceHistory` row (as `createResource`
  does) so `syncEffectiveResourceRate` doesn't silently revert manual edits.
- `rate-analysis.service.ts:47-71,191-202`: wrap the delete-then-recreate of
  components and the total update in a `$transaction`.

### 4.6 Change orders & subcontract (`EST-H5`, `EST-H6`, `EST-M10`–`EST-M14`)

- Guard change-order approval with a transactional
  `updateMany({ where: { id, status: 'SUBMITTED' } })` and abort on `count === 0`
  (`EST-H5`).
- Add an endpoint to set change-order line `qtyDelta` (or accept it in
  `add-boq-lines`) and recompute `costImpact` (`EST-H6`).
- Clamp change-order `newQty >= executedQty >= 0` and trigger a CPM recompute of
  dependent tasks on schedule impact (`EST-M14`).
- Use `category.startsWith('SUBCONTRACTOR')` in `createWorkOrderFromBoq`
  (`EST-M10`); validate measurement lines against contract balance/rate and
  whitelist updatable WO fields + status transitions (`EST-M11`); move
  `postApprovedMeasurementToBoq` inside the approval transaction or add
  reconciliation (`EST-M12`).
- Add `requireRole`/`requirePermission` to BOQ, `convert-to-boq`, and
  rate-analysis mutation routes (`EST-M13`).

### 4.7 Estimation edge cases (`EST-M2`–`EST-M4`, `EST-M7`–`EST-M9`, `EST-M16`)

Transactional approval + supersede with guards (`EST-M2`); transactional
`duplicateEstimate` preserving `parentId` (`EST-M3`); validate `sectionId`
belongs to the estimate in `updateItem` (`EST-M4`); whitelist proposal status
transitions (`EST-M7`); export the actually-linked rate analyses (`EST-M8`); fix
the inverted tender match (`EST-M9`); and apply GST on the marked-up base
(confirm the intended tax base with the product owner) (`EST-M16`).

### 4.8 Invoices, bills, GST/TDS, Tally (`FIN-H2`–`FIN-H5`, `FIN-M1`–`FIN-M4`, `FIN-M11`, `FIN-L5`)

- `invoice.service.ts`: bring `recordPayment` up to the safe `recordBillPayment`
  pattern — reject `DRAFT`, block overpayment, wrap update + journal in a
  transaction (`FIN-H2`). Persist and default `clientState`, re-apply retention in
  the update total, and recompute RA/certified fields on edit (`FIN-H3`). Wrap
  `createInvoice`'s read-then-create in a transaction with a lock on prior RA
  invoices; compute retention on the current certified delta (`FIN-H4`).
- `tally.service.ts`: emit a retention ledger line (or use the pre-retention total
  for the party debit) so vouchers balance, and split bill GST into CGST/SGST vs
  IGST by vendor state (`FIN-H5`, `FIN-L5`).
- Move core money math to `Decimal`/paise with reconciled rounding (`FIN-M1`);
  coerce report date filters to `Date`, validate, and paginate (`FIN-M2`); format
  report/Tally/attendance dates in IST (`FIN-M3`); fix the dead comma-expression
  and category mapping in `getEstimateVsActual` (`FIN-M4`); exclude REJECTED bills
  from spend totals (`FIN-M11`). Also fix `amountInWords` for values ≥ 100 crore.

### 4.9 CPM & project ops (`FIN-H6`, `FIN-H7`, `FIN-H8`, `FIN-M5`, `FIN-M6`, `FIN-M8`–`FIN-M10`, `FIN-M12`)

- Correct the FF forward-pass to `es = max(es, pEF + lag - dur)`
  (`cpm.service.ts:105-108`) (`FIN-H6`); detect residual cycles and throw, and
  validate `predecessorId` is a same-project task with no cycle on task create
  (`FIN-H7`).
- Add `isDeleted: false` (+ likely `isTemporary: false`) to company dashboard
  aggregates (`FIN-H8`); replace the nonsensical planned-progress formula with a
  duration-weighted one (`FIN-M5`); normalize `reportDate` to date-only with a DB
  unique constraint and move daily-report side-effects into the transaction
  (`FIN-M6`); gate project-scoped financial routes with
  `requireRole(OWNER, PM, ACCOUNTANT)` (`FIN-M8`); fix the analytics cash baseline
  and ordered-estimate selection (`FIN-M9`); make SaaS webhooks idempotent and
  check Stripe `payment_status` with a dedicated renewal field (`FIN-M10`); honor
  `cronExpr` and scope report-schedule recipients by company (`FIN-M12`).
- Apply the `FIN-L*` low-severity items where cheap (invoice state machine +
  `CANCELLED` status, stream/paginate `exportCompanyData`, attendance day-window
  timezone, SaaS GST on plan prices, `PLAN_ANNUAL_INR` ENTERPRISE entry).

---

## 5. Phase 2 — Mobile / Web App Reliability

These bugs cause spurious logouts, silent data loss, and stale screens. Fix the
auth/session layer first (it explains most "randomly logged out" reports), then
data-freshness, then the procurement/estimation UX bugs.

### 5.1 Auth & session robustness (`MOB-C1`, `MOB-C2`, `MOB-H3`, `MOB-H4`, `MOB-H5`, `MOB-H6`, `MOB-M1`)

In `apps/mobile/lib/api-client.ts`:

- **Flush the queue on refresh failure** (`MOB-C1`): call `processQueue(null)` in
  both catch blocks (in `apiFetch` and `fetchWithAuthRetry`) before logging out,
  so queued requests reject instead of hanging forever.
- **Don't force-logout on a non-401 retry error** (`MOB-C2`): move the
  post-refresh retry outside the try/catch (or rethrow `ApiError`s that aren't
  401), and add a `.catch` on `retryRes.json()`. A 403/422/500 after a successful
  refresh must surface the real error, not "Session expired".
- **Give `apiFetchList` the same refresh/queue path** (`MOB-H3`) so paginated
  list screens survive an expired access token.
- **Persist a rotated refresh token** when the backend returns one (`MOB-H4`).
- **Update or remove the in-memory `accessToken`** in `auth.store.ts` so readers
  don't get a stale token after refresh (`MOB-M1`).

In `apps/mobile/stores/auth.store.ts`:

- **Survive offline launch** (`MOB-H5`): in `hydrate()`, when `/auth/me` fails
  with `NETWORK_ERROR` (status 0), keep the cached user and tokens and continue in
  a degraded/offline mode instead of deleting tokens and logging out. This is
  essential for field use in dead zones.

For web (`shims/expo-secure-store.js`, `MOB-H6`): stop keeping the long-lived
refresh token in `localStorage` where XSS can read it — move the refresh token to
an httpOnly, secure, SameSite cookie issued by the backend (add the endpoint), or
at minimum keep it out of the web shim.

### 5.2 Revive the offline pipeline (`MOB-H7`, `MOB-M20`)

The entire offline feature is currently dead code because `setNetworkStatus` is
never called. Add `@react-native-community/netinfo` to `apps/mobile/package.json`
and wire it (native) plus `window` `online`/`offline` events (web) to
`app.store.setNetworkStatus`. Verify that `OfflineBanner` shows, the proactive
offline branch in `useCreateReport` runs, and `initOfflineSync` replays queued
daily reports when connectivity returns (not just on next launch).

### 5.3 Fix wrong / missing React Query invalidations (`MOB-H8`, `MOB-H9`, `MOB-M2`–`MOB-M6`, `MOB-L10`, `MOB-L11`)

- **Sign PO/indent** (`MOB-H8`, `procurement.queries.ts:25,36`): invalidate
  `expansionKeys.requisitions(projectId)`, not `['projects', projectId, 'procurement']`.
- **GST/TDS report filters** (`MOB-H9`, `accounting.queries.ts:357-403`): append
  `?from=&to=` to the request URL so the date range actually applies.
- Payments must invalidate `['financials', …]` (`MOB-M2`); creating an indent must
  invalidate project procurement + BOQ shortfalls/`procuredQty` (`MOB-M3`);
  measurement submit must refresh the WO summary (`MOB-M4`); remove the
  `?_t=Date.now()` cache-buster and fix the server-side ETag/`Cache-Control`
  instead (`MOB-M5`); make `invalidateProjectCore` target specific keys rather
  than the whole `['projects']` prefix (`MOB-M6`); refresh the project estimate
  list on rename (`MOB-L10`); and use `refetchType: 'all'` (or remove stale
  detail) on RA duplicate/delete (`MOB-L11`).

### 5.4 Procurement & estimation UX data-loss bugs (`MOB-H10`, `MOB-H11`, `MOB-M7`–`MOB-M13`, `MOB-M14`–`MOB-M18`)

- **Composite explode** (`MOB-H10`, `IndentDraftLineCard.tsx:288`): add
  `pendingExplodeBoqId` to the effect deps so re-picking a cached composite item
  still explodes.
- **Silent line drop** (`MOB-H11`, `ProcurementTab.tsx:289-303`): include
  BOQ-only lines (no `resourceId`) in the saved payload, or block save with an
  explicit error; the count the user sees must equal what is saved.
- Pass full material/analysis lists to `Select` (or search server-side) so
  entries beyond the first 100/50 are selectable (`MOB-M7`); resolve the correct
  unit for materials past the loaded page (`MOB-M8`); remove debug `console.log`s
  (`MOB-M9`); wrap inline `mutateAsync` calls in try/catch with `alertAsync`
  (`MOB-M10`); replace the template N+1 storm with a bulk endpoint or a single
  end-of-loop invalidation (`MOB-M11`); resolve template links robustly
  (`MOB-M12`); correct the mismatched rate-analysis links in
  `estimate-templates-legacy.ts` (PCC 1:4:8 must not map to an M15 analysis, BC
  25mm not to BC 40mm, Gypsum 100mm not to 75mm) (`MOB-M13`).
- Fix or remove the dead trend/sparkline in `material-prices.tsx` (`MOB-M14`);
  allow saving category "Other" and `gstRate` (`MOB-M15`); fix `Select`'s
  unreachable "No matches" state (`MOB-M16`); virtualize large BOQ/requisition
  lists with `FlatList`/`SectionList` (`MOB-M17`); use `alertAsync` instead of
  `Alert.alert` for web-visible errors (`MOB-M18`).

### 5.5 Dependencies & navigation (`MOB-H12`, `MOB-M19`, `MOB-L1`–`MOB-L9`, `MOB-L12`–`MOB-L14`)

Fix the impossible `expo-document-picker: ^57.0.1` version and align the Expo SDK
/ router versions so `expo install --check` and EAS builds pass (`MOB-H12`,
`MOB-M19`). Address the navigation and hygiene lows: platform-admin client
expiry + `queryClient.clear()` on logout (`MOB-L1`); avoid remounting the
navigator on role change (`MOB-L2`); derive the project tab purely from the URL
(`MOB-L3`); read the web URL from `EXPO_PUBLIC_WEB_URL` instead of a hardcoded
domain (`MOB-L4`); normalize array route params (`MOB-L5`); remove the dead
`'pos'` sub-tab (`MOB-L6`); stop overwriting manual component-qty edits and use
stable keys (`MOB-L7`); give the two export buttons independent loading states
(`MOB-L8`); dedupe per-row `useMaterials` (`MOB-L9`); replace the fake
status-derived progress bar with real task progress (`MOB-L12`); route action
gating through the granular permission system, not hardcoded roles (`MOB-L13`);
and fix the `daysBetween` off-by-one (`MOB-L14`).

---

## 6. Phase 3 — Responsive, Professional UI on Every Device (explicit user priority)

The app must look genuinely professional and be comfortable to use on: small
phones (~360px), large phones, iPad/tablet (portrait and landscape), and desktop
web (up to ultrawide). The current foundation (sidebar shell, `ScreenContainer`,
`AdaptiveSheet`, `ResponsiveGrid`) is good; the failures are concentrated in a
platform-gated breakpoint hook, an untreated estimation flow, and fixed-width
panes. Do the structural changes first — several other issues resolve as a
consequence.

### 6.1 Make layout width-driven, not platform-driven (`UI-C1`, `UI-H3`)

Rewrite `apps/mobile/hooks/useViewport.ts` so form-factor flags depend on
**window width (and pointer type) regardless of `Platform.OS`**:

- `isPhone: width < 768`
- `isTablet: 768 <= width < 1024`
- `isDesktop: width >= 1024`

This one change lights up the existing tablet/desktop layouts on **native iPads**
(sidebar, grids, dialogs, master-detail). Raise the sidebar/desktop layout
threshold to **1024px** and introduce a real **tablet tier (768–1023)**: keep the
bottom tab bar or a compact icon rail, use 2-column grids, and center dialogs.
The 768–1100px range is currently the most broken on web — fix it by treating it
as tablet, not full desktop.

### 6.2 Give the estimation flow a desktop layout (`UI-C2`)

Wrap every estimation screen (`estimation/[id].tsx`, the build wizard
`EstimateBuildStep.tsx`, compare, and rate-analysis editor) in `ScreenContainer`
(scrollable + constrained max-width) with `PageHeader` on desktop, exactly as the
dashboard/projects screens do. These are the core money screens and currently
stretch edge-to-edge on wide browsers (a label on the far left, a rupee amount
2000px away). No screen may stretch content full-bleed on desktop.

### 6.3 Fix fixed-width panes and action bars (`UI-H3`, `UI-H4`, `UI-H7`)

- Make every `min-w-[N]` two-pane master-detail layout (`material-prices`,
  `users`, `invoice/[id]`, `bill/[id]`, `create-bill`) stack vertically based on
  the **content area** width, not the raw window width, so nothing collapses to a
  ~40px column at 768px.
- On phones, render `ActionBar` as a primary action plus an overflow "More" menu
  (or a horizontally scrollable row) instead of stacking up to 7 full-width
  buttons (`UI-H4`).
- Give the auth panel a `max-w-*` + flex basis and drop the hero panel below
  ~1024px so it never becomes a broken sliver (`UI-H7`).

### 6.4 Desktop data tables & scroll affordances (`UI-H5`, `UI-M14`, `UI-M15`)

- Add a reusable **data-table primitive**: cards on phones, an aligned-column
  table from `lg:` up, used for BOQ, estimate lines, stock, and price lists, so
  quantity surveyors can compare sanctioned/executed/billed columns across rows
  (`UI-M14`).
- Make horizontal scroll regions usable with a mouse on web: show scroll
  indicators, support wheel/trackpad horizontal scroll, or wrap the project tab
  bar on desktop (where there is room). Make the Gantt task-column width
  responsive (`UI-H5`).
- Virtualize desktop lists (`FlatList` with `numColumns`) so large datasets don't
  render every row at once (`UI-M15`).

### 6.5 Safe areas, sheets, dropdowns (`UI-H6`, `UI-M8`, `UI-M9`, `UI-M10`, `UI-L17`, `UI-L19`, `UI-L20`)

Add `'top'` to auth-screen safe-area edges (`UI-H6`); center `AdaptiveSheet` and
switch to a dialog presentation from tablet width up (`UI-M8`); make `Select` use
one width-based mechanism instead of mixing `md:` classes with the JS `isDesktop`
flag (`UI-M9`); replace the stale module-level `Dimensions.get` photo-grid sizing
with `useWindowDimensions`/`onLayout` (`UI-M10`); standardize inner-screen
safe-area edges (`UI-L17`); fix the `text-top` multiline input alignment
(`UI-L19`); anchor date popovers to their trigger on web (`UI-L20`).

### 6.6 Web polish & accessibility (`UI-M11`, `UI-M12`, `UI-M13`, `UI-L16`, `UI-L18`)

Add `hover:` and `focus-visible:` states to `Button`, `Card`, sidebar items, tab
chips, and list rows so the web build feels like a real web app and is
keyboard-navigable (`UI-M11`); ensure a 44px minimum touch target and add
`hitSlop` on dense field-screen actions (`UI-M12`); establish a 12px minimum type
scale and remove fixed-width numeric cells that truncate large rupee amounts
(`UI-M13`); fix the invalid `h-30`/`h-50` skeleton classes (`UI-L16`); and use a
single consistent desktop `max-width` container across all screens (`UI-L18`).

### 6.7 Acceptance for Phase 3

Manually verify at widths **360, 768, 1024, 1440, and 1920 px**, on iOS, Android,
a native iPad, and desktop web (Chrome + Safari), that every primary screen
(dashboard, projects list + detail with all tabs, estimation build + detail, BOQ,
procurement, proposals, accounting create-bill + invoice/bill detail, reports,
settings, auth) is readable, centered/constrained (no full-bleed stretch), has no
clipped/overflowing content, has working hover/focus on web, and has ≥44px touch
targets on phones. The iPad must receive the tablet/desktop layout, never the
phone layout.

---

## 7. Phase 4 — Data Layer, Tests & Repo Hygiene

Restore a working build/test pipeline and clean the repo. Without `DAT-1.1` the
whole seed/reset/test loop hangs, so do it first.

### 7.1 Unblock the pipeline (`DAT-1.1`, `DAT-3.1`, `DAT-3.8`)

- **Seed never exits** (`DAT-1.1`, `seed.ts:239-243`): export a
  `disconnectRedis()` from `src/lib/redis.ts` and call it (plus `prisma.$disconnect()`)
  in the seed's `finally`, or skip the Redis cache flush when the module is run as
  the seed. Verify `pnpm db:seed`, `pnpm db:reset`, `prisma migrate reset`, and
  `scripts/test-backend.sh` all exit cleanly.
- **Guard destructive TRUNCATE** (`DAT-3.1`, `seed.ts:100-107`): refuse to
  truncate unless `NODE_ENV !== 'production'` and an explicit
  `SEED_ALLOW_TRUNCATE=1` is set; update the misleading "idempotent-ish" comment.
- **Test infra** (`DAT-3.8`): `dotenv.config({ override: true })` in
  `src/__tests__/setup.ts` and assert the DB name ends in `_test`; add a jest
  `globalTeardown` that disconnects Prisma + Redis and drop `--forceExit`; make
  `db:test:reset` actually target the test DB; declare the test task's env inputs
  in `turbo.json` so cached green results aren't served after DB/env changes.

### 7.2 Get the suite green and meaningful (`DAT-2.2`, `DAT-2.3`, `DAT-3.4`, `EST-H9`)

- Fix the 12 failing integration tests by deriving expected values from seed
  constants instead of magic numbers, and make mutating suites create their own
  fixtures so they are order-independent (`DAT-2.2`).
- Rename the orphaned `apps/backend/src/__` file to
  `src/__tests__/integration/resource-bulk.test.ts` so its 5 tests actually run,
  and fix its assertions (`DAT-3.4`).
- Point the estimate-links test at the real section-scoped route (`EST-H9`).
- Add coverage for the highest-risk untested services — **CPM scheduling, BOQ
  import/convert, portal/subcontract-portal token auth, permission checks**, and
  the payment webhook — then broaden from there (`DAT-2.3`).

### 7.3 Schema integrity & indexes (`DAT-2.1`, `DAT-3.6`, `DAT-3.7`, `DAT-4.*`)

- Resolve the company-delete cascade conflict: choose a per-relation policy
  (`SetNull` on nullable creator columns, or ordered application-level deletion)
  so company offboarding/GDPR delete works at the DB level (`DAT-2.1`).
- Add the missing tenant relations and indexes in one migration: `companyId` +
  `Company` relation/FK on `MaterialRequisition` and `GoodsReceiptNote`; a
  `companyId` column on `SubcontractWorkOrder` (or document the join-only design);
  indexes on `StockMovement.resourceId`/`referenceId` and
  `InvoiceLineItem.boqItemId`; composite `@@index([companyId, status])` on
  Invoice/Bill/Estimate (`DAT-3.6`).
- Add a partial unique index preventing duplicate open attendance check-ins
  (`WHERE check_out_at IS NULL`) (`DAT-3.7`).
- Apply the schema lows: `@map("old_value")` on `audit_logs.oldValue`; plan the
  `SUPERVISOR` enum retirement; CHECK constraint 0–100 on `progressPct`; reconsider
  the one-report-per-project-per-day unique and the `UserInvite.invitedBy` cascade
  (`DAT-4.1`, `DAT-4.2`, `DAT-4.5`, `DAT-4.6`, `DAT-4.7`).

### 7.4 Data quality & repo hygiene (`DAT-2.5`, `DAT-3.2`, `DAT-3.3`, `DAT-3.5`, `DAT-4.9`, `DAT-4.10`)

Delete the stale `apps/backend/prisma/boq.service.ts` copy and move the remaining
one-off scripts (`backfill-*.ts`, `test-boq-ra.ts`, `query-multi-material-boq.ts`,
`verify-sac.mts`) into `scripts/one-off/` or delete them (`DAT-3.3`); fix or
delete `scripts/patch-template-links.cjs` so it never writes
`resourceName: 'null'` (`DAT-2.5`); dedupe `catalog-data.ts` and add a uniqueness
test on `name+type` (`DAT-3.2`); `git rm -r --cached apps/backend/.filestore` and
add `.filestore/` to `.gitignore` (`DAT-3.5`); set CI to `--frozen-lockfile`
(`DAT-4.9`); drop the deprecated compose `version` key (`DAT-4.10`).

### 7.5 Dependencies (`DAT-2.4`, `MOB-H12`, `MOB-M19`, `MOB-M20`)

Upgrade the backend chain (Express, `uuid`, `body-parser`/`brace-expansion`
transitives, and consider Prisma 6) and dedupe/upgrade the mobile Expo/Metro
chain to clear the 40 audited vulns (incl. the critical `tar` DoS). Reconcile the
mobile Expo SDK/router versions and fix the impossible `expo-document-picker`
version so `expo install --check` passes. Add `@react-native-community/netinfo`.
Run `pnpm audit --prod` and record the residual, un-fixable advisories with
justification.

---

## 8. Phase 5 — Peer-Benchmarked Enhancements (be better than the competition)

Benchmarks: **Procore** (enterprise RFIs/submittals/financials), **Buildertrend**
(client portal, selections, accounting sync), **Fieldwire** (offline-first field
execution, plan-anchored punch lists), **Powerplay / SiteSetu** (India SMB:
indent→PO→GRN→stock→issue traceability, labour muster, multilingual, petty cash).

Only start this phase once Phases 0–4 are green. Each enhancement must respect all
Global Engineering Rules (tenant scoping, transactions, Decimal money, state
machines, tests, responsive UI) and ship with its own Prisma migration, Zod
validators, REST endpoints, React Query hooks, and responsive screens.

Implement in this priority order:

### 8.1 True offline-first field mode (matches Fieldwire/SiteSetu; foundational)

Build on the pipeline revived in Phase 2. Provide a robust local write queue
(daily reports, attendance, GRNs, measurements, photos) with optimistic UI,
durable persistence, background sync on reconnect, per-entity conflict resolution
(last-write-wins with a visible conflict log, or server-authoritative merge for
quantities), and clear per-record sync status in the UI. This is the single
biggest differentiator for Indian sites with weak connectivity.

### 8.2 RFIs & Submittals with approval audit trail (Procore's core strength; absent here)

Add Request-for-Information and Submittal workflows: numbered, assignable, due
dates, threaded responses, status machine (open → answered → closed / draft →
submitted → approved/rejected/revise-resubmit), attachments, and a full immutable
audit trail. Link RFIs/submittals to tasks, BOQ items, and drawings. Notify via
the existing notification service and expose them in the client/subcontractor
portals.

### 8.3 Drawing & document version control with acknowledgement (SiteSetu/Procore)

A drawing register with revisions (Rev-A/B/C), current-revision highlighting,
superseded-revision locking, and **per-user acknowledgement** ("who has seen
Rev-C and when") so the field always builds from the latest sheet. Support PDF/
image viewing with markup on all devices, and reuse the encrypted storage layer.

### 8.4 Punch list / snag list pinned to location & photos (Fieldwire best-in-class)

Plan/location-anchored snags with photo capture, assignee, priority, due date,
status (open → in-progress → ready-for-review → closed), and closeout reporting.
Must work fully offline (8.1) and render as pins on a drawing on tablet/desktop
and as a list on phones.

### 8.5 Close the inventory-traceability loop (extends existing; beats Powerplay)

The indent → PO → GRN → stock flow exists but is leaky (see EST fixes). Complete
it: material **issue** and **return** notes to work areas/subcontractors,
multi-store/multi-location stock, stock transfers, consumption **against BOQ**
with variance (planned vs consumed), and a full material ledger per resource.
Provide a single traceability view from indent to consumption.

### 8.6 Portals & client experience (Buildertrend strength)

Harden and expand the client and subcontractor portals: scoped read/write access,
selections/approvals (client sign-off on variations, RA bills, and drawings),
progress photos, and payment status — all behind the tokenized, rate-limited,
error-safe portal endpoints fixed in Phase 0.

### 8.7 Accounting interoperability beyond Tally (Procore/Buildertrend gap)

Add native, correct exports/integrations to the tools Indian firms use —
QuickBooks, Zoho Books, Busy — plus GSTR-1/GSTR-3B-ready registers derived from
the corrected GST engine. Ensure every export balances (party debit = credits +
retention) and splits CGST/SGST/IGST correctly.

### 8.8 Labour management depth (Powerplay/SiteSetu India workflows)

Daily muster by trade/gang, piece-rate vs day-rate tracking, weekly payment
registers, and output-linked (RA-style) labour billing tied to measured
quantities. Integrate with attendance (with the duplicate-check-in constraint
from Phase 4) and daily reports.

### 8.9 Ease-of-use & reach (broad adoption)

- **Multilingual UI** (peers ship 10+ Indian languages): add i18n scaffolding and
  Hindi + at least two regional languages, with a language switcher.
- **Role-based dashboards** tuned for owner, PM, site supervisor, storekeeper, and
  accountant, each surfacing the KPIs and quick actions that role needs.
- **Guided onboarding & templates**: company setup wizard, prebuilt estimate/BOQ
  templates (corrected per `MOB-M13`), and empty-state guidance so a new
  construction company can get productive without training.
- **Petty cash / site expenses** with receipts and categorized reconciliation
  (Powerplay parity).

---

## 9. Execution Protocol for GLM-5.2

1. **Read the evidence first.** Open [`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md) and
   confirm each referenced file/line still matches before changing it (the repo
   may have moved on). If a finding no longer reproduces, note it and skip.
2. **Work strictly phase by phase, 0 → 5.** Do not start a later phase until the
   earlier one is green. Within a phase, prefer small, focused PRs grouped by the
   sub-section headings above.
3. **One concern per PR.** Each PR states which finding IDs it closes, includes
   the regression test(s), and updates the checkboxes in this document / the
   findings register.
4. **After every change set, run and keep green:**
   `pnpm typecheck`, `pnpm lint`, and `pnpm --filter @buildflow/backend test`
   (against the isolated `_test` DB only — never a real database). For mobile
   changes, run the app on web and at least one native target.
5. **Every schema change ships a new Prisma migration.** Never edit an applied
   migration. Provide a data backfill script when a migration needs one, placed in
   `scripts/one-off/`.
6. **Never regress the Global Engineering Rules (Section 2).** In particular:
   never introduce an unscoped tenant query, never do multi-write without a
   transaction, and never move money math off `Decimal`.
7. **Security discipline:** never commit secrets or `.filestore` artifacts; verify
   webhook signatures over raw bytes; fail closed on auth/money paths.
8. **When a decision is genuinely ambiguous** (e.g. the GST base in `EST-M16`, the
   subcontract TDS base in `FIN-L4`, or the one-report-per-day rule in `DAT-4.6`),
   implement the most defensible interpretation, document the assumption in the PR,
   and flag it for product review rather than blocking.
9. **Do not scope-creep.** Fix root causes; don't add speculative abstractions.
   Phase 5 features are the only place to add new surface area, and only after the
   fixes land.

---

## 10. Definition of Done — Acceptance Checklist

### Security & tenancy
- [ ] The legacy Razorpay webhook rejects unsigned/wrongly-signed payloads and
      cannot mark another tenant's invoice paid; verified by a test posting a
      forged payload (`SEC-C1`/`FIN-C1`/`FIN-C2`/`SEC-H7`/`SEC-H9`).
- [ ] Tenant scoping is enforced on reads **and writes** across all tenant models;
      a cross-tenant access test returns 404/FORBIDDEN (`SEC-C2`).
- [ ] MCP server verifies access tokens correctly, checks the blacklist, and scopes
      all queries by company (`SEC-H5`/`SEC-H6`).
- [ ] Rate limiter can't be bypassed via `X-Forwarded-For` and fails closed on the
      auth path (`SEC-H3`/`SEC-H4`); no OWNER self-escalation (`SEC-H8`).

### Money & workflow correctness
- [ ] Estimate totals/exports/BOQ conversion are not doubled with sub-items
      (`EST-C1`); BOQ conversion is transactional and idempotent on re-conversion
      (`EST-C2`/`EST-C3`).
- [ ] Procurement shortfall math orders the correct quantity for multi-line
      resources (`EST-H1`); GRNs can't over-receive or post to the wrong BOQ item
      (`EST-H3`/`EST-H4`).
- [ ] Invoice payments are transactional, guarded against overpayment, and correct
      for RA/retention; Tally vouchers balance and split GST correctly
      (`FIN-H2`–`FIN-H5`).
- [ ] CPM produces correct early/late dates and float, rejects cycles, and
      validates predecessors (`FIN-H6`/`FIN-H7`).
- [ ] Concurrent approvals of the same estimate/change-order/measurement cannot
      double-apply (guarded `updateMany`) (`EST-H5`/`EST-M2`).
- [ ] Sums of rounded line items reconcile to rounded totals; money math is in
      `Decimal`/paise (`FIN-M1`).

### Mobile reliability
- [ ] Token refresh never hangs queued requests and never force-logs-out on a
      non-401 error; list endpoints refresh; rotated refresh tokens persist
      (`MOB-C1`/`MOB-C2`/`MOB-H3`/`MOB-H4`).
- [ ] Launching offline keeps the session (`MOB-H5`); the offline queue syncs on
      reconnect and `OfflineBanner` works (`MOB-H7`).
- [ ] No mutation leaves a stale screen: signing, indent creation, payments,
      measurements, and GST/TDS filters all reflect immediately
      (`MOB-H8`/`MOB-H9`/`MOB-M2`–`MOB-M6`).
- [ ] No user-entered procurement/estimate data is silently dropped
      (`MOB-H10`/`MOB-H11`).

### Cross-device UI
- [ ] `useViewport` is width-driven; a native iPad gets the tablet/desktop layout
      (`UI-C1`).
- [ ] No screen (especially estimation) stretches full-bleed on desktop; all use a
      constrained container (`UI-C2`/`UI-L18`).
- [ ] The 360/768/1024/1440/1920 px acceptance sweep in Section 6.7 passes on iOS,
      Android, iPad, and web (Chrome + Safari) with working hover/focus and ≥44px
      touch targets.

### Data layer, tests, tooling
- [ ] `pnpm db:seed`, `pnpm db:reset`, and `scripts/test-backend.sh` complete and
      exit (`DAT-1.1`); TRUNCATE is guarded (`DAT-3.1`).
- [ ] `pnpm typecheck`, `pnpm lint`, and the backend test suite are green with 0
      failing tests, and the previously-orphaned tests run (`DAT-2.2`/`DAT-3.4`).
- [ ] `invoiceNumber` and all document numbers are tenant-scoped-unique and
      race-safe (`FIN-H1`/`SEC-M14`/`DAT-1.2`).
- [ ] `.filestore` is untracked and gitignored; no stray files remain in
      `apps/backend/prisma/`; `pnpm audit --prod` shows only justified residual
      advisories (`DAT-3.3`/`DAT-3.5`/`DAT-2.4`).

### Enhancements (Phase 5)
- [ ] Each shipped enhancement (offline-first, RFIs/submittals, drawings, punch
      list, inventory loop, portals, accounting export, labour, multilingual) has
      migrations, validators, endpoints, hooks, responsive screens, and tests, and
      respects all Global Engineering Rules.

---

*This prompt and its findings register were produced from a six-part audit of the
BuildFlow repository. Treat the payment-webhook flaw as the highest priority; it
was confirmed independently by two audits.*
