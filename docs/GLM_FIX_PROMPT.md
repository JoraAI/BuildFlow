# BuildFlow — Standalone Fix Prompt for GLM-5.2 (Round 22 — VAR-D2 polish + convert-to-BOQ)

> **You do not need any prior conversation or other documents.** This file is the
> complete task brief. Read it top to bottom, then execute **Section 2** in order.
> [`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md) is optional background history only.
>
> **Repo:** `/home/prasanna/work/BuildFlow` (Turborepo monorepo, pnpm workspaces)  
> **Last committed baseline:** `b6ef712` (`main` ahead of `origin/main` by 12 commits)  
> **Verified:** 2026-08-05 — Round 22 polish **EST-VO-11e/f complete** (`b6ef712`, 116/116
> tests ×2, tsc ×2). **VAR-D2** convert-to-BOQ and **EST-VO-11g** deep-link remain
> deferred until product asks. Run §2.1 gates before/after.

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
5. **Competitive feature depth.** Match Indian construction SaaS expectations.

---

## 2. Round 22 — Complete; VAR-D2 deferred

**Round 21 (`5d61c48`):** Variations on estimate page + `estimateId` link.  
**Round 22 polish (`b6ef712`):** Query invalidation on CO mutations + seed/backfill.

**Remaining (do not start without product sign-off):**

- **EST-VO-11g** — Deep-link tap to specific variation from estimate page (optional UX)
- **VAR-D2** — Explicit convert-to-BOQ step (§2.2b); approve still writes BOQ today

**Do not** break Rounds 12–22 (single-line form, estimateId link, cache invalidation, shortfalls, frozen baseline).

### 2.0 Status (`b6ef712`)

| ID | Task | Status | Notes |
| -- | ---- | ------ | ----- |
| **VAR-C1–C9** | Variation line editor | **Done** | `433f10b` |
| **EST-VO-11a–d** | estimateId + list API + VariationsSection | **Done** | `5d61c48` |
| **EST-VO-11e** | Invalidate variations query on CO mutations | **Done** | `b6ef712` — `invalidateEstimateVariations` |
| **EST-VO-11f** | Seed/backfill `estimateId` | **Done** | `b6ef712` — VO-001 + backfill script; VO-002 seed still null (minor) |
| **EST-VO-11g** | Deep-link to specific variation | **Deferred** | Optional UX |
| **VAR-D2** | Explicit convert-to-BOQ step | **Deferred** | Approve still writes BOQ today |
| **Ship gate** | 116/116 ×2 + tsc ×2 | **Green** | |

### 2.0a Prior rounds — do NOT re-break

| ID | Task | Status | Evidence |
| -- | ---- | ------ | -------- |
| **VO-B / R12–14** | Approve → BOQ/budget; shortfalls; impact UI; Via CO chips | **Done** | `804f0a6`–`e686c21` |
| **VAR-C1** | Explode no duplicate lines (same line) | **Done** | `f055465` — superseded by VAR-C9 UX |
| **VAR-C2** | Remove line (min 1) | **Done** | `f055465` |
| **VAR-C3a/b** | MaterialPicker + RateAnalysisPicker | **Done** | `dbac1aa` |
| **VAR-C4** | Adjust vs new scope copy + FlowHint | **Done** | `f055465` — update copy in VAR-C9 |
| **VAR-C5–C6b** | Ship gate + RA persist + shortfalls | **Done** | `dbac1aa`–`1145896` |
| **VAR-C9** | Single-line BOQ/RA; no Split; BOQ dedupe; all 5 types | **Done** | `433f10b` |
| **EST-VO-11a–d** | estimateId + variations on estimate page | **Done** | `5d61c48` |
| **EST-VO-11e/f** | Cache invalidation + seed/backfill | **Done** | `b6ef712` |

### 2.0a Completed in Rounds 8–14 — do NOT re-break

| Area | What landed |
| ---- | ----------- |
| **804f0a6–e686c21** | Variation approve → BOQ/budget; shortfalls path; impact UI; Via CO chips |
| **VAR-B1–B5** | BOQ-scoped materials, RA components, explode helper (`7dc4da5`) |
| **58489eb** | Vendor bills, permissions (Round 10) |

Preserved from Rounds 3–7 — see §2.0c legacy table below.

### 2.0b Product model — line types and paths (authoritative)

**Variations are not materials-only.** Same five types as estimate (`VariationsTab.tsx`
`LINE_TYPES`): **MATERIAL, LABOUR, EQUIPMENT, SUBCONTRACTOR, MISC**.

| Line type | New scope (BOQ = "New") | Adjust existing BOQ (BOQ chip) |
| --------- | ----------------------- | ------------------------------ |
| **MATERIAL** | Type chip + optional `MaterialPicker` | **One line** + BOQ chip + qty Δ |
| **LABOUR** | Type chip + optional `RateAnalysisPicker` | **One line** + BOQ chip + qty Δ |
| **EQUIPMENT** | Type chip + optional `RateAnalysisPicker` | **One line** + BOQ chip + qty Δ |
| **SUBCONTRACTOR** | Type chip + optional `RateAnalysisPicker` | **One line** + BOQ chip + qty Δ |
| **MISC** | Type chip only | **One line** + BOQ chip + qty Δ |

**Rules:**

1. **Rate Analysis = one line** on this form (new scope via picker, or BOQ with RA).
   Never explode RA into material/labour/equipment rows in the variation draft UI.
2. **BOQ chip = one line** with `boqItemId`; qty Δ adjusts that BOQ row on approve.
3. **One BOQ id per draft** — disable chips already used on another line (VAR-C9b).
4. **Backend shortfalls** may RA-explode after approve — that is separate (VAR-C6b).

| Intent | UI | On approve |
| ------ | -- | ---------- |
| **Adjust existing BOQ qty** | One line + BOQ chip + qty Δ | `BOQItem.quantity += qtyDelta` |
| **Add new scope** | Type + material **or** RA (**single line**) | New `BOQItem` `category: 'VARIATION'` |

**Reuse estimate patterns** (Remove, type chips, pickers — **not** Split):

- `components/estimation/EstimateBuildStep.tsx`
- `components/estimation/RateAnalysisPicker.tsx`
- `components/materials/MaterialPicker.tsx`

### 2.0c Completed in Rounds 3–7 — do NOT re-break

| Area | Fix (file / pattern) |
| ---- | -------------------- |
| **EST-C1** | `boq.service.ts` — material demand uses `topLevelEstimateItems` only |
| **EST-M8** | `estimate-export.service.ts` — RAs by `item.rateAnalysisId` |
| **EST-M11** | `subcontract.service.ts` — `updateMeasurement` validation |
| **FIN-H5 / R2-7** | `tally.service.ts` — retention ledger; `normalizeStateCode()` |
| **FIN-M1 / FIN-M9** | `gst.service.ts` paise helpers; `analytics.service.ts` cash baseline |
| **R2-6** | `procurement.service.ts` — PO lines by `boqItemId` |
| **NR-34** | `lib/status-transition.ts` + guarded RFI/submittal/punch/petty-cash |
| **NR-41/53/54/40/35/49** | Mobile UI + offline URLs + CSV injection |
| **NR-55** | `resource-bulk.test.ts` — `todayDateOnly()` not UTC ISO for bulk-price dates |
| **Portal routing** | `app.ts` — `/api/portal/*` before auth catch-all |
| **Phase 5** | punch-list, petty-cash, drawings, RFI/submittal, portal-enhanced, etc. |
| **Tests** | `phase5.test.ts`, estimate-links unskipped, 98 tests total |
| **Tenant / security** | prisma write scoping, webhook HMAC, compression/auth, MCP scoping |

### 2.1 Ship gates — run before AND after every change

```bash
cd /home/prasanna/work/BuildFlow

npx tsc --noEmit -p apps/backend
npx tsc --noEmit -p apps/mobile
pnpm --filter @buildflow/backend test
pnpm --filter @buildflow/backend test   # must match previous run
pnpm install --frozen-lockfile

DATABASE_URL="postgresql://buildflow:buildflow@localhost:5432/buildflow_test?schema=public" \
  pnpm --filter @buildflow/backend exec prisma migrate deploy
```

**Regression on any gate = stop and fix before continuing.**

**After pulling VAR-C6+ code (`a251b25`+), dev DB must apply migration
`20260804180000_change_order_line_rate_analysis_id` or BOQ/variation APIs 500:**

```bash
cd /home/prasanna/work/BuildFlow/apps/backend
pnpm exec prisma migrate deploy
pnpm exec prisma generate
# restart backend dev server
```

### 2.2a Completed Round 22 polish — reference (do NOT re-break)

| Task | Evidence |
| ---- | -------- |
| EST-VO-11e | `invalidateEstimateVariations()` in `project-query-invalidation.ts`; wired in create/submit/reject mutations + `invalidateChangeOrderImpact` (approve) |
| EST-VO-11f | Seed `NH-65 Baseline Estimate` + `VO-001.estimateId`; `scripts/one-off/backfill-change-order-estimate-id.ts` |

**Minor seed gap (optional):** `VO-002` in seed still has null `estimateId` despite comment — add `estimateId: estimate1.id` if demo parity matters.

### 2.2b VAR-D2 — Explicit convert-to-BOQ (Phase 2 — product sign-off required)

**Today:** `approveChangeOrder` already creates/updates BOQ rows (R12–19). Shortfalls
(VAR-C6b) depend on those BOQ rows existing after approve.

**Future product ask:** mirror sub-estimate flow — variation approved first, then user
clicks **"Convert to BOQ"** on the estimate page.

If implementing VAR-D2 later:

1. Split approve into **(a)** status → APPROVED + budget/schedule side-effects and
   **(b)** BOQ write in `POST /change-orders/:id/convert-to-boq`.
2. Add `boqAppliedAt` (or `convertedToBoqAt`) on `ChangeOrder` to prevent double-apply.
3. Keep VAR-C6b tests green — shortfalls must still see VARIATION BOQ rows **after**
   convert, not after approve.
4. Until VAR-D2 ships, **Phase 1 must not remove** approve-time BOQ writes.

**Ship gate (Round 22 polish):** `tsc` ×2 + backend tests **116/116** ×2.

### 2.2c Completed Round 21 — reference (do NOT re-break)

| Task | Evidence |
| ---- | -------- |
| EST-VO-11a | `createChangeOrder` sets `estimateId`; FK migration `20260805020000` |
| EST-VO-11b | `GET /estimates/:id/variations` + `listVariationsByEstimate` |
| EST-VO-11c | `VariationsSection` in `estimation/[id].tsx`; `useEstimateVariations` |
| EST-VO-11d | Amber warning cards vs green sub-estimates |
| Test | `change-order.test.ts` — estimateId + list-by-estimate |

**Dev DB:** After pull, run `pnpm exec prisma migrate deploy` in `apps/backend`
(migration `20260805020000_change_order_estimate_relation`).

### 2.2a Completed in Rounds 8–19 — do NOT re-break

| Area | What landed |
| ---- | ----------- |
| **804f0a6–1145896** | Approve → BOQ/budget; shortfalls (incl. VAR-C6b); impact UI; line editor |
| **VAR-C3** | MaterialPicker + RateAnalysisPicker for **new scope** (single line) |
| **58489eb** | Vendor bills, permissions (Round 10) |

Preserved from Rounds 3–7 — see §2.0c legacy table below.

**Reuse estimate patterns** (Remove, type chips, pickers — not Split):

- `components/estimation/EstimateBuildStep.tsx`
- `components/estimation/RateAnalysisPicker.tsx`
- `components/materials/MaterialPicker.tsx`

### 2.4 Wording guide (use consistently)

| Context | Avoid | Use |
| ------- | ----- | --- |
| Material after GRN | Create Bill | **Record vendor bill** / **Register supplier invoice** |
| Generic accounting entry | — | New bill / Record vendor bill |
| Subcontract measurement approve | — | Keep internal "Generate payable" semantics in code; UI may say **"Approve & record payable"** if you touch it — do not conflate with tax invoice |
| User-facing field | Bill Number (alone) | **Supplier invoice no.** (with helper: "As printed on vendor's tax invoice") |
| GRN success toast | — | Keep "Site stock updated" — do not mention billing |
| Variation approve success | "Estimate updated" | **BOQ updated** / **Revised scope** (estimate baseline unchanged) |
| Variation line — adjust BOQ | "New item" only | **Link BOQ** + qty Δ |
| Variation line — new scope | Materials only | **All types:** Material, Labour, Equipment, Subcontractor, Misc |
| Variation line — RA on form | Split RA into components | **One line per RA**; backend explodes for shortfalls after approve |
| Variation line — BOQ link | Split into materials button | **One line per BOQ**; qty Δ on composite row |
| Split materials | Split / explode on form | **Removed (VAR-C9)** — use Remove line instead |
| Remove variation line | (missing) | **Remove** (min 1 line) |
| Post-approve next step | (silent) / auto-indents | **Review shortfalls** / **View BOQ** |
| Estimate page child — sub-estimate | (only sub-estimates listed) | **Sub-Estimate** — planned additional scope; green/primary |
| Estimate page child — variation | (variations only on project tab) | **Variation (CO-xxx)** — change order; **amber/warning**; linked via `estimateId` |
| Variation → BOQ (Phase 2) | Auto on approve (today) | Optional **Convert to BOQ** button on estimate page (VAR-D2); until then approve still writes BOQ |
| Shortfalls tab | — | Helper: *Uses current BOQ qty (includes approved variations)* |
| Negative variation qty | — | Warn: *Open indents are not auto-reduced* (optional R13-O3) |
| Bill upload / AI | — | **Upload invoice** / **Extract with AI** / **Import vendor bills** |
| Users without `bill.create` | Show disabled actions that 403 | Hide via `PermissionGate`; assistant refuses |

### 2.5 Codebase patterns (keep following)

Validate middleware; public routes before auth catch-all; migrations in folders;
`nextSequentialNumberTx`; `status-transition.ts`; viewport tiers; paise money math;
**tests use `todayDateOnly()`** for IST-validated date fields.

### 2.6 Anti-patterns — do not repeat

| Anti-pattern | Prevention |
| ------------ | ---------- |
| Auto-create vendor bill on GRN | GRN = stock only; bill = separate user action |
| Label "Create Bill" for supplier tax invoice | Use §2.4 wording |
| Exploded lines keep `boqItemId` | N/A after VAR-C9 — no form explode |
| Split / RA expand on variation form | **Removed VAR-C9** — single line; backend shortfalls only |
| Same BOQ on multiple draft lines | **One BOQ per draft (VAR-C9b)** |
| Variations materials-only | Support all five `LINE_TYPES` on new scope |
| Variation lines without Remove | Add Remove like estimate (VAR-C2) |
| Full catalog when BOQ linked for qty adjust | One BOQ line + qty Δ only (VAR-C9) |
| Role-based bill gates on **mobile** | Use `usePermission('bill.create')` (R9-B1); backend already fixed |
| LLM auto-creates bills without review | Extract → review UI → user confirms → create |
| Chatbot creates bills for unauthorized users | `buildPermissionAwarePrompt` + API `403` |
| Duplicate RA explode logic ad hoc | Reuse `fetchBoqMaterialDemands` / shared helper for variation indents (VO-B2) |
| Auto-indent raw qtyDelta on composite BOQ | **Removed** in VO-B2 — do not re-add |
| Re-add auto-indent on variation approve | Single shortfall path only (VO-B2) |
| Tell users "estimate updated" on variation | Estimate baseline frozen; show **revised scope** derived total |
| `VARIATION` BOQ rows invisible to shortfalls | Include in `fetchBoqMaterialDemands` (VO-B3) |
| `purchaseOrderId` in snapshot but not on row | Persist FK in `createBill` |
| UTC dates in tests vs IST validators | Use `todayDateOnly()` in tests (NR-55) |
| Stray files (`prisma/m`, extensionless routes) | Edit live files only |
| Public route after auth router | Mount `/api/portal` before `/api` estimate router |
| Ship stub sync route | Keep `/api/sync` unmounted |
| Re-breaking completed fixes | See §2.0c |
| Variations invisible on estimate page | EST-VO-11c `VariationsSection` under parent estimate |
| `estimateId` never set on ChangeOrder | EST-VO-11a on create |
| Variations modeled as Estimate rows | Keep `ChangeOrder` — estimate page is a directory only |
| Removing approve → BOQ without VAR-D2 | Phase 1 visibility only; BOQ write stays on approve |
| Stale variations list on estimate page | EST-VO-11e — invalidate on CO mutations |

### 2.7 Definition of Done

**Rounds 12–20 (done — do not regress):**

- [x] Variation approve → BOQ/budget; shortfalls; VAR-C6/C6b; line editor pickers
- [x] VAR-C9a–c — Single-line BOQ/RA form (`433f10b`)
- [x] Ship gate tsc ×2 (test count now **116** after Round 21)

**Round 21 (EST-VO-11 — done `5d61c48`):**

- [x] EST-VO-11a — `estimateId` set on variation create (latest approved parent estimate)
- [x] EST-VO-11b — `GET /estimates/:id/variations` (+ integration test)
- [x] EST-VO-11c — `VariationsSection` on estimate detail (distinct from sub-estimates)
- [x] EST-VO-11d — Copy/visual distinction in UI
- [x] Ship gate **116/116** ×2 + tsc ×2

**Round 22 polish (done `b6ef712`):**

- [x] EST-VO-11e — Invalidate `['estimates', *, 'variations']` on CO create/submit/approve/reject
- [x] EST-VO-11f — Seed VO-001 `estimateId` + backfill script
- [ ] EST-VO-11g — Deep-link to specific variation from estimate page (optional)
- [ ] EST-VO-11f minor — Seed `VO-002.estimateId` (optional demo parity)
- [ ] VAR-D2 convert-to-BOQ — **deferred** until product sign-off (§2.2b)

### 2.8 Optional hardening (defer unless user asks)

| ID | Task |
| -- | ---- |
| **Phase 5 gaps** | Smoke tests for inventory-traceability, accounting-export, labour, i18n |
| **NR-36** | Drawing acknowledgement endpoint |
| **Sync §8.1** | Remount `/api/sync` (needs `updatedAt` + mobile replay) |
| **DAT-3.8** | Remove `--forceExit` from jest |
| **SEC-L17/21/22** | Security polish |
| **Push** | `git push origin main` — only when user asks |

---

### APPENDIX — Prior rounds (completed; reference only)

<details>
<summary>Rounds 4–15 (superseded by §2 above)</summary>

Rounds 8–22: variation sync + estimate-page children + polish complete
(`804f0a6`–`b6ef712`). Next: VAR-D2 convert-to-BOQ or EST-VO-11g when product asks.

</details>

<!-- Legacy sections below for audit trail; Section 2 wins on conflict. -->

## 3. Global Engineering Rules (apply to every change)

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

# APPENDIX — Historical work order (Phases 0–5, Rounds 1–2)

> **Execute Section 2 only.** The sections below are the original Round-1 phased
> plan. Most items are already fixed in the working tree; they remain for context.

## 4. Phase 0 — Stop-the-Bleeding: Security & Data Integrity

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

## 5. Phase 1 — Financial & Workflow Correctness

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

## 6. Phase 2 — Mobile / Web App Reliability

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

## 7. Phase 3 — Responsive, Professional UI on Every Device (explicit user priority)

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

## 8. Phase 4 — Data Layer, Tests & Repo Hygiene

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

## 9. Phase 5 — Peer-Benchmarked Enhancements (be better than the competition)

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

## 10. Execution Protocol for GLM-5.2

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

## 11. Definition of Done — Acceptance Checklist (Round 1)

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

---

# Round 2 — Remediation of the First Fix Pass

You (GLM-5.2) already made a first pass (commit `66a40eb` + uncommitted edits). It
was independently re-verified. The results and the exact residual/new issues are
in the **"Remediation Review — Round 1"** section of
[`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md). Good progress — the payment-webhook
forgery, MCP auth, tenant write-scoping, invoice numbering, CPM FF formula, the
seed hang, and the test suite are genuinely fixed. This round closes the rest.

**Before writing any code, read the Round-1 review in full.** Then work in the
priority order below. Do not re-touch the FIXED items.

## R2.0 — Anti-patterns that caused the rework (read first, do not repeat)

The first pass failed verification in recurring ways. These are now hard rules:

1. **Edit the real file, not a new one.** The `useViewport` fix was written to a
   new extensionless file `apps/mobile/hooks/use`; the live hook was never
   changed. Never create a near-duplicate file — modify the module that is
   actually imported, and confirm with a grep of its import sites.
2. **Every Prisma schema change ships a migration in the same change.** The
   `AuditLog @map("old_value")` edit had no migration and broke audit logging at
   runtime. After any `schema.prisma` edit, generate the migration and run it
   against a fresh DB before claiming done.
3. **Do not reference fields/columns that don't exist.** The Tally bill split
   reads `bill.vendorState`, which is not on the model. If a fix needs a new
   field, add it to the schema (+ migration + query select) first.
4. **A `// FIX(...)` comment must correspond to a real behavior change.** Do not
   annotate no-ops (`clientState ?? undefined`) or mislabel one fix as another.
   Comments that claim a DB CHECK constraint or a lock must point at code/SQL that
   actually creates it.
5. **Transactions must contain the read they guard.** TOCTOU guards (invoice
   payment, GRN over-receive, RA sequence) must read the current value *inside*
   the `$transaction` and use guarded/relative writes, not read-then-write across
   the boundary.
6. **Never swallow errors to make a test pass.** `.catch(console.error)` around
   audit logging or BOQ posting hides broken behavior. Fix the cause; if a step
   can legitimately fail, make it a tracked, retryable side-effect.
7. **Regenerate and commit `pnpm-lock.yaml`** whenever `package.json` changes, and
   verify `pnpm install --frozen-lockfile` succeeds.
8. **Date migrations with today's date.** Do not backdate migration folder
   timestamps below already-applied migrations; that corrupts history ordering.
9. **Do not reduce coverage to get green.** Re-enable the `it.skip`-ed
   link-integrity test and fix the underlying open-handle hang instead.

## R2.1 — Fix the new regressions first (blockers)

- **NR-1 (critical):** add a migration renaming `audit_logs."oldValue"` →
  `old_value` (or revert the `@map`); verify `recordAudit` succeeds and the test
  console is free of `old_value` Prisma errors.
- **NR-3 (high):** run `pnpm install`, commit the updated lockfile, confirm
  `--frozen-lockfile` passes; register `shims/react-native-netinfo.ts` in
  `metro.config.js` or delete it; verify a native bundle resolves NetInfo.
- **NR-2 (high):** move the width-driven hook body into
  `apps/mobile/hooks/useViewport.ts`, delete `apps/mobile/hooks/use`, and confirm
  the tablet/desktop layout now renders on a native iPad. This also unblocks the
  UI-H3 tablet tier and the native side of UI-C2.
- **NR-4 (high):** add `vendorState` to the `Bill` model (+ migration + query
  select) or derive vendor state from `vendorGstin`, then split bill GST correctly
  by state; add a test with an intra- and an inter-state vendor.
- **NR-5 (high):** apply retention on `updateInvoice` for all invoice types, not
  just RUNNING_ACCOUNT.
- **NR-6..NR-13 (medium):** unit conversion instead of relabeling; stronger
  description matching (drop stopwords/rank/threshold); copy item `parentId` in
  `duplicateEstimate`; make measurement→BOQ posting transactional/reconciled;
  route `apiFetchList` through the shared refresh mutex; read-inside-transaction
  for invoice payment; real RA-sequence lock + tx-bound counter; accept or clearly
  block BOQ-only requisition lines end to end.
- **NR-14..NR-19 (low):** fix `amountInWords` powers (`1e9`/`1e11`); trim the MCP
  scoping list to models with `companyId`; correct the inverted role
  normalization; re-date the two backdated migrations; remove false CHECK-constraint
  comments (and add the real CHECK if intended); delete dead exports; make CPM
  cycle detection surface a clean 4xx and validate task predecessors (ties to
  FIN-H7).

## R2.2 — Complete the partial money/quantity fixes

- **EST-C1:** also exclude sub-items from **section subtotals** (and therefore the
  Excel/PDF export) and from **material-demand generation**
  (`buildMaterialDemandsFromEstimateItems` is passed all items). Add a
  parent+children test asserting section subtotal, export total, and generated
  demand are each un-doubled.
- **EST-C2:** compute the budget delta on a consistent basis (compare like with
  like — grandTotal vs previously-applied grandTotal), so re-converting an
  unchanged sub-estimate does not creep the budget.
- **EST-C3:** wrap archive + link-null + `createMany` + budget update in one
  `$transaction`.
- **EST-H1:** apply the per-resource stock/open-indent distribution to
  `createDraftIndentsFromDemand` (the path that actually creates indents), not
  only to `previewBoqShortfalls`.
- **EST-H7:** write a `MaterialPriceHistory` row in `bulkUpsertResources` too.
- **FIN-H2/H4:** move reads inside the transaction; add
  `@@unique([projectId, raSequence])` and use the tx-bound counter.
- **FIN-H3:** persist a `clientState` on `Invoice` (+ migration) and default to it
  (then company state) on update so intra-state invoices keep CGST/SGST.

## R2.3 — Then the untouched highs and Decimal money

- **EST-H4** (apportion GRN qty across req lines), **EST-H6** (line-`qtyDelta`
  endpoint + `costImpact` recompute), **EST-M13** (role guards on BOQ/convert/
  rate-analysis routes).
- **FIN-H7** (task-side predecessor/cycle validation), **FIN-H8** (exclude
  soft-deleted projects), **FIN-M1** (move invoice/bill/GST math to
  `Decimal`/paise with reconciled rounding), **FIN-M3** (IST date handling).
- Remaining FIN/EST mediums per the Round-1 tables.

## R2.4 — Proceed to Phases 3–5 as originally specified

Once R2.1–R2.3 are green (`pnpm typecheck`, `pnpm lint`, backend tests with **no
skipped tests and no swallowed audit errors**, and a native + web smoke test),
continue with the responsive-UI acceptance sweep (Section 6.7 — now unblocked by
NR-2) and the Phase 5 enhancements.

## R2.5 — Round-2 Definition of Done

- [ ] All NR-\* regressions are closed; audit logging works; `--frozen-lockfile`
      passes; a native iPad renders the tablet/desktop layout.
- [ ] No `schema.prisma` change lacks a migration; migrations are dated correctly;
      `prisma migrate reset` + seed + test run clean end to end.
- [ ] No error is swallowed to pass a test; the previously skipped test runs.
- [ ] Every partial from the Round-1 tables is either FIXED or has a written,
      justified reason it is deferred.
- [ ] The Round-1 review tables in [`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md) are
      updated to reflect the new statuses.

---

# Round 3 duplicate section — superseded by Section 2 (Round 7)

> **Execute Section 2 only.** Round 3 gates are closed. The R3.0–R3.7 subsections
> below are kept for reference; if they conflict with Section 2, **Section 2 wins**.

## R3.0 — Non-negotiable gates (do these first)

1. **`npx tsc --noEmit -p apps/backend/tsconfig.json` must exit 0.** Current
   failures are concentrated in Phase 5 files (see NR-20 in the findings doc).
2. **`pnpm --filter @buildflow/backend test` must be 20/20 suites green, 0
   failed, 0 skipped** (idempotent ×2).
3. **Every `schema.prisma` model must have a proper migration** under
   `prisma/migrations/<timestamp>/migration.sql`. Delete the stray
   `apps/backend/prisma/m` file after moving its SQL. **Never commit `prisma/m`.**
4. **`pnpm install --frozen-lockfile` at repo root with zero SDK mismatch**
   between `apps/mobile/package.json` and `pnpm-lock.yaml` (NR-24).

## R3.1 — Fix compile blockers (NR-20)

| File / area | Problem | Fix |
| ----------- | ------- | --- |
| `drawing.routes.ts`, `rfi-submittal.routes.ts` | `validate({ params, body })` wrapper schemas | Pass `validate({ params: z.object(...), body: z.object(...) })` matching existing middleware in other routes — copy a working route as template. **This is NR-31 — currently a silent runtime bypass, not just a compile error.** |
| `drawing.service.ts`, `rfi-submittal.service.ts` | `"UPLOAD"`, `"ANSWER"`, `"REVIEW"` not in `AuditAction` | Add enum values + migration, or use `CUSTOM` with a descriptive `actionLabel`. |
| `sync.service.ts` | `DailyReport` has no `updatedAt`; query uses it | Either add `updatedAt @updatedAt` to syncable models (+ migration) **or** delta-sync on `createdAt` only and document the limitation. Do not `.catch(() => [])` to hide Prisma errors. |
| `app.ts:73` | unused `req` | Remove or prefix with `_`. |
| New services | unused imports | Remove or use them. |

Run `tsc` after each fix until clean.

## R3.2 — Fix petty cash migration (NR-21)

1. Create `apps/backend/prisma/migrations/20260731100000_add_petty_cash/migration.sql`
   with the SQL currently trapped in `apps/backend/prisma/m`.
2. Verify it matches the `PettyCashEntry` model in `schema.prisma`.
3. Delete `apps/backend/prisma/m`.
4. Smoke-test `POST /api/petty-cash` after `prisma migrate deploy`.

## R3.1b — Phase 5 security & correctness (NR-31 … NR-49)

After compile fixes, address these before claiming Phase 5 "done":

1. **NR-31:** Fix all 6 broken `validate()` calls; add tests proving invalid
   status/enum values are rejected (RFI answer, submittal review, drawing version).
2. **NR-32:** Dedicated `document_counter` types for RFI and submittal numbers —
   never reuse `'invoice'`.
3. **NR-33 / NR-47:** Add `assertProjectAccess` to inventory traceability; sum stock
   across all project locations, not `findFirst`.
4. **NR-34:** Implement status transition whitelists for RFI, Submittal, PunchItem,
   PettyCashEntry (same pattern as change-order guarded `updateMany`).
5. **NR-35:** Fix `offline-sync.service.ts` replay URLs to match real attendance
   routes; add idempotency keys for punch/RFI queue items; surface failed replays in
   UI instead of infinite retry.
6. **NR-36:** Add `DrawingAcknowledgement` model + migration + acknowledge endpoint.
7. **NR-37:** For each §8 feature marked PARTIAL/BROKEN in the findings matrix —
   implement missing spec items **or unmount the route**. Do not ship stubs.
8. **NR-38 / NR-46:** Sync requires schema migrations (`updatedAt` on Task +
   DailyReport; fix DailyReport company scoping), honest delta filters, cursor
   pagination, validated `since`, and a push path — or unmount `/api/sync`.
9. **NR-43:** Add Phase 5 + SWO models and `DocumentCounter` to `TENANT_SCOPED_MODELS`
   in **both** backend and MCP `prisma.ts` (lists must match).
10. **NR-44:** Add missing unique index migration for `drawings.current_version_id`.
11. **NR-45:** Remove `project.budget` from public portal-enhanced payload (or scope-gate).
12. **NR-48:** Wire mobile `useTranslation()` to `constants/i18n.ts` or delete dead dict.
13. **NR-49:** Accounting export — formula-injection neutralization, row caps, drop
    false Excel claim or implement exceljs.

## R3.3 — Close remaining Round-1/2 NOT-FIXED items (priority order)

**Money & workflow (must fix before Phase 5 UI):**

- **R2-1 / EST-H6:** fix `updateChangeOrderLine` — pass real `co.projectId` to
  `assertProjectAccess`, not `''`.
- **EST-C1:** also filter sub-items out of `buildMaterialDemandsFromEstimateItems`
  call in `convertEstimateToBoq` (demand path still double-counts).
- **FIN-H5 (retention):** Tally `buildSalesVoucher` must balance when retention
  exists (party debit = credits + retention ledger line). R2-7: fix state-code
  fallback when company has no GSTIN.
- **R2-3:** add role guards to `estimate.routes.ts` (approve, convert-to-boq, mutations).
- **R2-6:** allow PO creation for BOQ-only requisition lines (null `resourceId`).
- **R2-11:** document RA partial unique index in schema or add a `// @@index` comment
  block so `migrate dev` won't drop `invoices_projectid_rasequence_unique`.
- **R2-13:** switch `createInvoice` to `nextSequentialNumberTx` inside the txn.
- **EST-M11:** add rate/qty/balance validation to `updateMeasurement` (match create path).
- **FIN-M1:** move invoice/bill line-item arithmetic to `Decimal`/paise end-to-end
  (GST step already fixed in paise).
- **EST-M8:** export "Rate Analysis Used" sheet from `item.rateAnalysisId`.
- **FIN-M9:** fix analytics cash baseline filter.
- **R2-12:** log or surface when incompatible-unit demand lines are skipped.

**Already fixed in Round 2 (do not re-break):** FIN-H8, EST-H4, FIN-H2, FIN-H3,
NR-5, EST-H7, FIN-M3, FIN-M6, EST-M14.

**Security / data lows (when cheap):**

- SEC-L16 (JWT min length in prod), SEC-L17 (generic errors), SEC-L20 (align body
  limit message), NR-15 (trim MCP scoping list), NR-16 (fix role normalization).

**Mobile:**

- **NR-51:** `ProcurementTab.tsx` — `resourceId: l.resourceId || undefined` for BOQ-only lines.
- **NR-52 / MOB-H6:** add `credentials:'include'` to `refreshAccessToken`; stop persisting
  `"undefined"` refresh token on web.
- MOB-C2: move post-refresh retry outside try/catch; guard `retryRes.json()`.
- NR-24: revert Expo SDK 51 manifest **or** complete SDK 52 upgrade (half-bump incoherent
  with SDK-51 deps like expo-router ~3.5).

**UI (tablet/desktop):**

- NR-41: align `Select.tsx` JS breakpoint with `md:` (768) or use `isTablet`.
- NR-53: constrain auth form width at 1024–1279 (or lower hero threshold).
- NR-54: safe-area inset on `AppTopBar` for native iPad desktop chrome.

## R3.4 — Cross-device UI polish (768–1023 tablet band)

Round 2 fixed UI-C1 (width-driven hook) and UI-H3 (flex master-detail). Round 3
tablet follow-ups (re-verified):

1. **NR-24:** revert SDK 51 manifest **or** regenerate lockfile for Expo 52 and
   smoke-test native — `--frozen-lockfile` currently fails CI.
2. **NR-39:** delete dead `app/(app)/reports-hub/index` (extensionless duplicate).
3. **NR-25:** in `app/(app)/_layout.tsx`, consider sidebar or icon rail when
   `isTablet` (768+) on web and native; add marketing nav fallback for 768–1023.
4. **NR-40:** fix `ScreenContainer` bottom padding for tablet + FAB clearance.
5. **NR-41 / UI-M8:** align `Select.tsx` centered picker with `isTablet` (768+),
   matching `AdaptiveSheet`.
6. **NR-42:** remove deprecated `columns` alias from `useViewport.ts`.
7. Re-run acceptance sweep at **360 / 768 / 1024 / 1280 / 1920** on web; document
   iPad portrait vs landscape.
8. Optional: desktop **data-table** for BOQ/estimate lines (UI-M14).

## R3.5 — Phase 5 features: complete or gate

GLM added backend modules for punch list, RFIs/submittals, drawings, inventory
traceability, labour, petty cash, portal-enhanced, sync, accounting export, and
i18n. **Do not merge compile-broken stubs.**

For each module, the Definition of Done is:

- [ ] Compiles (`tsc` clean)
- [ ] Migration matches schema
- [ ] Routes behind `authenticateToken` + tenant scope + appropriate
      `requireRole`/`requirePermission`
- [ ] At least one integration test
- [ ] Mobile screen (or explicit "backend-only, no mobile yet" in findings)

If a module cannot meet this bar in Round 3, **remove it from `app.ts` mounts**
and move files to a `feature/` branch folder — do not leave dead routes that 500.

**Offline-first (§8.1):** fix `sync.service.ts` properly (NR-20, NR-38); wire mobile
`offline-sync.service.ts` to show sync status and correct replay URLs (NR-35); do
not claim offline-first until delta sync works and mobile queues replay.

See the **Phase 5 per-module verdict table** in `AUDIT_FINDINGS.md` — punch list is
the only module genuinely done; petty cash/drawings/accounting export are close;
sync and i18n are not real implementations yet.

## R3.6 — Round-3 Definition of Done

- [ ] `tsc --noEmit` clean (backend + mobile if applicable) — **do not rely on jest
      passing as a compile gate** (`isolatedModules` hides Phase 5 errors)
- [ ] `pnpm --filter @buildflow/backend test`: 20/20 suites, 0 failed, 0 skipped;
      idempotent across two consecutive runs (NR-55)
- [ ] `prisma migrate reset` + seed + test pipeline exits cleanly
- [ ] No stray files: `prisma/m`, extensionless hooks/routes (`hooks/use`,
      `reports-hub/index`), migrations outside folder
- [ ] `--frozen-lockfile` passes with no Expo SDK mismatch
- [ ] Round-2 review tables in `AUDIT_FINDINGS.md` updated for every item touched
- [ ] Tablet band (768–1023) manually verified on web; iPad landscape ≥1024 shows
      sidebar
- [ ] Phase 5: each mounted route either WORKING (with test) or unmounted

## R3.7 — Anti-patterns (still apply — third strike)

If GLM writes a migration to `prisma/m`, a hook to `hooks/use`, or a schema
change without a migration folder again, **stop and fix the process** before
continuing. Three occurrences of the same mistake means the prompt must be
followed line-by-line with a checklist per PR.
