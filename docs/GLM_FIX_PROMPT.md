# BuildFlow — Standalone Fix Prompt for GLM-5.2 (Rounds 33–34 complete)

> **You do not need any prior conversation or other documents.** This file is the
> complete task brief. Read it top to bottom before taking new work.
> [`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md) is optional background history only.
>
> **Repo:** `/home/prasanna/work/BuildFlow` (Turborepo monorepo, pnpm workspaces)  
> **Last committed baseline:** Round 34 — `3493baa` (RATE-EST1 + RPT-UI1a+ cleanup)  
> **Verified:** 2026-08-05 — Rounds 12–34 complete. **131/131** tests.
>
> **Active work:** None mandatory. Optional stretch: **§2.13** RPT-UI2 / RPT-UI1a-5 · **§2.15.4** VariationsTab + rate badge.

---

## 2.9 Round 29 — Subcontract measurement & material-issue UX

**User report (2026-08-05):** The subcontract **measurement sheet** modal and **materials from site stock**
panel work functionally but feel like developer stubs — especially material issue, which asks for a raw
**resource UUID** instead of showing project stock the user can pick from.

**Round 29 status:** **COMPLETE** (29a core · 29b list/invalidation · 29c polish/modal) — see §2.9.11.
Do not re-break SUB-UX deliverables or Rounds 12–28.

### 2.9.0 How material issue works today (read before coding)

| Step | Behaviour |
| ---- | --------- |
| WO supply mode | `materialSupplyMode`: `NONE` (hide panel), `GC_SUPPLIED`, or `MIXED` |
| Issue | `POST …/material-issues` — creates a **new ledger row** per issue; deducts `StockBalance` at project store |
| Recover | `POST …/material-issues/:id/recover` — partial/full return; restores stock |
| List | `GET …/material-issues` — all rows for WO, newest first |
| Rate/qty | User supplies qty, unit, rate at issue time; amount = qty × rate |
| Stock check | Backend rejects if `availableQty < requested` (`subcontract.service.ts`) |

**Important product rule:** There is **no PATCH** on an existing issue row. Multiple issues for the same
resource are valid (construction ledger). The UI should **group/display by resource** and offer
**"Issue more"** (another POST with pre-filled material) — not imply users can edit a past issue's qty.

**Reference implementation (copy patterns, do not duplicate blindly):**

- `apps/mobile/app/(app)/reports/create.tsx` — `MaterialUsageSection`: `useStockSummary`, `MaterialPicker`,
  `projectMaterials`, inline qty, on-hand validation, rate resolution via `/resources/:id/rate`
- `apps/mobile/components/materials/MaterialPicker.tsx` — project stock first, catalog search second
- `apps/mobile/components/projects/SubcontractsTab.tsx` — `MaterialsPanel` (lines ~584–768), `MeasurementsPanel` (~291–581)

**Hooks already exist:** `useStockSummary`, `useMaterialIssues`, `useIssueMaterial`, `useRecoverMaterial`,
`useBoq` (for BOQ-linked materials).

### 2.9.1 SUB-UX1 — Materials from site stock panel

**File:** `apps/mobile/components/projects/SubcontractsTab.tsx` → `MaterialsPanel`

**Remove:** Raw `Resource ID` / UUID `TextInput` in issue modal.

**Replace with:**

1. **Stock-first picker**
   - `useStockSummary(projectId)` + optional `useBoq(projectId)` → build `projectMaterials` (same union
     logic as daily report: on-hand stock rows + BOQ-linked materials).
   - Reuse `MaterialPicker` inside the issue sheet; show **on-hand balance** per row (`72 bags` style).

2. **Issue form (after material selected)**
   - Auto-fill **unit** from resource; auto-suggest **rate** via
     `GET /projects/:projectId/resources/:resourceId/rate` (optional `?boqItemId=`).
   - **Qty** input with live validation: `qty ≤ onHand` (show red helper if over; disable Issue button).
   - Optional **issue date** (default today) and **notes** (collapsed/advanced).
   - Primary CTA: **Issue to subcontractor**.

3. **Issued materials list — ledger UX**
   - **Group by `resourceId`** in the UI (aggregate issued / recovered / net qty and amount).
   - Each group shows: material name, total issued, recovered, **net on WO**, last issue date.
   - Actions per group:
     - **Issue more** — opens issue sheet with material pre-selected (focus qty).
     - **Recover** — inline qty + confirm (keep existing recover API).
   - Expand group to see individual issue rows (date, qty, rate, who issued).
   - Empty state: icon + "No materials issued yet" + CTA **Issue from stock**.

4. **Summary strip** (when issues exist)
   - Mirror WO summary: `Issued`, `Recovered`, `Net material on WO` (₹) — use list data or
     `useWorkOrderSummary` totals.

5. **Permissions** — unchanged: `OWNER`, `PM`, `STORE_INCHARGE` can issue/recover.

**Do NOT:**

- Add PATCH endpoint for material issues unless you also add tests and audit trail (defer).
- Block measurement submit when no materials issued (existing rule).
- Break recover flow or PDF material tables.

### 2.9.2 SUB-UX2 — Measurement sheet panel

**File:** `apps/mobile/components/projects/SubcontractsTab.tsx` → `MeasurementsPanel`

**List view improvements:**

1. **Card layout** — period label, status badge, total amount (keep), but add:
   - Line count chip (`4 lines`)
   - **Expand/collapse** to show all lines (not truncated at 3 with "+N more" only).
   - Linked bill hint when `APPROVED` (bill number if available in response).

2. **Status actions** — keep Submit / Approve / Reject / PDF buttons; group primary vs secondary visually
   (primary = Submit/Approve; ghost = PDFs).

**New measurement modal improvements:**

1. **Period field** — placeholder chips: `Jan 2026`, `Feb 2026`, `Week 1`, or auto-suggest current month.

2. **Copy from contract lines** (already exists) — enhance:
   - Only copy lines with `balanceQty > 0`.
   - Show **balance qty** and **contract rate** on each draft line when `workOrderLineId` is set
     (read-only hint: "Balance: 120 sqm").
   - Warn (don't block) if entered qty > balance.

3. **Line editor** — table-like on desktop (`useViewport().isDesktop`):
   - Columns: #, Description, Qty, Unit, Rate, Amount.
   - Row amount live-calculated; running **subtotal** sticky in footer.
   - Remove line control clearer (trash icon, not tiny text link).

4. **Add line** — second path besides blank line: **Pick from WO lines** sub-sheet listing contract
   lines with balance > 0 (one tap adds pre-filled row).

5. **Validation messages** — inline under fields (period required, at least one line, qty > 0).

**Do NOT:**

- Change measurement approval → bill generation semantics.
- Change backend measurement schemas unless validation gap found (prefer client-side first).

### 2.9.3 Optional small backend tweak (only if mobile can't do it cleanly)

| ID | Task | When |
| -- | ---- | ---- |
| **SUB-UX1b** | `GET …/material-issues` add optional `?groupBy=resource` aggregated summary | Only if grouping logic in mobile becomes unwieldy (>80 lines duplicated) |

Default: **implement grouping in mobile** from existing list response.

### 2.9.4 Tests & ship gate

| Gate | Requirement |
| ---- | ----------- |
| Backend tests | Stay **129/129** (no regressions on subcontract integration tests) |
| Backend tsc | Pass |
| Mobile tsc | Pass |
| Manual | GC_SUPPLIED WO → issue material via picker (not UUID) → appears in grouped list → Issue more → Recover |

**Optional test (add if easy):** Extend `subcontract.test.ts` or `pdf-report.test.ts` assertion that
material issue list returns `resource.name` after issue (already likely covered).

### 2.9.5 Definition of done (Round 29 — COMPLETE)

- [x] **SUB-UX1 (core)** — MaterialPicker + stock balances; no UUID field; grouped issued list; Issue more + Recover
- [x] **SUB-UX1 polish** — stock invalidation (`48fe998`); BOQ union + rate API + qty≤onHand (`ed0f16a`)
- [x] **SUB-UX2 (list)** — line-count chip + expand/collapse lines (`251a897`)
- [x] **SUB-UX2 (modal)** — period chips, balance hints, desktop table, pick-from-WO-lines (`ed0f16a`)
- [x] Ship gate: 129/129 tests, mobile + backend tsc clean
- [x] Do not re-break SUB-C supply mode, PDF material tables, or Rounds 12–23 variations

### 2.9.7 Round 29a verification (2026-08-05 — do NOT revert SUB-UX1 core)

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **129/129** tests ✓

**API flow exercised** (NH65 seed, `owner@reddyconst.com`):

| Step | Result |
| ---- | ------ |
| Create `GC_SUPPLIED` WO with 2 contract lines | 201 |
| Issue material (OPC Cement, qty 2) via API | 201 |
| Issue more (same resource, qty 1) | 201 — 2 ledger rows |
| Recover 1 from first issue | 200 |
| Summary `netMaterialOnWO` | ₹700 |
| Create measurement `Aug 2026` with WO line link | 201, total ₹4500 |

**SUB-UX1 delivered in mobile (`MaterialsPanel`):**

- `MaterialPicker` + `useStockSummary` (no UUID field)
- Grouped by resource; expand for individual issues
- Summary strip: Issued / Recovered / Net on WO
- **Issue more** pre-fills material; **Recover** per issue row
- Empty state + "Issue from stock" CTA

**SUB-UX1 gaps (→ §2.9.10 Round 29c):**

- No `GET …/resources/:id/rate` auto-fill on select
- No client-side `qty ≤ onHand` (backend rejects only)
- `projectMaterials` = stock only (no BOQ union like daily report)

**SUB-UX2 gaps (→ §2.9.10 Round 29c):**

- New-measurement modal unchanged (no balance hints, period chips, desktop table, pick-from-WO-lines)

### 2.9.9 Round 29b verification (2026-08-05 — do NOT revert)

**Commits:** `48fe998` (stock invalidation) · `251a897` (measurement list expand)

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **129/129** tests ✓

**Delivered:**

| ID | What landed |
| -- | ----------- |
| **SUB-UX1b** | `useIssueMaterial` / `useRecoverMaterial` invalidate `['procurement','stock','summary',projectId]` — on-hand refreshes after issue/recover |
| **SUB-UX2a** | Measurement list: line-count chip; expand/collapse (2 lines collapsed → all expanded); "Show all N lines" toggle |

**Not delivered (commit message overstated — verify code, not message):**

| Claimed in `48fe998` message | Actual |
| ----------------------------- | ------ |
| BOQ union in `projectMaterials` | **Not in code** — still stock-only filter/map |
| qty≤onHand client validation | **Not in code** — Issue button always enabled |
| Rate API auto-fill | **Not in code** |
| Measurement modal improvements | **Not in code** — only list view changed |

### 2.9.8 Round 29b spec (completed items — reference)

<details>
<summary>Round 29b original spec (partially done)</summary>

**Done:** list expand (§2.9.9), stock invalidation (§2.9.9).

**Not done:** modal polish, rate API, qty validation, BOQ union — moved to §2.9.10.

</details>

### 2.9.10 Round 29c spec (completed — reference)

<details>
<summary>Round 29c original spec (done in ed0f16a)</summary>

All items delivered — see §2.9.11 verification.

</details>

### 2.9.11 Round 29c verification (2026-08-05 — do NOT revert)

**Commit:** `ed0f16a` — SUB-UX1 polish + SUB-UX2 modal

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **129/129** tests ✓

**SUB-UX1 polish delivered (`MaterialsPanel`):**

| Item | Evidence |
| ---- | -------- |
| BOQ ∪ stock `projectMaterials` | `useBoq` + Map union (~lines 813–841) |
| Rate API on select | `apiFetch(…/resources/${id}/rate)` in `MaterialPicker` onSelect |
| qty ≤ onHand validation | `qtyOverOnHand` + red helper + disabled Issue button |
| Stock refresh | Already in `48fe998` — unchanged |

**SUB-UX2 modal delivered (`MeasurementsPanel`):**

| Item | Evidence |
| ---- | -------- |
| Period chips | Current month, last month, week chip (~lines 326–597) |
| Balance hints | `getLineBalance()` + amber warn when qty > balance |
| Desktop table | Column header + row layout when `isDesktop` |
| Pick from WO lines | `woPickerOpen` sub-sheet; filters `balanceQty > 0`; dedupes existing `workOrderLineId` |

**Optional deferrals (not required for Round 29 done):**

- Issue date / notes field on material issue modal
- Approved measurement → linked bill number on list card
- Hide BOQ-only materials with zero on-hand from issue picker (backend still rejects insufficient stock)

### 2.9.10 Round 29c — Remaining work (was ACTIVE — now complete)

**Moved to §2.9.11.** Do not re-implement unless regressions found.

### 2.9.6 Anti-patterns (Round 29)

| Don't | Do instead |
| ----- | ---------- |
| Paste UUID for materials | `MaterialPicker` + `useStockSummary` |
| Single flat issue list only | Group by resource + expand detail |
| Imply PATCH edits history | "Issue more" = new POST |
| Truncate measurement lines forever | Expandable full line list |
| New backend endpoint without tests | Reuse existing issue/recover/list APIs |

---

## 2.10 Round 30 — Subcontract↔BOQ sync, team roles, picker polish (ACTIVE)

**User report (2026-08-05):**

1. When a subcontractor **takes stock**, BOQ should reflect it (site stock / consumption).
2. After selecting material in the issue flow, user can **unlink** (X) and lose the draft — needs an explicit **Save / Issue** step (button missing or unclear).
3. **Settings → Project Team** — only PM / SUPERVISOR / ACCOUNTANT assignable; other company roles missing.
4. **Material** and **Rate Analysis** dropdowns look plain — need professional picker UI.

**Do not re-break:** Round 29 SUB-UX, SUB-C supply mode, Rounds 12–28.

### 2.10.0 Product rules (read first)

| Topic | Current behaviour | Expected |
| ----- | ----------------- | -------- |
| Stock on issue | `issueMaterialToWorkOrder` deducts `StockBalance` + `StockMovement` (`SUBCONTRACT_ISSUE`) | Keep |
| BOQ `stockQty` | `boq.service.ts` aggregates `StockBalance` by `resourceId` | Should **drop** when stock issued |
| BOQ cache | `useIssueMaterial` invalidates stock summary but **not** BOQ query | **Bug** — BOQ tab stale until manual refresh |
| BOQ line link | `SubcontractorMaterialIssue` has no `boqItemId` | Optional link + display on BOQ (Phase 2) |
| Issue modal | Tap X on selected material → clears selection; footer posts immediately | Draft + explicit **Issue** confirm; warn on discard |
| Project roles | UI: `ASSIGNABLE_ROLES = ['PM','SUPERVISOR','ACCOUNTANT']` | All `INVITABLE_ROLES` + `SITE_SUPERVISOR` with labels |
| Backend roles | `setProjectMembersSchema` allows only 4 roles | Align with `INVITABLE_ROLES` in `@buildflow/shared` |

**Key files:**

| Area | Path |
| ---- | ---- |
| Material issue | `apps/backend/src/services/subcontract.service.ts` (`issueMaterialToWorkOrder`) |
| BOQ stock display | `apps/backend/src/services/boq.service.ts` (~lines 75–93) |
| Issue hooks / cache | `apps/mobile/services/expansion.queries.ts` (`useIssueMaterial`, `useRecoverMaterial`) |
| Invalidation | `apps/mobile/lib/project-query-invalidation.ts` |
| Issue UI | `apps/mobile/components/projects/SubcontractsTab.tsx` → `MaterialsPanel` |
| BOQ UI | `apps/mobile/components/projects/BoqTab.tsx` (shows `stockQty`) |
| Project team | `apps/mobile/components/projects/ProjectMembersSection.tsx` |
| Members API schema | `packages/shared/src/validators/portal.ts` → `setProjectMembersSchema` |
| Role enums | `packages/shared/src/enums/index.ts` (`INVITABLE_ROLES`, `ROLE_LABELS`) |
| Pickers | `apps/mobile/components/materials/MaterialPicker.tsx`, `apps/mobile/components/estimation/RateAnalysisPicker.tsx` |

### 2.10.1 SUB-BOQ1 — BOQ reflects subcontract stock issue (Priority 1)

**Phase A — cache fix (required, mobile-only):**

In `useIssueMaterial` and `useRecoverMaterial` `onSuccess`, also call:

- `invalidateProjectBoq(qc, projectId)` and/or `invalidateProjectProcurement(qc, projectId)`

(from `project-query-invalidation.ts`). Verify BOQ tab `Site stock: X` updates without full page reload after issue/recover.

**Phase B — BOQ visibility (required, backend + mobile):**

1. **Optional `boqItemId`** on material issue:
   - Migration: add nullable `boq_item_id` to `subcontractor_material_issues`.
   - Extend `issueMaterialToWoSchema` + `issueMaterialToWorkOrder` to accept optional `boqItemId` (validate belongs to project + matches `resourceId` when set).
2. **Issue UI:** When material selected, if BOQ has MATERIAL lines with same `resourceId`, show optional **"Link to BOQ line"** picker (compact list).
3. **BOQ tab:** For MATERIAL rows with `resourceId`, show secondary hint when issues exist:
   - `Site stock: {stockQty}` (existing)
   - `Issued to subs: {sum qty}` (new — aggregate `SubcontractorMaterialIssue` for project by resource or boqItemId)
4. **Tests:** Extend subcontract or procurement integration test: issue material → BOQ list/summary reflects lower stock (or assert stock movement + issue row).

**Do NOT:** Double-deduct stock (issue already decrements balance). BOQ display is read-model only.

### 2.10.2 SUB-UX3 — Material issue draft + explicit Issue button (Priority 1)

**File:** `MaterialsPanel` in `SubcontractsTab.tsx`

**Problem:** User selects material + enters qty/rate, then taps **X** on the selected-material chip → draft cleared with no confirmation. Footer **Issue to subcontractor** is the only action but feels like instant commit without review.

**Fix:**

1. **Two-step sheet state:** `pick` → `review` (auto-advance after material select).
2. **Review step shows:** material name, on-hand, qty, unit, rate, amount, optional BOQ line — all editable except name (use "Change material" link instead of bare X).
3. **"Change material"** → confirm dialog if qty/rate entered: *Discard entries?*
4. **Footer buttons on review step:**
   - **Cancel** — close sheet; confirm if dirty.
   - **Issue to subcontractor** (primary) — POST only here (disabled if qty invalid / over on-hand).
5. **Do not POST** on material pick alone.
6. After success: close sheet, toast/alert, list refreshes (existing).

### 2.10.3 TEAM-R1 — Project Team: all assignable roles (Priority 2)

**Files:**

- `apps/mobile/components/projects/ProjectMembersSection.tsx`
- `packages/shared/src/validators/portal.ts` → `setProjectMembersSchema`
- `apps/backend/src/services/project-member.service.ts` (if role validation duplicated)

**Fix:**

1. Replace `ASSIGNABLE_ROLES` with project-appropriate subset of `INVITABLE_ROLES`:
   `PM`, `DPM`, `QC`, `MECHANICAL_MANAGER`, `STORE_INCHARGE`, `WEIGHBRIDGE_INCHARGE`, `SITE_SUPERVISOR`, `ACCOUNTANT`.
2. Display **`ROLE_LABELS[role]`** in chips (not raw enum).
3. Map legacy `SUPERVISOR` → `SITE_SUPERVISOR` on load/save for consistency.
4. Expand `setProjectMembersSchema` `role` enum to match (use `z.enum([...])` from shared list — single source).
5. **Save members** button already exists when `dirty` — keep; ensure role change marks dirty (already does).

**Test:** Assign `STORE_INCHARGE` to project member via API → 200; list returns role.

### 2.10.4 MOB-PICK1 — Material & RA picker visual polish (Priority 2)

**Goal:** Pickers should feel like Procore/Fieldwire quality — not plain bordered list rows.

**Create or enhance** shared patterns in:

- `apps/mobile/components/materials/MaterialPicker.tsx`
- `apps/mobile/components/estimation/RateAnalysisPicker.tsx`

**Minimum UI improvements:**

1. **Section header** styling ("On this project" / "Catalog" / "Rate analyses").
2. **Row design:** left icon/thumbnail (MaterialThumbnail already exists for materials), title + subtitle, right **checkmark** when selected.
3. **Selected row** — primary border + subtle fill (keep but refine spacing/typography).
4. **Empty / loading** — centered icon + message, not bare text.
5. **Search bar** — consistent with `SearchBar` but add clear button when text present.
6. **RateAnalysisPicker:** add unit badge, rate formatted with `formatINR`, optional SAC/category if in model.
7. **Desktop:** slightly taller rows, hover/pressed states (`active:bg-surface`).

**Do not break** call sites: `VariationsTab`, `EstimateBuildStep`, `reports/create.tsx`, `SubcontractsTab` MaterialsPanel.

Optional: extract `PickerListRow` shared component if it reduces duplication.

### 2.10.5 NR-37 — MaterialsPanel hooks order (fix if still present)

If `Rendered more hooks than during the previous render` in `MaterialsPanel`: ensure **all** `useMemo` hooks run **before** any `return null` for `materialSupplyMode === 'NONE'`. (Fixed locally — verify not regressed.)

### 2.10.6 Ship gate

| Gate | Requirement |
| ---- | ----------- |
| Tests | **131/131** minimum |
| tsc | Backend + mobile clean |
| Manual | Issue stock → BOQ `Site stock` updates; issue flow has review + Issue button; assign Store Incharge to project; pickers look polished |

### 2.10.7 Definition of done (Round 30)

- [x] **SUB-BOQ1 Phase A** — `invalidateProjectBoq` on issue/recover (`6b802a7`)
- [x] **SUB-BOQ1 Phase B (schema/API)** — migration + `boqItemId` persist (`bb50b2a`, `9462a3e`)
- [x] **SUB-BOQ1 Phase B (UI/BOQ)** — BOQ picker + BoqTab hint + validation (`2d8f324`)
- [x] **SUB-UX3** — Review UI + `confirmAsync` discard (`6b802a7`, `bb50b2a` NR-38)
- [x] **TEAM-R1** — Full roles + `ROLE_LABELS` + schema (`6b802a7`)
- [x] **MOB-PICK1 (MaterialPicker)** — checkmark, bold selected, padding (`9462a3e`)
- [x] **MOB-PICK1 (RateAnalysisPicker)** — match MaterialPicker polish (`2d8f324`)
- [x] **NR-37** — Hooks before early return in MaterialsPanel
- [x] **NR-38** — `confirmAsync` for discard dialogs
- [x] 131/131 tests, both tsc clean

### 2.10.12 Round 30b verification (2026-08-05 — do NOT revert)

**Commits:** `bb50b2a` (migration/schema + NR-38) · `9462a3e` (service + MaterialPicker)

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **129/129** tests ✓

| ID | Status | Evidence |
| -- | ------ | -------- |
| **SUB-BOQ1B schema** | **Done** | Migration `20260805160000`; `SubcontractorMaterialIssue.boqItemId`; BOQItem back-relation |
| **SUB-BOQ1B API** | **Partial** | `issueMaterialToWoSchema.boqItemId`; persisted in `issueMaterialToWorkOrder` — **no validation** that BOQ line matches project/resource |
| **SUB-BOQ1B mobile** | **Not done** | `useIssueMaterial` type omits `boqItemId`; `onIssue` doesn't send it; no BOQ line picker in issue modal |
| **SUB-BOQ1B BoqTab** | **Not done** | No `Issued to subs` in `BoqTab.tsx`; `boq.service.ts` doesn't aggregate subcontract issues |
| **MOB-PICK1 Material** | **Done** | Checkmark, bold primary text, 40px thumbnail, `active:bg-surface` |
| **MOB-PICK1 RA** | **Not done** | `RateAnalysisPicker.tsx` unchanged |
| **NR-38** | **Done** | `confirmAsync` on sheet close + Change material (`bb50b2a`) |

**Apply migration on dev:** `pnpm db:migrate:deploy` (includes `20260805160000_subcontract_material_issue_boq_item`).

### 2.10.13 Round 30c verification (2026-08-05 — do NOT revert)

**Commit:** `2d8f324`

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **131/131** tests ✓ (post-verify: SUB-BOQ1T + aggregation fix)

| ID | Status | Evidence |
| -- | ------ | -------- |
| **SUB-BOQ1B validation** | **Done** | Project + `category === 'MATERIAL'` + resource match (incl. estimateItem) |
| **SUB-BOQ1B mobile** | **Done** | BOQ chips; `boqItemId` only sent when chip matches material |
| **SUB-BOQ1B BoqTab** | **Done** | `subIssuedQty` per boqItemId + unlinked by resourceId |
| **MOB-PICK1 RA** | **Done** | `RateAnalysisPicker.tsx` |
| **SUB-BOQ1T** | **Done** | `subcontract.test.ts` — issue with `boqItemId` + MATERIAL rejection |
| **NR-39** | **Done** | Reset `selectedBoqItemId` on material change (`useEffect`) |

**Minor notes (resolved):**

- ~~Validation missing MATERIAL category~~ — fixed.
- ~~Aggregation by resourceId only~~ — linked issues count on BOQ line; unlinked still by resource.
- ~~Stale `selectedBoqItemId`~~ — fixed.

<details>
<summary>Round 30c original spec (completed)</summary>

All §2.10.13 items delivered in `2d8f324`. Optional integration test remains in §2.8.

</details>

---

## 2.11 Round 31 — MOB-LINK1: Unified procurement link picker (COMPLETE)

**User report (2026-08-05):** When adding/editing estimate line items (including **sub-estimates**,
which reuse the same build wizard) or **variation new-scope lines**, the UI stacks **two full searchable
lists** — `MaterialPicker` then `RateAnalysisPicker` — inline in the form. This feels wrong: duplicate
search bars, cramped scroll areas (`maxHeight: 100–140`), and it looks like the user must pick **both**
when links are **mutually exclusive** (material **or** rate analysis, never both).

**Goal:** One compact inline control + one browse sheet. Same component in **EstimateBuildStep** and
**VariationsTab**. Match the mental model of procurement indent (`IndentDraftLineCard`) which already
uses a **single grouped Select**.

**Do NOT change:** Daily report materials, subcontract material issue, project material rates, rate
regions — those correctly use stock-first `MaterialPicker` only (no RA).

---

### 2.11.0 Read this first — current broken UX (do not re-create)

**File:** `apps/mobile/components/estimation/EstimateBuildStep.tsx`

Function `ProcurementLinkFields` (approx lines 99–153) renders:

```
Procurement link (optional)                    [Clear link]
Catalog material (1:1)
  [SearchBar]
  [MaterialPicker scroll list maxHeight 100-140]
Rate analysis (composite BOM)
  [SearchBar]
  [RateAnalysisPicker scroll list maxHeight 100-140]
```

Problems:

| # | Problem |
| - | ------- |
| 1 | Two SearchBars visible at once |
| 2 | Two scroll regions eat vertical space inside every line item |
| 3 | Selecting material clears RA (and vice versa) but UI doesn't communicate exclusivity |
| 4 | `promptLinkApplyAsync` fires **after every tap** — extra modal friction |
| 5 | Only `MATERIAL` type lines show pickers in estimates, but variations show **both** pickers for MATERIAL new-scope (worse) |

**Sub-estimates:** Created via `/estimates/:id/sub-estimates` then edited in the same
`EstimateBuildStep` wizard (`apps/mobile/app/(app)/estimation/create.tsx` step 2). Fixing
`EstimateBuildStep` fixes sub-estimates automatically.

**Variations:** `apps/mobile/components/projects/VariationsTab.tsx` lines ~432–487 — MATERIAL new-scope
shows `MaterialPicker`; **all non-MISC** new-scope also shows `RateAnalysisPicker` → MATERIAL lines get
**both** stacked lists.

---

### 2.11.1 Data model (backend — do NOT change)

Estimate items and variation lines store **at most one** procurement link:

| Field | Meaning |
| ----- | ------- |
| `resourceId` | 1:1 link to catalog **material** resource |
| `rateAnalysisId` | Link to **composite** rate analysis (BOM); explodes to materials in procurement after BOQ convert |

**Mutual exclusion rule:** Setting `resourceId` must clear `rateAnalysisId` and vice versa. Payloads
use `null` to clear on update (see `EditableLineItem.clearLink` in EstimateBuildStep).

**No new API fields.** Mobile-only UX refactor.

---

### 2.11.2 Reference implementations (copy patterns)

| File | What to copy |
| ---- | ------------ |
| `apps/mobile/components/projects/IndentDraftLineCard.tsx` | **Best UX reference** — single `Select` with `groupKey`: "From BOQ", "Catalog Materials", "Rate Analysis (Composite)". Lines 130–184 build options; encoded values `boq:`, `mat:`, `ra:`. |
| `apps/mobile/components/ui/Select.tsx` | Searchable sheet modal, grouped headers, compact trigger — reuse or mirror for link picker sheet |
| `apps/mobile/components/materials/MaterialPicker.tsx` | Row styling: thumbnail 40px, checkmark when selected, bold primary text, `active:bg-surface`, section header "On this project" / "All materials" |
| `apps/mobile/components/estimation/RateAnalysisPicker.tsx` | Row styling: calculator icon in primary/10 box, unit pill, checkmark, section header "Rate analyses" |
| `apps/mobile/components/layout/AdaptiveSheet.tsx` | Use for browse sheet on mobile (already used in SubcontractsTab issue modal) |

**Do NOT refactor `IndentDraftLineCard` in Round 31** — optional Phase 3 later. Focus on estimate + variation.

---

### 2.11.3 Deliverable — new component `ProcurementLinkPicker`

**Create:** `apps/mobile/components/estimation/ProcurementLinkPicker.tsx`

**Export from:** optionally add to `apps/mobile/components/estimation/index.ts` if such barrel exists; otherwise direct import is fine.

#### 2.11.3a Props (implement exactly)

```typescript
import type { Resource, RateAnalysis } from '@/services/estimate.queries';

export type ProcurementLinkKind = 'material' | 'rate_analysis';

export type ProcurementLinkValue = {
  resourceId?: string;
  rateAnalysisId?: string;
};

export function ProcurementLinkPicker({
  /** Current link — at most one set */
  value,
  onChange,
  /** Which segments to show in sheet. Default: both. */
  allowedKinds = ['material', 'rate_analysis'],
  /** Estimate/variation line cost type — drives default segment */
  lineType = 'MATERIAL',
  /** Called when user picks an item AND "Apply defaults" is on */
  onApplyDefaults,
  /** Initial description empty → default apply ON; editing existing desc → default OFF */
  hasExistingDescription = false,
  compact = false,
  disabled = false,
}: {
  value: ProcurementLinkValue;
  onChange: (next: ProcurementLinkValue) => void;
  allowedKinds?: ProcurementLinkKind[];
  lineType?: 'MATERIAL' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'MISC';
  onApplyDefaults?: (fields: { description: string; unit: string; rate: string }) => void;
  hasExistingDescription?: boolean;
  compact?: boolean;
  disabled?: boolean;
});
```

#### 2.11.3b Inline (collapsed) UI — default state

When **no link** selected:

```
┌──────────────────────────────────────────────────┐
│ Procurement link (optional)              [none]  │
│ ┌──────────────────────────────────────────────┐ │
│ │  🔗  Link to material or rate analysis…     │ │  ← Pressable, opens sheet
│ └──────────────────────────────────────────────┘ │
│ Link for procurement & BOQ material explosion    │  ← helper text, text-[10px] text-muted
└──────────────────────────────────────────────────┘
```

When **material** linked (`value.resourceId` set):

```
┌──────────────────────────────────────────────────┐
│ Procurement link (optional)            [Clear]   │
│ ┌──────────────────────────────────────────────┐ │
│ │ [thumb] OPC Cement 53 Grade          ✓      │ │
│ │         Material · bag · ₹420               │ │
│ │                              [Change]       │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

When **RA** linked (`value.rateAnalysisId` set):

```
┌──────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────┐ │
│ │ [calc] PCC M15 (1:4:8)               ✓      │ │
│ │        Rate analysis · cum · ₹5,200/u       │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- **Clear** sets `{ resourceId: undefined, rateAnalysisId: undefined }` via `onChange({})`.
- **Change** reopens sheet with current segment pre-selected.
- Resolve display names via `useMaterials({ limit: 300 })` and `useRateAnalyses()` — same as EstimateBuildStep today.

#### 2.11.3c Sheet UI (opened on tap)

Use `AdaptiveSheet` with `size="lg"`, title **"Link to library"**.

**Layout top → bottom:**

1. **Segmented control** (only if `allowedKinds.length > 1`):
   - Pills: `Material` | `Rate analysis`
   - Default segment from `lineType`:
     - `MATERIAL` → default `material`
     - `LABOUR` | `EQUIPMENT` | `SUBCONTRACTOR` → default `rate_analysis`
     - `MISC` → picker disabled / hidden entirely

2. **Single SearchBar** — filters active segment list only
   - Material segment placeholder: `"Search materials…"`
   - RA segment placeholder: `"Search rate analyses…"`

3. **ScrollView** (flex, no tiny maxHeight — sheet provides height)
   - Reuse row components from MaterialPicker / RateAnalysisPicker (copy JSX or extract shared `PickerListRow` if ≤30 lines duplication)
   - Show checkmark on currently selected row
   - Material rows: `MaterialThumbnail` + name + unit + category
   - RA rows: calculator icon + name + unit badge + `formatINR(totalRate)`

4. **Footer row** (sticky at bottom of sheet):
   - Toggle/checkbox: **"Apply description, unit & rate from library"**
   - Default: `!hasExistingDescription` (ON for new lines, OFF when user already typed description)
   - When ON and user taps a row → call `onApplyDefaults({ description, unit, rate })` **in addition to** `onChange`

5. **Empty states:**
   - No materials: centered icon + "No materials found"
   - No RAs: centered calculator icon + "No rate analyses found"

#### 2.11.3d Selection handler (mutual exclusion)

```typescript
function selectMaterial(resource: Resource, applyDefaults: boolean) {
  onChange({ resourceId: resource.id, rateAnalysisId: undefined });
  if (applyDefaults && onApplyDefaults) {
    onApplyDefaults({
      description: resource.name,
      unit: resource.unit,
      rate: String(parseFloat(resource.rate) || 0),
    });
  }
  closeSheet();
}

function selectRateAnalysis(ra: RateAnalysis, applyDefaults: boolean) {
  onChange({ resourceId: undefined, rateAnalysisId: ra.id });
  if (applyDefaults && onApplyDefaults) {
    onApplyDefaults({
      description: ra.name,
      unit: ra.unit,
      rate: String(parseFloat(ra.totalRate) || 0),
    });
  }
  closeSheet();
}
```

**Remove dependency on `promptLinkApplyAsync`** for these flows — the sheet footer toggle replaces it.

---

### 2.11.4 Line-type rules (enforce in parent AND picker)

| `lineType` | Show picker? | `allowedKinds` | Default segment |
| ---------- | ------------ | -------------- | --------------- |
| `MATERIAL` | Yes | `['material', 'rate_analysis']` | `material` |
| `LABOUR` | Yes | `['rate_analysis']` | `rate_analysis` |
| `EQUIPMENT` | Yes | `['rate_analysis']` | `rate_analysis` |
| `SUBCONTRACTOR` | Yes | `['rate_analysis']` | `rate_analysis` |
| `MISC` | **No** | — | — |

For non-MATERIAL estimate lines today, `ProcurementLinkFields` is hidden entirely — **extend** to show
RA-only picker for LABOUR/EQUIPMENT/SUBCONTRACTOR when user expands "Procurement link" (optional
collapsible) OR always show compact chip "Link rate analysis (optional)" below type chips in AddItemRow.

**Minimum for Round 31:** At minimum fix MATERIAL lines (main complaint). **Stretch:** enable RA link for
LABOUR/EQUIPMENT/SUBCONTRACTOR in AddItemRow + EditableLineItem when `item.type !== 'MISC'`.

---

### 2.11.5 File changes — step by step

#### Step 1 — Create `ProcurementLinkPicker.tsx`

Implement §2.11.3 fully. Use existing hooks:

- `useMaterials({ search: debouncedSearch, limit: 200, enabled: sheetOpen && segment === 'material' })`
- `useRateAnalyses()` — filter client-side by search (same as RateAnalysisPicker)

Debounce search 300ms (copy pattern from MaterialPicker).

#### Step 2 — Refactor `EstimateBuildStep.tsx`

**Delete** function `ProcurementLinkFields` entirely.

**Delete** functions `handleCatalogSelect` and `handleRateAnalysisSelect` (logic moves into picker).

**Remove import** of `promptLinkApplyAsync` if no longer used.

**Remove debug `console.log`** calls in `resolveTemplateItemLinks` and `applyTemplate` (lines ~47–55, ~225–239).

**Replace** in `EditableLineItem` (editing mode, ~line 539):

```tsx
{item.type !== 'MISC' ? (
  <ProcurementLinkPicker
    value={{ resourceId: resourceId || undefined, rateAnalysisId: rateAnalysisId || undefined }}
    onChange={(v) => {
      setResourceId(v.resourceId ?? '');
      setRateAnalysisId(v.rateAnalysisId ?? '');
    }}
    lineType={item.type}
    hasExistingDescription={Boolean(desc.trim())}
    onApplyDefaults={({ description, unit, rate }) => {
      setDesc(description);
      setUnit(unit);
      setRate(rate);
    }}
  />
) : null}
```

**Replace** in `AddItemRow` (~line 665):

```tsx
{type !== 'MISC' ? (
  <ProcurementLinkPicker
    value={{ resourceId: resourceId || undefined, rateAnalysisId: rateAnalysisId || undefined }}
    onChange={(v) => {
      setResourceId(v.resourceId ?? '');
      setRateAnalysisId(v.rateAnalysisId ?? '');
    }}
    lineType={type}
    hasExistingDescription={Boolean(desc.trim())}
    onApplyDefaults={({ description, unit, rate }) => {
      setDesc(description);
      setUnit(unit);
      setRate(rate);
    }}
    compact
  />
) : null}
```

**Read-only view** (`!editing` branch): keep existing linkedResource/linkedRa badge text — no change needed.

**Save payload** unchanged: `resourceId: resourceId || null, rateAnalysisId: rateAnalysisId || null`.

#### Step 3 — Refactor `VariationsTab.tsx`

**Remove** blocks:
- `{isNewScope && line.type === 'MATERIAL' && ( ... MaterialPicker ... )}` (~432–458)
- `{isNewScope && line.type !== 'MISC' && ( ... RateAnalysisPicker ... )}` (~460–487)

**Replace** with single block for new scope:

```tsx
{isNewScope && line.type !== 'MISC' && (
  <ProcurementLinkPicker
    value={{
      resourceId: line.resourceId,
      rateAnalysisId: line.rateAnalysisId,
    }}
    onChange={(v) =>
      setLines((prev) =>
        prev.map((l) =>
          l.id === line.id
            ? { ...l, resourceId: v.resourceId, rateAnalysisId: v.rateAnalysisId }
            : l,
        ),
      )
    }
    lineType={line.type}
    hasExistingDescription={Boolean(line.description.trim())}
    onApplyDefaults={({ description, unit, rate }) =>
      setLines((prev) =>
        prev.map((l) =>
          l.id === line.id
            ? {
                ...l,
                description: l.description || description,
                unit,
                rate,
              }
            : l,
        ),
      )
    }
  />
)}
```

**Keep unchanged:**
- BOQ chip row for adjust vs new scope
- VAR-C9 badges for BOQ-linked composite lines
- Line type chips
- Submit/approve/convert logic

**On material select in old code** cleared `rateAnalysisId` — picker `onChange` must still enforce mutual exclusion (handled inside picker).

#### Step 4 — Keep `MaterialPicker` and `RateAnalysisPicker` as-is

Other call sites depend on them:

| File | Keep |
| ---- | ---- |
| `SubcontractsTab.tsx` MaterialsPanel | MaterialPicker + BOQ chips |
| `reports/create.tsx` | MaterialPicker + projectMaterials |
| `ProjectMaterialRatesSection.tsx` | MaterialPicker |
| `settings/rate-regions.tsx` | MaterialPicker |

Do **not** delete MaterialPicker/RateAnalysisPicker.

---

### 2.11.6 Visual / UX requirements (MOB-PICK1 continuity)

Match Round 30 picker polish:

- Selected row: `border-primary bg-primary/5`, bold primary text, `checkmark-circle` icon
- Pressed: `active:bg-surface`
- Padding: `p-2.5`
- Section labels: `text-[10px] font-semibold text-muted uppercase tracking-wide`
- Primary colour: `#1E3A5F` (already used in pickers)

Inline summary card: `rounded-lg border border-primary/20 bg-primary/5` when linked (match SubcontractsTab review chip).

---

### 2.11.7 Anti-patterns (Round 31)

| Don't | Do instead |
| ----- | ---------- |
| Stack MaterialPicker + RateAnalysisPicker inline | One ProcurementLinkPicker |
| Two SearchBars on same form row | One SearchBar inside sheet |
| Use `maxHeight: 100` inline lists | Full-height sheet scroll |
| Call `promptLinkApplyAsync` after each pick | Footer toggle "Apply defaults" |
| Allow both resourceId and rateAnalysisId set | Clear the other in onChange |
| Change backend estimate/CO schemas | Mobile-only |
| Break IndentDraftLineCard | Leave for later |
| Break SUB-UX / material issue / daily report pickers | Out of scope |

---

### 2.11.8 Ship gate

```bash
cd /home/prasanna/work/BuildFlow
npx tsc --noEmit -p apps/backend    # must stay clean (no backend changes expected)
npx tsc --noEmit -p apps/mobile     # must stay clean
pnpm --filter @buildflow/backend test  # **131/131** — no regressions
pnpm --filter @buildflow/backend test  # run twice, same count
```

No new migrations. No new backend tests required unless you add one voluntarily.

---

### 2.11.9 Manual test checklist (must pass before marking done)

**Estimate wizard** (`/estimation/create` or edit estimate step 2):

- [ ] Add MATERIAL line → tap link chip → sheet opens with Material segment default
- [ ] Switch to Rate analysis segment → pick RA → inline shows RA name; material cleared
- [ ] Toggle "Apply defaults" ON → description/unit/rate fill from library
- [ ] Toggle OFF → only link fields change, description unchanged
- [ ] Clear link → chip returns to "Link to material or rate analysis…"
- [ ] Save line → reload estimate → link persists
- [ ] Collapsed line shows "Catalog: …" or "Rate analysis: …" badge (existing read view)

**Sub-estimate** (parent estimate → Add Sub-Estimate → open sub-estimate → build step):

- [ ] Same picker behaviour as parent estimate

**Variations** (project → Variations → new scope line):

- [ ] MATERIAL new-scope: one picker, not two stacked lists
- [ ] LABOUR new-scope: RA segment only (no material segment)
- [ ] MISC: no picker shown
- [ ] Selecting RA clears material on same line

**Regression:**

- [ ] Subcontract material issue still uses MaterialPicker (not ProcurementLinkPicker)
- [ ] Daily report material section unchanged
- [ ] Template load on estimate still resolves RA links

---

### 2.11.10 Definition of done (Round 31)

- [x] **MOB-LINK1a** — `ProcurementLinkPicker.tsx` created per §2.11.3 (`1d86081`)
- [x] **MOB-LINK1b** — `EstimateBuildStep.tsx` refactored; `ProcurementLinkFields` removed
- [x] **MOB-LINK1c** — `VariationsTab.tsx` refactored; dual pickers removed for new scope
- [x] **MOB-LINK1d** — `promptLinkApplyAsync` removed from estimate link flow; sheet toggle used
- [x] **MOB-LINK1e** — Debug `console.log` removed from EstimateBuildStep template path
- [x] **MOB-LINK1f** — 131/131 tests, mobile + backend tsc clean
- [x] **MOB-LINK1g** — Manual checklist §2.11.9 (automated verify; user spot-check recommended)

### 2.11.12 Round 31 verification (2026-08-05 — do NOT revert)

**Commit:** `1d86081`

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **131/131** tests ✓

| ID | Status | Evidence |
| -- | ------ | -------- |
| **MOB-LINK1a** | **Done** | `ProcurementLinkPicker.tsx` — inline chip + `AdaptiveSheet`, segmented Material/RA, apply-defaults Switch |
| **MOB-LINK1b** | **Done** | `EstimateBuildStep` — picker for all non-MISC types; template logs removed |
| **MOB-LINK1c** | **Done** | `VariationsTab` — single picker for new scope; old dual pickers removed |
| **MOB-LINK1d** | **Done** | No `promptLinkApplyAsync` in estimate flow |
| **MOB-LINK1e** | **Done** | `resolveTemplateItemLinks` / `applyTemplate` console.log removed |
| **MOB-LINK3 partial** | **Done** (post-verify) | `effectiveAllowedKinds` from `lineType` — LABOUR/EQUIP/SUBCONTRACTOR RA-only segment |
| **NR-40** | **Done** (post-verify) | Read-only link badge shown for all non-MISC types (was MATERIAL-only) |

**Unchanged (correct):** `MaterialPicker` / `RateAnalysisPicker` still used by subcontract, daily report, rates, indent.

**Stretch not done (§2.11.11):** MOB-LINK2 PickerListRow extract · MOB-LINK4 IndentDraftLineCard refactor.

<details>
<summary>Round 31 original spec (completed)</summary>

Full MOB-LINK1 spec delivered in `1d86081`. See §2.11.12 verification table.

</details>

---

### 2.11.11 Optional stretch (only if core done early)

| ID | Task |
| -- | ---- |
| **MOB-LINK2** | Extract shared `PickerListRow` used by MaterialPicker, RateAnalysisPicker, ProcurementLinkPicker |
| **MOB-LINK3** | Show RA-only link for LABOUR/EQUIPMENT/SUBCONTRACTOR in estimate AddItemRow (not only MATERIAL) |
| **MOB-LINK4** | Refactor IndentDraftLineCard to use ProcurementLinkPicker internally |

Do not start stretch items until §2.11.10 all checked.

---

## 2.12 Round 32 — RPT-UI1: Report download buttons + branding coverage (COMPLETE)

**User request (2026-08-05):** Every report that has a backend PDF endpoint should have a clear
**Download PDF** entry in the mobile app. Branding (logo, accent, footer) must apply consistently.
User also asked where to configure “report templates” after login — see **§2.12.0** (no per-report
file upload today; company-level branding only).

**Round 32 status:** **COMPLETE** (`92811df`) — see §2.12.9 verification.

### 2.12.0 Report branding vs “templates” (product truth — document in UI if helpful)

BuildFlow does **not** support uploading custom HTML/Word/PDF templates per report type. PDFs are
**generated programmatically** in `apps/backend/src/services/pdf-report.service.ts` (and
`estimate-export.service.ts` for estimate Excel/PDF).

| What the user configures | Where in app (after login) | API |
| ------------------------ | -------------------------- | --- |
| **Company logo** (appears on PDF header) | **Settings → Company → Company Profile** — `logoUrl` field (`apps/mobile/app/(app)/settings/company.tsx`) | `PATCH /api/settings/company` · presigned upload via `POST /api/settings/company/logo/upload-url` (`useCompanyLogoUpload` in `settings.queries.ts` — hook exists; optional stretch: wire ImagePicker upload on company screen) |
| **Report styling** (accent bar, show logo toggle, watermark beta, custom footer) | **Settings → Company → Reports & Branding** (`apps/mobile/app/(app)/settings/report-branding.tsx`, linked from `settings/index.tsx`) | `GET/PATCH /api/settings/report-settings` |
| **Download branded PDFs** | **Dashboard → Reports Hub**; project tabs; entity detail screens (see matrix §2.12.2) | `/api/reports/pdf/...` |

**Optional UX polish (stretch):** On `report-branding.tsx`, add a one-line link: “Upload logo under
Company Profile” — do not block RPT-UI1 on this.

### 2.12.1 Architecture (read before coding)

**Backend PDF engine:** `apps/backend/src/services/pdf-report.service.ts`  
**Routes:** `apps/backend/src/routes/pdf-report.routes.ts` → mounted at `/api/reports/pdf`  
**Branding helpers:** `loadCompanyForPdf` + `drawBrandedHeader` (Round 28 RPT-C1e — all 17 generators
should already pass `accentColor`, `showLogo`, footer).

**Estimate exports (separate from pdf-report routes):**

- `apps/backend/src/services/estimate-export.service.ts`
- Mobile: `useExportEstimate` on estimate detail → `/api/estimates/:id/export/pdf|excel`
- Already branded — **do not duplicate** with `/reports/pdf/estimates/:id` on same screen unless
  product wants both; prefer keeping existing Export PDF/Excel buttons.

**Mobile download pattern (post-Round 32):**

- Shared helper: `apps/mobile/services/report-download.ts` — `downloadReportPdf` + `reportPaths`
- Reports Hub, daily report detail, invoice detail, estimate compare, BOQ tab — use shared helper
- Subcontracts tab — still uses `downloadSubcontract*Pdf` in `expansion.queries.ts` (optional cleanup)
- Resources tab — still inline `apiDownload` for material rates (optional cleanup)

### 2.12.2 Report inventory matrix (17 pdf-report types + estimate export)

| # | Report | API path | Mobile UI (post-R32) |
| - | ------ | -------- | --------------------- |
| 1 | Project progress | `GET /reports/pdf/projects/:id/progress` | Reports Hub ✓ |
| 2 | Daily report | `GET /reports/pdf/reports/:id` | Report detail ✓ |
| 3 | Invoice | `GET /reports/pdf/invoices/:id` | Invoice detail ✓ |
| 4 | Estimate summary | `GET /reports/pdf/estimates/:id` | Estimate detail Export PDF ✓ (export service) |
| 5 | Estimate comparison | `GET /reports/pdf/estimates/:idA/compare/:idB` | Compare screen ✓ |
| 6 | Estimate vs actual | `GET /reports/pdf/projects/:id/estimate-vs-actual` | Reports Hub ✓ |
| 7 | P&L | `GET /reports/pdf/projects/:id/profit-loss` | Reports Hub ✓ |
| 8 | GST summary | `GET /reports/pdf/gst-summary` | Reports Hub ✓ (OWNER/ACCOUNTANT) |
| 9 | TDS | `GET /reports/pdf/tds` | Reports Hub ✓ |
| 10 | Resource utilization | `GET /reports/pdf/projects/:id/resource-utilization` | Reports Hub ✓ |
| 11 | BOQ vs actual | `GET /reports/pdf/projects/:id/boq-vs-actual` | Reports Hub ✓ |
| 12 | Material price history | `GET /reports/pdf/material-price-history` | Reports Hub ✓ (company card) |
| 13 | Measurement book (project) | `GET /reports/pdf/projects/:id/measurement-book` | BOQ tab ✓ |
| 14 | Abstract sheet (project) | `GET /reports/pdf/projects/:id/abstract-sheet` | BOQ tab ✓ |
| 15 | Material rates | `GET /reports/pdf/projects/:id/material-rates` | Reports Hub ✓ + Resources tab ✓ |
| 16 | Subcontract MB | `GET …/subcontract/work-orders/:woId/measurement-book` | SubcontractsTab ✓ |
| 17 | Subcontract abstract | `GET …/subcontract/work-orders/:woId/abstract-sheet` | SubcontractsTab ✓ |

### 2.12.3 RPT-UI1a — Shared `downloadReportPdf` helper

**Create:** `apps/mobile/services/report-download.ts` (or add to `expansion.queries.ts` if you prefer
one file — prefer **new small module** to avoid bloating expansion).

```ts
/** Download PDF from authenticated API path; share via expo-sharing when available. */
export async function downloadReportPdf(apiPath: string, filename: string): Promise<void>
```

Behaviour (match Reports Hub):

1. `apiDownload(path, filename, 'application/pdf')`
2. If `Sharing.isAvailableAsync()` → `Sharing.shareAsync(uri)` (opens share sheet / save)
3. Else `alertAsync('Saved', 'Report downloaded.')`
4. On error → `alertAsync('Error', message)`

Refactor **Reports Hub** to import this helper (remove local duplicate).
Refactor **SubcontractsTab** PDF handlers to use it (keep path helpers in `expansion.queries.ts`).
Refactor **ResourcesTab** material-rates download similarly.

Add path helpers for all endpoints used in §2.12.2 (named exports, e.g. `projectProgressPdfPath`).

### 2.12.4 RPT-UI1b — Wire missing screens

#### Daily report detail (`apps/mobile/app/(app)/reports/[id].tsx`)

- Add header action **Download PDF** (secondary button or icon in `FormScreenHeader` if supported).
- Path: `/reports/pdf/reports/${id}` · filename: `daily-report-${id}.pdf`

#### Invoice detail (`apps/mobile/app/(app)/accounting/invoice/[id].tsx`)

- Add **Download PDF** near Send / Record payment (visible for SENT/PAID/OVERDUE; allow DRAFT too).
- Path: `/reports/pdf/invoices/${id}`

#### Estimate compare (`apps/mobile/app/(app)/estimation/compare.tsx`)

- When `canCompare`, show **Download comparison PDF** above results table.
- Path: `/reports/pdf/estimates/${idA}/compare/${idB}`

#### BOQ tab (`apps/mobile/components/projects/BoqTab.tsx`)

- Add compact action row (desktop: top of tab; mobile: below summary): **Measurement book PDF** ·
  **Abstract sheet PDF** — use existing `downloadMeasurementBookPdf` / `downloadAbstractSheetPdf`
  (update internals to call shared helper + sharing).

#### Reports Hub expansion (`apps/mobile/app/(app)/reports-hub/index.tsx`)

Add project cards (same `ProjectReportCard` pattern):

- **Project progress** → `/reports/pdf/projects/${id}/progress`
- **Estimate vs actual** → `/reports/pdf/projects/${id}/estimate-vs-actual`
- **Resource utilization** → `/reports/pdf/projects/${id}/resource-utilization`

Add company card (no project selector):

- **Material price history** → `/reports/pdf/material-price-history` · filename `material-price-history.pdf`

Update subtitle copy: “Select a project…” → mention progress, EVA, resource util, MB/abstract on BOQ tab.

**Optional stretch:** Project detail quick action “Progress PDF” linking same endpoint.

### 2.12.5 RPT-UI1c — Backend branding audit

In `pdf-report.service.ts`, grep every `export async function generate*` / PDF builder:

- Each must call `loadCompanyForPdf(companyId)` and pass branding into `drawBrandedHeader`.
- If any generator still uses plain `drawHeader` without accent/logo — **fix in this round**.

Run a quick smoke: generate one PDF per category in dev (or unit test mock) — no regression to
Round 28 RPT-C1e.

**Out of scope:** CSV/plain Excel without branding; scheduled email attachments (separate service).

### 2.12.6 Definition of done (Round 32)

- [x] **RPT-UI1a** — `downloadReportPdf` shared helper; Reports Hub refactored (`92811df`)
- [x] **RPT-UI1b-daily** — Daily report detail PDF button
- [x] **RPT-UI1b-invoice** — Invoice detail PDF button
- [x] **RPT-UI1b-compare** — Estimate comparison PDF button
- [x] **RPT-UI1b-boq** — Project MB + abstract on BOQ tab
- [x] **RPT-UI1b-hub** — Progress, EVA PDF, resource util, material price history in Reports Hub
- [x] **RPT-UI1c** — Backend branding audit clean (all 17 pdf-report generators use `drawBrandedHeader`)
- [x] **RPT-UI1d** — 131/131 tests · backend tsc · mobile tsc

**Partial (optional — see §2.13 / §2.15.4):**

- [ ] **RPT-UI1a-5** — `ReportDownloadButton` component
- [ ] **RPT-UI2** — Logo ImagePicker on Company Profile
- [ ] **RATE-EST1b-badge** — Show “From {source}” under rate field in estimate build
- [ ] **RATE-EST1e** — `projectId` on VariationsTab picker

### 2.12.9 Round 32 verification (2026-08-05 — do NOT revert)

**Commit:** `92811df`

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **131/131** tests ✓

| ID | Status | Evidence |
| -- | ------ | -------- |
| **RPT-UI1a** | **Done** | `apps/mobile/services/report-download.ts` — `downloadReportPdf` + `reportPaths` for 15 route types |
| **RPT-UI1b-hub** | **Done** | `reports-hub/index.tsx` — progress, EVA, resource util, material price history cards; shared helper |
| **RPT-UI1b-daily** | **Done** | `reports/[id].tsx` — Download PDF in meta card |
| **RPT-UI1b-invoice** | **Done** | `accounting/invoice/[id].tsx` — Download PDF in actions block |
| **RPT-UI1b-compare** | **Done** | `estimation/compare.tsx` — Download comparison PDF when `canCompare` |
| **RPT-UI1b-boq** | **Done** | `BoqTab.tsx` — Measurement book + abstract buttons |
| **RPT-UI1c** | **Done** | All 17 generators in `pdf-report.service.ts` use `loadCompanyForPdf` + `drawBrandedHeader` (since R28) |
| **MOB-LINK post-verify** | **Done** (bundled) | `ProcurementLinkPicker` — `effectiveAllowedKinds` + auto RA segment; `EstimateBuildStep` read-only badge for all non-MISC |

**Not refactored (acceptable):** `SubcontractsTab` still calls `downloadSubcontract*Pdf`; `ResourcesTab` still inline `apiDownload` — functionally correct.

**Estimate summary PDF:** Intentionally not duplicated — estimate detail keeps `useExportEstimate` export route.

**Follow-up:** §2.13 (complete) · §2.15 (complete; badge + variations stretch in §2.15.4).

---

## 2.13 Round 33 — RPT-UI1a+: Report download cleanup (COMPLETE)

**Status:** **COMPLETE** (`3493baa`) — see §2.13.1 verification.

### 2.13.1 Verification table (2026-08-05 — do NOT revert)

**Commit:** `3493baa` (Round 33; builds on `6426f15` + `92811df`)

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **131/131** tests ✓

| ID | Status | Evidence |
| -- | ------ | -------- |
| **RPT-UI1a-1** | **Done** | `reportPaths.subcontractMeasurementBook(projectId, woId)` + `subcontractAbstractSheet(projectId, woId)` in `report-download.ts` |
| **RPT-UI1a-2** | **Done** | `SubcontractsTab.tsx` — `onDownloadPdf` uses `downloadReportPdf(reportPaths.subcontract…)` |
| **RPT-UI1a-3** | **Done** | `ResourcesTab.tsx` — `downloadRateSheet` uses `downloadReportPdf(reportPaths.materialRates)` |
| **RPT-UI1a-4** | **Done** | `expansion.queries.ts` — all duplicate PDF path/download helpers removed |
| **RPT-UI1a-5** | **Not done** (stretch) | `ReportDownloadButton` component — deferred |
| **RPT-UI2** | **Not done** (stretch) | Logo ImagePicker on Company Profile — deferred |

**Call sites before/after:**

| File | Before | After |
| ---- | ------ | ----- |
| `SubcontractsTab.tsx` | `downloadSubcontractMeasurementBookPdf` / `downloadSubcontractAbstractSheetPdf` (expansion.queries) | `downloadReportPdf(reportPaths.subcontract…)` |
| `ResourcesTab.tsx` | inline `apiDownload` + `Sharing.shareAsync` | `downloadReportPdf(reportPaths.materialRates)` |
| `BoqTab.tsx` | already `downloadReportPdf` (Round 32) | unchanged |
| `reports-hub/index.tsx` | already `downloadReportPdf` (Round 32) | unchanged |
| `reports/[id].tsx` | already `downloadReportPdf` (Round 32) | unchanged |
| `invoice/[id].tsx` | already `downloadReportPdf` (Round 32) | unchanged |
| `estimation/compare.tsx` | already `downloadReportPdf` (Round 32) | unchanged |

**Remaining inline `apiDownload` for PDFs:** None — all report PDF downloads now go through `downloadReportPdf`. Non-PDF downloads (estimate Excel export via `useExportEstimate`) are separate and unchanged.

### 2.13.2 Anti-patterns

| Don't | Do instead |
| ----- | ---------- |
| Break SubcontractsTab loading state during PDF gen | Keep existing `downloading` UX if present |
| Remove path helpers before updating all call sites | Grep `downloadSubcontract`, `downloadMeasurement`, `apiDownload.*material-rates` first |
| Re-add `apiDownload` to `expansion.queries.ts` | Use `downloadReportPdf` + `reportPaths` from `report-download.ts` |

---

## 2.14 Reference — Material rate architecture (product truth)

**Read before changing rates or estimate defaults.** Answers: “Are region/catalog rates wired?” and “Does editing an estimate rate change old rates?”

### 2.14.1 Three rate stores (independent)

| Store | Where configured | Used for |
| ----- | ---------------- | -------- |
| **Company catalog** | Settings → Material Prices (`Resource.rate`) | Default fallback; new resource master rate; price history |
| **Regional rate book** | Settings → Rate Regions (`RegionalMaterialRate`, effective-dated) | Projects with `rateRegionId` when no higher-priority source |
| **Project overrides** | Project → Material Rates section (`ProjectMaterialRate`) | Explicit per-project rates; copy from region or approved estimate |

**Estimate line rates** (`EstimateItem.rate`) are a **fourth snapshot** — stored on each line when saved. They do **not** auto-sync when catalog/region changes.

### 2.14.2 Resolution chain (procurement / site ops)

`material-rate.service.ts` → `resolveMaterialRate()` priority:

1. **PROJECT** — `ProjectMaterialRate` override  
2. **BOQ** — linked `EstimateItem.rate` on active BOQ row  
3. **ESTIMATE** — latest **APPROVED** estimate item for that resource on the project  
4. **REGION** — project's `rateRegionId` → latest regional rate ≤ today  
5. **LAST_PO** — last purchase order line (GRN-preferring)  
6. **CATALOG** — `Resource.rate`

**Wired correctly for:** daily reports (`reports/create.tsx` → `/projects/:id/resources/:resourceId/rate`), indents (`useMaterialRate`), subcontract material issue, requisition enrichment, material rate variance report, PDF rate sheets.

**Integration tests:** `material-rate.test.ts` — NH-65 / GVR / TPK projects resolve with expected source types.

### 2.14.3 Estimate wizard rate defaults (post-Round 34)

When linking a material in **Estimate Build** with `projectId` set (`estimation/create.tsx` →
`EstimateBuildStep` → `ProcurementLinkPicker`):

- `selectMaterial` calls `GET /projects/:projectId/resources/:resourceId/rate`
- Prefills resolved rate (PROJECT / REGION / ESTIMATE / BOQ / CATALOG chain)
- Falls back to catalog `Resource.rate` if fetch fails or `projectId` omitted

**Still catalog-only:**

- **VariationsTab** new-scope lines — `ProcurementLinkPicker` has no `projectId` prop (§2.15.4 stretch)
- Linked material **inline chip** still shows catalog rate in subtitle (resolved rate only applied on pick + applyDefaults)

**Workaround for variations:** Manually edit line rate, or copy project rates first.

### 2.14.4 Editing rates on estimates — does it change previous rates?

**No — previous rates are preserved.**

| Action | What updates | What does NOT update |
| ------ | ------------ | -------------------- |
| Edit rate on **DRAFT/REJECTED** estimate line | That `EstimateItem.rate` only | Catalog `Resource.rate`, regional book, other estimates, approved BOQ |
| **Approve** estimate | Locks estimate (immutable); rate becomes source for BOQ + `resolveFromEstimate` | Older approved estimates unchanged |
| Change **Material Prices** catalog rate | `Resource.rate` + price history | Existing estimate/BOQ line rates |
| **Duplicate** estimate to revise | New estimate copies line rates at duplicate time | Original approved estimate unchanged |

Backend: `updateItem()` writes only `estimateItem.rate`; `getEstimateForEditing()` blocks edits on APPROVED/REVIEWED estimates.

---

## 2.15 Round 34 — RATE-EST1: Project-aware defaults in estimate wizard (COMPLETE)

**User pain:** “I set regional rates / project overrides — why doesn’t the estimate picker use them?”

**Round 34 status:** **COMPLETE** (`6426f15`) — core resolution wired; see §2.15.3 verification.

### 2.15.1 RATE-EST1a — Pass `projectId` into estimate build

**Files:** `estimation/create.tsx`, `EstimateBuildStep.tsx`, `ProcurementLinkPicker.tsx`

- Thread `projectId` prop through build step → picker
- When `applyDefaults` and material selected, fetch resolved rate:
  `GET /projects/:projectId/resources/:resourceId/rate`
- Prefill rate + pass `rateSource` in `onApplyDefaults` callback
- Rate analysis path unchanged (`ra.totalRate`)

### 2.15.2 RATE-EST1b — UX hints

- When resolved source ≠ CATALOG, show small label under rate field: “From {source}”
- If no projectId (edge case), fall back to catalog rate (current behaviour)

### 2.15.3 Definition of done (Round 34)

- [x] **RATE-EST1a** — `projectId` threaded; `selectMaterial` calls resolve API (`6426f15`)
- [x] **RATE-EST1b-fallback** — Catalog fallback when no projectId or fetch error
- [x] **RATE-EST1c** — Saving line does not mutate `Resource.rate` (backend unchanged)
- [x] **RATE-EST1d** — 131/131 tests · mobile tsc · backend tsc
- [ ] **RATE-EST1b-badge** — “From {source}” label under rate field (stretch — `rateSource` passed but not rendered)
- [ ] **RATE-EST1e** — VariationsTab passes `projectId` to picker (stretch — §2.15.4)

### 2.15.4 Round 34 verification (2026-08-05 — do NOT revert)

**Commit:** `6426f15`

**Ship gates:** backend tsc ✓ · mobile tsc ✓ · **131/131** tests ✓

| ID | Status | Evidence |
| -- | ------ | -------- |
| **RATE-EST1a** | **Done** | `ProcurementLinkPicker` — `projectId?: string`; `selectMaterial` → `apiFetch('/projects/${projectId}/resources/${resource.id}/rate')`; fallback to catalog on error |
| **RATE-EST1a-thread** | **Done** | `EstimateBuildStep` → `EditableLineItem` / `AddItemRow` → picker; `create.tsx` passes `projectId` from route params (create + edit-via-create flows) |
| **RATE-EST1b-fallback** | **Done** | No `projectId` → catalog rate; try/catch on fetch |
| **RATE-EST1c** | **Done** | `estimate.service.ts` `updateItem()` writes only `EstimateItem.rate` |
| **RATE-EST1b-badge** | **Not done** (stretch) | `rateSource` in `onApplyDefaults` but `EstimateBuildStep` does not render “From REGION” etc. |
| **RATE-EST1e** | **Not done** (stretch) | `VariationsTab.tsx` — picker missing `projectId={projectId}` |

**Note:** Use `ResolvedMaterialRate` typing (`rate: number`) in picker fetch — runtime OK; optional type cleanup.

**Optional stretch (§2.15.4 follow-up):**

1. Pass `projectId` to `ProcurementLinkPicker` in `VariationsTab.tsx`
2. Show `rateSource` badge under rate input in `EstimateBuildStep` when ≠ `CATALOG`
3. Update inline linked-material subtitle to show resolved rate when available

### 2.12.7 Manual test checklist

**Branding setup:**

- [ ] Settings → Company Profile — set logo URL (or upload if wired)
- [ ] Settings → Reports & Branding — change accent to Teal, custom footer, save
- [ ] Download any PDF — header accent matches; logo visible when toggle on; footer text appears

**Downloads:**

- [ ] Reports Hub — each new card downloads/opens share sheet
- [ ] Daily report detail → PDF includes report date + project
- [ ] Invoice detail → PDF matches invoice totals
- [ ] Compare estimates → PDF reflects idA vs idB
- [ ] Project → BOQ tab → MB + abstract PDFs
- [ ] Subcontract WO PDFs still work (regression)

### 2.12.8 Anti-patterns

| Don't | Do instead |
| ----- | ---------- |
| Duplicate `downloadPdf` in every screen | Use `downloadReportPdf` |
| Add web-only `<a download>` | Use `apiDownload` + Sharing (mobile-first) |
| Break existing Reports Hub GST/TDS role gate | Keep `canFinancials` checks |
| Replace estimate Export PDF with pdf-report route | Keep `useExportEstimate`; add compare PDF only |
| Invent template upload API | Document §2.12.0; logo + report-settings only |

### 2.10.11 Round 30b spec (was ACTIVE — see §2.10.12/§2.10.13)

<details>
<summary>Round 30b original spec (partially done)</summary>

Schema/API + MaterialPicker done. UI/BOQ hint + RA picker → §2.10.13.

</details>

### 2.10.8 Anti-patterns (Round 30)

| Don't | Do instead |
| ----- | ---------- |
| Skip BOQ invalidation after stock issue | `invalidateProjectBoq` + procurement bundle |
| POST material issue on picker tap | Review step + explicit Issue button |
| Hardcode 3 roles in Project Team | Use `INVITABLE_ROLES` + `ROLE_LABELS` |
| Duplicate role enum in Zod | Import role list from `@buildflow/shared` |
| Style pickers only in one screen | Update shared picker components |

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

## 2. Round 24–28 — Subcontract supply + report branding (COMPLETE)

**Status:** All mandatory SUB-C and RPT-C tasks are **done** (§2.0, §2.7). Do not
re-break Rounds 12–23 or Round 24–28 deliverables.

**Shipped capabilities:**

1. **Subcontract / work-order material supply** — `materialSupplyMode` (NONE / GC_SUPPLIED / MIXED),
   MaterialsPanel issue/return, summary totals, edit modal, PDF material tables.
2. **Company-branded PDF reports** — `loadCompanyForPdf` on all 17 generators,
   resolved logos, accent bar + showLogo from Settings → Reports & Branding, Zod-validated API.

**Do not** break Rounds 12–23 (variation two-step flow, EST-VO-11, VAR-D2, shortfalls).

### 2.0 Status (Round 24–28 — all mandatory tasks done)

| ID | Task | Status | Evidence |
| -- | ---- | ------ | -------- |
| **SUB-C1–C3** | Subcontract supply | **Done** | `9e97427`–`ee7defe`, `dfee7be`–`1266096` |
| **RPT-C1** | Logo + footer + accent on PDFs | **Done** | `0e7de58`, `e84859f`, `15ce80a` |
| **RPT-C2** | Report template settings | **Done** | API + UI + Zod (`7107c81`, `e84859f`) |
| **RPT-C3** | PDF layout polish | **Done** | `pdf-layout` re-exports |
| **RPT-C4** | PDF / supply tests | **Done** | **127/127** ×2; buffer + NONE→400 + GC summary |
| **Ship gate** | tsc + tests | **Partial** | Backend tsc ✓, **127/127 ×2** ✓; mobile tsc: 7 pre-existing implicit-any |

### 2.0h Round 28 delivered (do NOT revert)

| Commit | What landed |
| ------ | ----------- |
| `15ce80a` | All 17 `drawHeader` calls pass `{ accentColor, showLogo }` from `loadCompanyForPdf` |

### 2.0g Round 27 delivered (do NOT revert)

| Commit | What landed |
| ------ | ----------- |
| `e84859f` | `drawHeader` accepts `accentColor` + `showLogo`; `updateReportSettingsSchema` + route validation |
| `0e7de58` | `loadCompanyForPdf` on all **17** PDF generators (only raw query left is inside helper) |

**Reference files:**

- Subcontracts UI: `apps/mobile/components/projects/SubcontractsTab.tsx`
- Subcontract backend: `apps/backend/src/services/subcontract.service.ts`
- Material issue schema: `SubcontractorMaterialIssue`, `SubcontractWorkOrder` in `schema.prisma`
- PDF engine: `apps/backend/src/services/pdf-report.service.ts` (`drawHeader`, measurement book, abstract)
- Estimate Excel: `apps/backend/src/services/estimate-export.service.ts`
- Company logo: `settings.service.ts` → `resolveLogoDisplayUrl`, `Company.logoUrl`
- Financial reports: `financial-report.service.ts`, `pdf-report.controller.ts`

### 2.0 Status table (legacy IDs)

| ID | Task | Status |
| -- | ---- | ------ |
| **SUB-C1** | `materialSupplyMode` on work order | **Done** |
| **SUB-C2** | Material issue/return | **Done** |
| **SUB-C3** | Subcontract PDFs | **Done** |
| **RPT-C1** | Logo + footer + accent on PDFs | **Done** |
| **RPT-C2** | Report template settings | **Done** |
| **RPT-C3** | PDF layout polish | **Done** |
| **RPT-C4** | Tests | **Done** |

### 2.0f Round 26 delivered (do NOT revert)

| Commit | What landed |
| ------ | ----------- |
| `dfee7be` | `loadCompanyForPdf`; MB material table; summary supply badge; `updateReportSettings` Json fix |
| `1d82d80` | `MaterialsPanel` + issue/recover UI; `useReportSettings` hooks |
| `7107c81` | `settings/report-branding.tsx`; settings hub link; stronger GC summary test |
| `1266096` | Abstract material table + `loadCompanyForPdf` on abstract |
| `ee7defe` | Edit WO supply-mode modal; `loadCompanyForPdf` on daily/invoice/estimate |

### 2.0d Round 24 delivered (do NOT revert)

| Commit | What landed |
| ------ | ----------- |
| `9e97427` | `MaterialSupplyMode` enum; migration `20260805100000_subcontract_material_supply_mode`; create WO validator; issue/recover/list services + routes; mobile supply-mode chips on **New WO** |
| `ec1bf84` | MB PDF supply label; `drawHeader`/`drawFooter` scaffold; `reportSettings` JSONB + migration `20260805120000_company_report_settings` |
| `07d11b7` | `pdf-layout.ts` helpers; `pdf-report.test.ts` (8 PDF buffer tests) |

### 2.0e Round 25 delivered (do NOT revert)

| Commit | What landed |
| ------ | ----------- |
| `6c04839` | `getWorkOrderSummary`: `materialSupplyMode`, `materialIssuedTotal`, `materialRecoveredTotal`, `netMaterialOnWO`; abstract PDF supply label; all `drawFooter(doc, company)` |
| `835db03` | `getReportSettings` / `updateReportSettings` + routes; tests: GC_SUPPLIED summary, NONE→400, GET report-settings |
| `5464126` | `useMaterialIssues` / `useIssueMaterial` / `useRecoverMaterial` hooks; `pdf-layout` re-exports in `pdf-report.service.ts` |

### 2.0a Completed — Rounds 12–23 variations (do NOT re-break)

| Area | Evidence |
| ---- | -------- |
| Two-step variation | Approve → budget; **convert-to-boq** → BOQ (`a20875e`) |
| Estimate children | EST-VO-11 `estimateId` + `VariationsSection` (`5d61c48`–Round 23) |
| Line editor | VAR-C9 single-line BOQ/RA (`433f10b`) |
| Shortfalls | VAR-C6b after convert |

### 2.0b Prior rounds — do NOT re-break

| ID | Task | Status | Evidence |
| -- | ---- | ------ | -------- |
| **VO-B / R12–14** | Approve → budget; **convert → BOQ**; shortfalls; impact UI | **Done** | `804f0a6`–`a20875e` |
| **VAR-C1** | Explode no duplicate lines (same line) | **Done** | `f055465` — superseded by VAR-C9 UX |
| **VAR-C2** | Remove line (min 1) | **Done** | `f055465` |
| **VAR-C3a/b** | MaterialPicker + RateAnalysisPicker | **Done** | `dbac1aa` |
| **VAR-C4** | Adjust vs new scope copy + FlowHint | **Done** | `f055465` — update copy in VAR-C9 |
| **VAR-C5–C6b** | Ship gate + RA persist + shortfalls | **Done** | `dbac1aa`–`1145896` |
| **VAR-C9** | Single-line BOQ/RA; no Split; BOQ dedupe; all 5 types | **Done** | `433f10b` |
| **EST-VO-11a–d** | estimateId + variations on estimate page | **Done** | `5d61c48` |
| **EST-VO-11e/f** | Cache invalidation + seed/backfill | **Done** | `b6ef712` |
| **VAR-D2** | Approve ≠ BOQ; convert-to-boq endpoint + mobile | **Done** | `a20875e` |

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
2. **BOQ chip = one line** with `boqItemId`; qty Δ applies on **convert-to-boq** (VAR-D2).
3. **One BOQ id per draft** — disable chips already used on another line (VAR-C9b).
4. **Backend shortfalls** RA-explode after **convert** when VARIATION BOQ rows exist (VAR-C6b).

| Intent | UI | On approve | On convert-to-boq |
| ------ | -- | ---------- | ------------------- |
| **Adjust existing BOQ qty** | One line + BOQ chip + qty Δ | Budget/schedule only | `BOQItem.quantity += qtyDelta` |
| **Add new scope** | Type + material **or** RA (**single line**) | Budget/schedule only | New `BOQItem` `category: 'VARIATION'` |

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

**After pulling Round 24 code (`9e97427`+), dev DB must apply migrations or subcontract/PDF APIs may 500:**

```bash
cd /home/prasanna/work/BuildFlow/apps/backend
pnpm exec prisma migrate deploy
pnpm exec prisma generate
# restart backend dev server
```

New migrations: `20260805100000_subcontract_material_supply_mode`,
`20260805120000_company_report_settings`.

**Expected test count:** **131/131** (stable; +2 SUB-BOQ1T subcontract tests).

### 2.2 Mandatory tasks — none (Rounds 33–34 complete)

**Rounds 33–34 complete** (`3493baa`). No mandatory tasks.

Optional stretch: **§2.13** RPT-UI1a-5 / RPT-UI2 · **§2.15.4** VariationsTab + rate source badge · **§2.8** hardening.

Do not break Rounds 12–34 deliverables. Ship gates: backend tsc ✓ · mobile tsc ✓ · **131/131** tests.

<details>
<summary>Round 28 spec (completed — reference)</summary>

RPT-C1e: Pass `accentColor` + `showLogo` to all 17 `drawHeader` calls — **Done** (`15ce80a`).

</details>

---

### 2.2z Reference — Round 26 spec (done; see §2.0f)

#### SUB-C1b — Mobile summary + edit WO

1. In `SubcontractsTab.tsx` `SummaryContent`: show supply mode badge (GC / Contractor / Mixed) and
   `netMaterialOnWO` when mode ≠ `NONE`.
2. On expanded WO edit flow: same supply-mode chips as create; PATCH via existing `updateWorkOrder` (already accepts `materialSupplyMode`).

#### SUB-C2b — Wire Materials UI (hooks already exist)

In `SubcontractsTab.tsx` expanded WO detail, when `summary.materialSupplyMode !== 'NONE'`:

1. Render **Materials** section using `useMaterialIssues`, `useIssueMaterial`, `useRecoverMaterial`
   from `expansion.queries.ts` (`5464126`).
2. List issues; form to issue (resource picker, qty, rate, date); recover partial qty.
3. Hide section entirely when `NONE`.

#### SUB-C3b — PDF material issues table

In `reportSubcontractMeasurementBook` and `reportSubcontractAbstractSheet`:

1. When `GC_SUPPLIED` or `MIXED`: after supply label, render table —
   Resource, Qty, Unit, Rate, Amount, Recovered, Net.
2. MB query already includes `materialIssues` — abstract must add the include.
3. Abstract company query should include `logoUrl` + `address` (currently missing logoUrl).

#### RPT-C1b — Logo resolution + settings in PDF

1. Add helper `loadCompanyForPdf(companyId)` that fetches company + `reportSettings` +
   `resolveLogoDisplayUrl(companyId, logoUrl)`.
2. Pass resolved logo URL to `drawHeader`; use `reportSettings.accentColor` for accent bar.
3. Apply to all report generators (not only subcontract).

#### RPT-C2b — Settings UI + Json fix

1. Fix `updateReportSettings`: store merged object directly — `data: { reportSettings: merged }`
   (not `JSON.stringify`).
2. Mobile: **Reports & branding** screen under Settings (or section in `settings/company.tsx`):
   accent color, show logo toggle, optional footer text. Wire GET/PATCH `/api/settings/report-settings`.
3. Add Zod validator for PATCH body in shared validators.

#### RPT-C4b — Stronger tests

1. Extend GC_SUPPLIED test: actually `POST` material issue (need seed stock + resource), assert list length ≥ 1.
2. Optional: subcontract MB PDF after issue — buffer length > 0.

**Ship gate:** backend tsc ✓; tests **127+** ×2.

---

### 2.2z Reference — Round 25 original spec (mostly done; see §2.2 for gaps)

#### SUB-C1a — Work order summary + edit

1. Extend `getWorkOrderSummary` + `WorkOrderSummary` type (backend + `expansion.queries.ts`):
   - `materialSupplyMode`
   - `materialIssuedTotal`, `materialRecoveredTotal`, `netMaterialOnWO` (zero when `NONE`)
2. Show supply mode badge + material totals on expanded WO in `SubcontractsTab.tsx`.
3. Allow changing `materialSupplyMode` on **edit WO** (same chips as create).
4. Integration test: WO with `NONE` → `POST …/material-issues` returns **400**; `GC_SUPPLIED` → issue succeeds.

#### SUB-C2a — Mobile material issue / return UI

When `materialSupplyMode !== 'NONE'` on WO detail:

1. **Materials** section: list issues (`GET …/material-issues`), issue form (resource, qty, rate, date), recover action.
2. Hide entire section when `NONE`.
3. Use existing routes from `9e97427` — no new backend unless validation gaps found.

#### SUB-C3a — Subcontract PDF material section

In `reportSubcontractMeasurementBook` and `reportSubcontractAbstractSheet`:

1. Supply label on **both** PDFs (abstract currently missing).
2. When `GC_SUPPLIED` or `MIXED`: render table — Resource, Qty, Unit, Rate, Amount, Recovered, Net.
3. `materialIssues` already included in MB query — use it.

#### RPT-C1a — Logo + footer wiring

1. Before PDF generation, call `resolveLogoDisplayUrl(companyId, logoUrl)` from `settings.service.ts`.
2. Pass resolved URL to `drawHeader`; support presigned/S3 logical URLs (not only `http` prefix).
3. Pass **company** object into **every** `drawFooter(doc, company)` call (currently all omit company).
4. Select `reportSettings` + `logoUrl` + `address` + `gstin` in company queries.

#### RPT-C2a — Report settings API + Settings UI

1. GET/PATCH company report settings (accentColor, showLogo, showWatermark, footerText, optional per-type template map).
2. Mobile: **Reports & branding** under Company settings — reuse logo upload from company profile.
3. `drawHeader`: read `reportSettings.accentColor` for accent bar (default amber).

#### RPT-C3a — Wire `pdf-layout.ts`

1. Import shared helpers from `pdf-layout.ts` into `pdf-report.service.ts` (or migrate table functions there).
2. Remove duplicate INR/table logic where safe; keep behavior identical for existing tests.

#### RPT-C4a — Tests

1. Subcontract integration test: create WO `GC_SUPPLIED` → issue material → MB PDF buffer length > 0.
2. Optional: parse PDF text for supply label when feasible; otherwise assert issue list API returns rows.

**Ship gate:** `tsc` backend ✓; tests **124+** ×2; fix mobile tsc only if you touch affected files.

---

### 2.2z Reference — Round 24 original spec (mostly done; see §2.2 for gaps)

#### SUB-C1 — Flexible material supply mode on work orders

**Product rule:** Not every subcontract includes GC-supplied materials. Support:

| Mode | Meaning | Stock / issue UI |
| ---- | ------- | ---------------- |
| **`NONE`** | Contractor supplies all materials (labour-only or full package) | Hide material issue; no stock deduction |
| **`GC_SUPPLIED`** | GC issues materials from site stock to WO | Show issue/return; deduct `StockBalance` |
| **`MIXED`** | Some items GC, some contractor (optional Phase 1.5) | Per-line or per-issue flag |

1. Add enum `MaterialSupplyMode` (`NONE`, `GC_SUPPLIED`, `MIXED`) on `SubcontractWorkOrder`
   (default **`NONE`** for backwards compatibility) + migration.
2. Expose on create/update WO API + Zod validators in `packages/shared`.
3. Mobile `SubcontractsTab`: supply mode selector on create/edit WO with plain-language copy:
   *"Will you issue materials from site stock to this contractor?"*
4. `getWorkOrderSummary`: return `materialSupplyMode`, `materialIssuedTotal`, `materialRecoveredTotal`,
   `netMaterialOnWO` (zero when `NONE`).
5. Integration test: WO with `NONE` → issue endpoint **403 or hidden**; `GC_SUPPLIED` → issue allowed.

#### SUB-C2 — Material issue & return (GC_SUPPLIED only)

Use existing `SubcontractorMaterialIssue` model; add service + routes if missing:

1. `POST /api/projects/:id/subcontract/work-orders/:woId/material-issues` — issue from stock
   (validate stock, write `StockMovement`, link to WO).
2. `POST …/material-issues/:id/recover` — partial/full return to stock.
3. Mobile: **Materials** section on WO detail when `materialSupplyMode !== 'NONE'`.
4. Do **not** require material issue to create measurements or approve payables.

#### SUB-C3 — Subcontract PDFs reflect supply model

Update `reportSubcontractMeasurementBook` / `reportSubcontractAbstractSheet` in
`pdf-report.service.ts`:

- Header line: **Material supply: General contractor / Subcontractor**
- When `GC_SUPPLIED`: table of issued materials (qty, rate, amount, recovered, net)
- Measurement lines remain primary; material section is additive

#### RPT-C1 — Company logo & footer on PDF exports

Refactor `drawHeader` / add `drawFooter` in `pdf-report.service.ts`:

1. Load company via `getCompanyProfile` / `resolveLogoDisplayUrl(companyId, logoUrl)`.
2. Render **logo image** top-right (fallback: company name text if no logo).
3. Footer: company legal name, address, GSTIN, report generated timestamp (IST).
4. Optional: faint watermark logo center (low opacity) — **off by default**, toggle in template settings.
5. Apply to **all** `report*` functions (12 types + subcontract measurement/abstract).

Use existing encrypted storage / presigned URL pattern — do not embed broken URLs.

#### RPT-C2 — Report template settings (per company)

1. Add `CompanyReportSettings` or JSON on `Company`:
   - `defaultTemplateId` or per-type map: `{ estimate: 'classic', boq: 'detailed', … }`
   - `accentColor`, `showLogo`, `showWatermark`, `footerText`
2. Settings UI: **Reports & branding** under Company settings (`settings/company.tsx` or new screen).
3. At PDF generation, merge company settings into layout (column visibility, compact vs detailed).
4. Seed: demo company uses logo from `seed.ts` `COMPANY_LOGO`.

**Phase 1 minimum:** one enhanced template applied everywhere + settings for logo/watermark/accent.
**Phase 2:** multiple named templates user can pick at download time.

#### RPT-C3 — PDF layout polish (shared helpers)

Extract reusable helpers (same file or `pdf-layout.ts`):

- `drawTable(headers, rows, { zebra, align, pageBreak })`
- Consistent INR (`en-IN`), qty + unit columns, right-aligned money
- Section headings, spacing, don't clip long descriptions (wrap or truncate with tooltip in UI list)
- Page numbers on multi-page reports

**Acceptance:** Estimate PDF, BOQ vs Actual, and Subcontract Measurement Book are visually
reviewed at **A4** on web download — no overlapping text, no cut-off totals.

#### RPT-C4 — Line-item completeness audit

For each export path, verify **all business rows** appear:

| Report | Must include |
| ------ | ------------- |
| Estimate PDF/Excel | All sections + line items (top-level; no double-count children) |
| BOQ vs Actual | BOQ rows + executed/billed/variance columns |
| Subcontract MB/Abstract | WO lines + measurement lines + **material issues if GC_SUPPLIED** |
| GST/TDS/P&L | Register lines matching on-screen financial reports |
| Daily / Progress | Tasks, photos refs, KPIs |

Add or extend one integration test per critical PDF (buffer length > 0, contains known seed string).

**Ship gate:** `tsc` ×2 + backend tests **127/127** ×2 (may grow with Round 26 tests — document count).

### 2.2a Product model — subcontract supply (authoritative)

```
Work Order created
  → materialSupplyMode selected (default NONE)
  → If GC_SUPPLIED: optional material issues from stock (independent of measurements)
  → Measurements / RA bills / payables (unchanged)
  → PDF download: branded header + lines + material section if applicable
```

**Do not** block WO activation or measurement submit when no materials issued.

### 2.2b Product model — report branding (authoritative)

```
User → Settings → Company → Reports & branding (logo already uploaded)
  → Pick template / accent / watermark
  → Download report (PDF/Excel) from project or reports hub
  → Output uses company logo + template + full line items
```

### 2.2z Completed Round 23 — reference (do NOT re-break)

| Task | Evidence |
| ---- | -------- |
| VAR-D2b | `VariationsSection` Convert button + `boqAppliedAt` badge on estimate page |
| VAR-D2c | ScopeSummaryBanner, FlowHint, BoqTab, ProcurementTab copy updated |
| VAR-D2d | Test: approve leaves BOQ unchanged; convert updates; double-convert **409** |
| EST-VO-11g | Deep-link `?tab=variations&changeOrderId=` + highlight in `VariationsTab` |
| Route fix | `convert-to-boq` wrapped in `asyncHandler` so 409 returns properly |
| Seed | `VO-002.estimateId` set |

### 2.2b Completed VAR-D2 — reference (do NOT re-break)

| Task | Evidence |
| ---- | -------- |
| Schema | `boqAppliedAt` on `ChangeOrder`; migration `20260805060000` |
| Approve | Budget + schedule + linked WO only — **no BOQ writes** |
| Convert | `convertChangeOrderToBoq` — BOQ qty/create + guarded `boqAppliedAt` |
| Route | `POST …/convert-to-boq` (OWNER, PM) |
| Mobile | `VariationsTab` Convert button + "BOQ applied" badge |
| Seed | `VO-001.boqAppliedAt` set |
| Tests | All `change-order.test.ts` flows: approve → convert → assert BOQ |

**Dev DB:** `pnpm exec prisma migrate deploy` for `20260805060000_change_order_boq_applied_at`.

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
| Variation approve success | "Estimate updated" / "BOQ updated" | **Approved** — prompt **Convert to BOQ** for sanctioned qty |
| Variation line — adjust BOQ | "New item" only | **Link BOQ** + qty Δ (applies on convert) |
| Variation line — new scope | Materials only | **All types:** Material, Labour, Equipment, Subcontractor, Misc |
| Variation line — RA on form | Split RA into components | **One line per RA**; backend explodes for shortfalls after **convert** |
| Variation → BOQ | Auto on approve | **Explicit convert-to-boq** after approve (VAR-D2) |
| Post-approve next step | Review shortfalls immediately | **Convert to BOQ** first, then **Review shortfalls** |
| Estimate page child — sub-estimate | (only sub-estimates listed) | **Sub-Estimate** — planned additional scope; green/primary |
| Estimate page child — variation | (variations only on project tab) | **Variation (CO-xxx)** — amber/warning; convert from Variations tab (estimate page: VAR-D2b) |
| Shortfalls tab | — | Helper: *Uses current BOQ qty (includes **converted** variations)* |
| Negative variation qty | — | Warn: *Open indents are not auto-reduced* (optional R13-O3) |
| Subcontract WO | Materials always from GC | **`materialSupplyMode`** — default NONE |
| Material issue on labour-only WO | Required / implied | **Hidden when NONE** |
| PDF header | "BuildFlow" generic | **Company name + logo** |
| Report download | Code-fixed layout | **Company template + branding settings** |
| Subcontract PDF | Measurements only | **+ material issue table when GC_SUPPLIED** |
| Report line items | Sometimes truncated | **Full rows; paginate; align columns** |

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
| Re-add BOQ writes on variation approve | VAR-D2 — BOQ only via convert-to-boq |
| Force material issue on all subcontracts | Respect `materialSupplyMode: NONE` |
| PDF reports without company logo | RPT-C1 — use `resolveLogoDisplayUrl` |
| Generic "BuildFlow" on client-facing PDFs | Company branding required on downloads |
| Omit WO material lines from subcontract PDF | RPT-C4 when GC_SUPPLIED |
| Stale variations list on estimate page | EST-VO-11e — invalidate on CO mutations |

### 2.7 Definition of Done

**Rounds 12–23 (done — do NOT re-break):** See §2.0a.

**Round 24–28 (SUB-C + RPT-C — complete):**

- [x] SUB-C1–C3 — subcontract supply full stack
- [x] RPT-C1 — loadCompanyForPdf + drawHeader accent/showLogo on all 17 PDFs
- [x] RPT-C2 — report settings API + UI + Zod
- [x] RPT-C3 — pdf-layout
- [x] RPT-C4 — 127 tests (buffer + supply mode + settings GET)
- [x] Ship gate backend **127/127** ×2; backend tsc ✓

### 2.8 Optional hardening (defer unless user asks)

| ID | Task |
| -- | ---- |
| **RPT-O1** | ~~`footerText` from reportSettings in `drawFooter`~~ | **Done** |
| **RPT-O2** | ~~E2E test: seed stock → POST material issue → list length ≥ 1~~ | **Done** — 128 tests |
| **RPT-O3** | ~~Refactor drawHeader sites to `drawBrandedHeader` / helpers~~ | **Done** |
| **RPT-O4** | Branded Excel exports (`estimate-export.service.ts`) | **Done** |
| **MOB-O1** | ~~Fix mobile tsc implicit-any~~ | **Done** |
| **SUB-UX-O1** | Material issue: optional date/notes; hide zero-stock BOQ rows in picker; bill hint on approved measurements |
| **NR-38** | ~~Material issue discard must use `confirmAsync` not `alertAsync`~~ | **Done** (`bb50b2a`) |
| **SUB-BOQ1C** | ~~BOQ line picker on issue + BoqTab "Issued to subs" + boqItemId validation~~ | **Done** (`2d8f324`) |
| **MOB-PICK1b** | ~~RateAnalysisPicker visual polish (match MaterialPicker)~~ | **Done** (`2d8f324`) |
| **SUB-BOQ1T** | ~~Integration test: issue with `boqItemId` → BOQ `subIssuedQty` or list returns link~~ | **Done** |
| **MOB-LINK1** | ~~Unified ProcurementLinkPicker — estimate + variation~~ | **Done** (`1d86081`) |
| **MOB-LINK2** | Extract shared `PickerListRow` | §2.11.11 stretch |
| **MOB-LINK4** | Refactor IndentDraftLineCard to use ProcurementLinkPicker | §2.11.11 stretch |
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

Rounds 8–23: variation workflow complete. **Round 24–28:** subcontract supply +
report branding **complete** (§2.0h).

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
