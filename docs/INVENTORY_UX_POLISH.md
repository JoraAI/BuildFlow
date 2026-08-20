# BuildFlow - Inventory UX Polish - Implementation Plan (Deepseek-Flash-V4)

> **Audience:** Deepseek-Flash-V4 (coding agent)  
> **Repo:** `/home/prasanna/work/BuildFlow`  
> **Products in scope for AI (D10 + D11):** **both** Construction ERP **and** Inventory - same assistant stack, product-scoped prompts/tools.  
> **Current AI pass:** **D11 is code-complete.** Operator device smoke of formatted assistant replies remaining. Do not reimplement D10 routing.  
> **Pricing:** Inventory **₹499/mo** / **₹4,990/yr** - do not regress.  
> **Construction safety:** Indent auto-approve **only** when `subscriptionPlan === 'INVENTORY'`. Construction `ProcurementTab` keeps Draft → Submit → Approve.  

---

## 0. Locked decisions

| # | Decision |
|---|----------|
| D1 | Responsive phone / tablet / desktop via `useViewport` |
| D2 | Inventory indent create → **APPROVED**; construction DRAFT flow unchanged |
| D3 | Indent **Create PO** → orders tab + modal prefill |
| D4 | PO **Record GRN** → GRNs tab + modal prefill |
| D5 | No duplicate primary create CTAs on inventory procurement |
| D6 | Optional invoice `clientAddress` / `clientPhone` |
| D7 | Materials edit rate + delete |
| D8 | PO/GRN numbers auto-suggested (`PO/GRN-YYYY-NNNN`); user may edit before save |
| D9 | Multi-material procure + retrieve (Indent / PO / GRN / Issue with multiple lines) |
| **D10** | **LLM routing (Construction + Inventory):** when a tenant/platform has a configured content LLM (or uploaded knowledge), **that** LLM owns chatbot + upload-related AI for **both** product modes - not a hard-coded Deepseek product model. Deepseek-v4-flash = coding agent only. |
| **D11** | **Chat replies (entire system):** the assistant answers the user’s question only. No trailing “you can also ask…”, suggested follow-ups, or extra action pitches. Format with short markdown (heading, bullets, numbered steps, compact tables for figures). Chat UI must render that markdown. Empty-state starter chips before the first message may stay. Same rules for Construction, Inventory, and the marketing product guide. D10 routing is unchanged. |

---

## 1. Verification status (re-verified 2026-08-11)

### 1.1 D1–D10 - CODE + DOC COMPLETE

| Item | Evidence | Construction impact |
|------|----------|---------------------|
| D2 | `autoApprove = subscriptionPlan === 'INVENTORY'` only | **Safe** |
| D9 | Multi indent/PO/GRN/issue | Inventory UI + Inventory-gated invoice |
| D2 regression | `procurement.test.ts` multi-line create → `status === 'DRAFT'` | Locked |
| No construction draft invoice on issue | `construction manual stock issue does NOT create a draft sales invoice` → `draftInvoiceId` null | Locked |
| D10 | §6.1–§6.8 + comment on `callLLMOnce` | Shared chatbot; content LLM for both products |
| Tests | `inventory-product` + `procurement.test` → **32/32 PASS** | Green |

**`ProcurementTab.tsx`:** D8 number prefill only. Draft → Submit → Approve **intact**.

### 1.2 Construction ERP - verified safe

| Risk | Status |
|------|--------|
| Auto-APPROVE leak | **No** - plan gate + DRAFT assertion in tests |
| Issue creates sales invoice | **No** - inventory-only draft invoice + construction issue test |
| Chatbot / LLM | **Content LLM via `resolveLlmConfig`** for Construction + Inventory; Deepseek = coding agent |

### 1.3 Remaining gaps (THIS Deepseek pass - smoke / ops only)

Do **not** reimplement D1–D10. Only:

1. **Manual smoke** (if app + API running):
   - Inventory `owner@hydmaterials.com` / `Test@1234`: 2-material Indent → PO → GRN → Issue materials (2 lines) → one draft invoice; assistant opens from `/inventory`.
   - Construction `owner@reddyconst.com` / `Test@1234`: multi-line indent stays **Draft** until Submit → Approve; assistant opens from dashboard; no unexpected draft sales invoice on stock issue.
2. **Ops notes** in §3 if migrate / login payload already done in your env.
3. Fix **only** concrete smoke bugs (prefer inventory UI; never touch auto-approve gating or Draft→Submit→Approve).
4. Update §3 smoke/ops checkboxes when done.

### 1.4 Non-issues

- Multi-issue `stockMovementId` = first movement - intentional.  
- Duplicate PO 409 console noise in tests - expected.  
- §6 line numbers may drift; prefer symbol names (`callLLMOnce`, `resolveLlmConfig`) over fragile Lxx cites.

---

## 2. What Deepseek should do THIS pass

**Status (2026-08-20): M1–M4 code-complete** (see §3 evidence). Remaining work is optional device/browser smoke only.

**Goal (completed in code):** Mobile / PWA polish M1–M4 — camera on mobile browsers, tab bar gap, header name cutoff, stock search.

If revisiting this pass:

1. Re-read §3 **Mobile / PWA polish** + evidence.  
2. Do not reimplement M1–M4 unless a smoke bug is found.  
3. Optional: manual smoke on phone/iPad Safari or Chrome (HTTPS).  
4. Leave smoke/ops boxes unchecked if env unavailable.  

**Do not:**

- Change auto-approve gating  
- Rewrite Draft→Submit→Approve  
- Hard-code Deepseek as product chat model  
- Build RAG / embedding / upload AI product this pass  
- Re-open pricing / reimplement D9 / D10 / D11  

---

## 3. Checklist

### Implementation - done

- [x] D1–D9  
- [x] Construction multi-line indent → **DRAFT** regression  
- [x] Construction stock issue → `draftInvoiceId` null  
- [x] **D10** §6 feasibility (Construction + Inventory) + `callLLMOnce` comment  
- [x] Tests **32/32** green (`inventory-product` + `procurement.test`)  

### D11 - Assistant answer format (THIS coding pass, with Kirana 11.7)

- [x] `buildPermissionAwarePrompt` CORE RULES: answer only; no trailing suggestions / “would you like” / extra questions after the answer; use markdown (heading + bullets/tables)
- [x] `buildProductMarketingPrompt` same answer-only + markdown rule
- [x] `AssistantChatContent` renders bot markdown (bold, headings, lists, simple tables) instead of a single raw `Text`; user bubbles stay plain
- [x] Empty-state chips remain until first send; no post-reply suggestion chips
- [x] Construction + Inventory overlays share this UI; D10 `resolveLlmConfig` unchanged; do not hard-code Deepseek as chat model
- [x] Shared build + existing chatbot/prompt tests if present; no Construction Draft→Submit→Approve changes

**Evidence (2026-08-19):** `packages/shared` build clean; `apps/backend` tsc clean; full backend jest green (inventory-product 69/69 incl. Phase 11.7, procurement.test + inventory-labels); mobile `tsc --noEmit` clean. `prompt-builder.ts` rules 9/10 + marketing `## ANSWER ONLY`/`## FORMAT`; `AssistantChatContent.tsx` `MarkdownBlocks` renderer (headings `#`–`###`, `**bold**`, `` `code` ``, `-`/`*` lists, numbered lists, GFM `|` tables). D10 routing untouched (no `resolveLlmConfig` change, no model hard-coding).

### THIS pass (smoke / ops)

- [ ] Manual smoke inventory multi procure + multi issue + assistant overlay  
- [ ] Manual smoke construction Draft → Submit → Approve + assistant overlay  
- [ ] Prod migrate `20260811140000_invoice_client_contact` if needed  
- [ ] Confirm login returns `productMode` / `subscriptionPlan` / `defaultProjectId`  

### Mobile / PWA polish (operator-reported 2026-08-20) - CODE COMPLETE

Operator bugs on Inventory **mobile browsers / iPad / phone** (Kirana or materials demo). Fixed in code; optional live-device smoke remains.

| # | Bug | Root cause (repo) | Target fix |
|---|-----|-------------------|------------|
| **M1** | **Scan** does not open camera on iPad / phone **browser** | `BarcodeScannerOverlay.tsx` sets `isNative = Platform.OS !== 'web'` and shows “Camera scanner is mobile-only” on all web builds - including mobile Safari/Chrome. Native `expo-camera` path is fine for Expo Go / native builds only. | On web **phone/tablet** (`useViewport` + UA / coarse pointer): open camera via `getUserMedia` + `BarcodeDetector` where available, else `@zxing/browser` (or equivalent) continuous decode. Keep keyboard/paste + Find. Desktop web may keep keyboard-only. Same overlay used from Stock (`inventory/index.tsx`) and checkout (`CheckoutCart.tsx`). Request `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`. HTTPS / secure context required. |
| **M2** | Inventory **bottom tab bar** sits high with empty gap above the screen bottom | Double chrome padding: `useAppViewportLock` already sets `--app-height` to **visualViewport.height** (chrome excluded), but `InventoryMobileTabBar` still adds `tabBarPaddingBottom(..., chromeBottom)` with a **56px web floor** (`fab-layout.ts`). That pads *inside* an already-shrunk viewport. | When app height is locked to visual viewport, tab bar bottom padding should use **safe-area / env(safe-area-inset-bottom) only** (small floor on native), **not** re-add `chromeBottom` / 56px. Align `AppTabBar` the same way if it shows the same gap. Verify on iOS Safari + Android Chrome. |
| **M3** | Top bar **company / profile name cut off mid-string** on mobile | `inventory/_layout.tsx` top bar: left title `BuildFlow · Inventory` is `shrink-0`; right chip is `max-w-[220px]` but competes with bell + title on narrow widths → name truncates badly / looks chopped. Stock page also prints `user.companyName` under the title without a resilient ellipsis layout. | Mobile header: allow title to shrink (`min-w-0`), shorter mobile title (“Inventory”), put company name in a `flex-1 min-w-0` row with `numberOfLines={1}` + ellipsis; show user initial avatar if space is tight (mirror `AppMobileHeader`). Do not clip mid-glyph without ellipsis. |
| **M4** | Stock page **search works poorly** | Client filter only matches `name` + `unit` (`inventory/index.tsx` `filteredSummary`). `getStockSummary` / `StockSummaryRow` omit `sku`, `itemCode`, `barcode`. Search `Input` lives in FlatList `ListHeaderComponent` (focus / re-render jank on mobile). | (1) Include `sku`, `itemCode`, `barcode` on stock summary API + shared types. (2) Filter on name, sku, itemCode, barcode, unit (case-insensitive). (3) Move search field **above** the list (sticky / outside `ListHeaderComponent`) so typing does not remount the input. Optional: debounce 150–200ms. Empty state: “No items match …”. |

**Acceptance (Inventory `owner@hydmaterials.com` / `Test@1234` or Kirana demo):**

1. Phone/iPad **Safari or Chrome** on HTTPS: Stock → **Scan** → camera preview → scan EAN/Code128 → item found (or clear miss toast). Keyboard Find still works.  
2. Bottom nav sits flush to the visible bottom (home indicator / browser bar) with **no large empty strip** under the tabs.  
3. Top bar shows full company name with ellipsis if needed; never mid-word cut without `…`.  
4. Typing a SKU / barcode / partial name filters the stock list immediately and reliably; focus does not jump.

**Do not:** change Construction indent gating; change Inventory ₹499 pricing; hard-code Deepseek as chat model; disable keyboard barcode Find.

**Primary files:**

```
apps/mobile/components/inventory/BarcodeScannerOverlay.tsx
apps/mobile/app/inventory/index.tsx
apps/mobile/app/inventory/_layout.tsx
apps/mobile/components/navigation/InventoryTabBar.tsx
apps/mobile/components/navigation/AppTabBar.tsx
apps/mobile/components/layout/fab-layout.ts
apps/mobile/hooks/useAppViewportLock.ts
apps/mobile/hooks/useVisualViewportFrame.ts
apps/backend/src/services/procurement.service.ts   # getStockSummary select + StockSummaryRow
apps/mobile/services/expansion.queries.ts         # StockSummaryRow type
```

**Verify:** `pnpm --filter @buildflow/mobile typecheck`; backend tests touching stock summary if API shape changes; manual mobile-browser smoke for M1–M4.

**M1–M4 status:**

- [x] M1 web mobile camera Scan  
- [x] M2 tab bar gap removed  
- [x] M3 header name ellipsis / layout  
- [x] M4 stock search fields + sticky input  

**Evidence (2026-08-20, code-complete; re-verified):** mobile `tsc --noEmit` clean; backend `tsc` clean; `procurement.test` **22/22** + `inventory-product` **69/69** green. `@zxing/browser` in `apps/mobile/package.json`. i18n key `inventory.shell.titleMobile` added for M3 phone header. Live phone/iPad Scan smoke still optional.
- **M1** `BarcodeScannerOverlay.tsx`: web phone/tablet now calls `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`; decodes via native `BarcodeDetector` when present, else `@zxing/browser` (added dep `@zxing/browser ^0.2.1`). Secure-context check + clear permission/unsupported/denied messages; rear-camera flip supported; desktop web keeps the keyboard/paste note; native `expo-camera` path unchanged.
- **M2** `fab-layout.ts tabBarPaddingBottom`: no longer re-adds `chromeBottom`/56px web floor when the app is pinned to the visual viewport — safe-area inset only (`max(safeBottom, 8)`); `InventoryMobileTabBar` + `AppTabBar` both use the shared helper.
- **M3** `inventory/_layout.tsx`: phone title shortens to “Inventory”; title + company chip are `min-w-0`/`shrink` with `numberOfLines={1}` ellipsis; Stock page subtitle ellipsizes.
- **M4** `getStockSummary` select + `StockSummaryRow` + mobile type expose `sku`/`itemCode`/`barcode`; stock search filters name/unit/sku/itemCode/barcode case-insensitively with a 150 ms debounce; search input moved above the FlatList (no remount jank); empty state “No items match …”.

---

## 4. Credentials

- Inventory: `owner@hydmaterials.com` / `Test@1234` → `/inventory`  
- Construction: `owner@reddyconst.com` / `Test@1234` → project Procurement / dashboard  

---

## 5. Non-goals

- Do not remove auto draft bills/invoices on GRN/Issue  
- Do not auto-approve non-INVENTORY indents  
- Do not redesign construction procurement  
- Do not change Inventory price from ₹499/mo  
- Do not reimplement D9 / D10 if already green  
- Do not replace tenant/platform BYOK LLM with Deepseek for chatbot (Construction **or** Inventory)  
- Do not fork an Inventory-only or Construction-only assistant  

---

## 6. Deepseek-v4-flash feasibility vs existing content LLM (D10) - DONE

### 6.1 What exists today (repo fact)

| Piece | Path / mechanism |
|-------|------------------|
| In-app assistant | `chatbot.service.ts` - OpenAI-compatible `/chat/completions` |
| Tool calling | `assistant-tools.service.ts` + `buildPermissionAwarePrompt` |
| Config | `resolveLlmConfig(companyId)` → company Settings LLM, else platform `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL` via `resolvePlatformLlmConfig()` |
| Construction shell | `apps/mobile/app/(app)/_layout.tsx` → `AssistantOverlay` |
| Inventory shell | `apps/mobile/app/inventory/_layout.tsx` → same `AssistantOverlay` |
| Marketing | `MarketingAssistantFab` → public chatbot; platform LLM; no tenant data |
| Settings | `llmIntegrationSchema` - any OpenAI-compatible host |

**Wiring:** `callLLMOnce` uses `resolveLlmConfig(companyId)` when logged-in, else `resolvePlatformLlmConfig()`, then `POST {cfg.apiUrl}/chat/completions` with `model: cfg.model`. Tools: `buildOpenAiTools(identity.permissions, identity.productMode)` so Inventory cannot call construction-only tools on the shared service.

### 6.2 Roles for Deepseek-v4-flash

| Role | Recommendation |
|------|----------------|
| Coding agent | **Primary** - implement features for both products |
| Default in-app chat model | **Do not force** if content LLM configured |
| Upload / doc AI answers | Always **content LLM** (`resolveLlmConfig`) when configured |
| RAG / embeddings | Out of scope until a dedicated design |

### 6.3 Locked routing rule (D10)

```
IF resolveLlmConfig / resolvePlatformLlmConfig succeeds
  → chatbot + upload-related AI MUST use that configured LLM
ELSE
  → graceful “AI not configured”
NEVER hard-code Deepseek-v4-flash as the product chat model
Deepseek-v4-flash = coding agent for BuildFlow implementation
```

Applies to **Construction ERP and Inventory** equally.

### 6.4 Feasibility notes

OpenAI-compatible API already; tool calling must be verified before ops points platform `LLM_*` at any Deepseek-hosted chat. Per-company settings for privacy. Upload AI must not introduce a second provider.

### 6.5 Dual-product matrix

| Product | UI | Backend | Upload AI examples (future) |
|---------|-----|---------|------------------------------|
| Construction | `(app)/_layout` → Overlay | Same `chatbot.service` | BOQ PDF, daily-report photos, vendor bill PDF |
| Inventory | `inventory/_layout` → Overlay | Same | GRN/PO scans, invoice images, catalog |
| Marketing | Marketing FAB | Public route | N/A (no tenant content) |

### 6.6 Decision tree

```mermaid
flowchart TD
    Q{Content LLM configured?} -->|"resolveLlmConfig OR resolvePlatformLlmConfig"| A[callLLMOnce uses cfg.model]
    Q -->|null| C[AI not configured]
    A --> C1[Construction AssistantOverlay + construction tools]
    A --> C2[Inventory AssistantOverlay + productMode tool denylist]
    D[Deepseek-v4-flash] -->|coding agent only| E[Implements features for BOTH shells]
    E --> C1
    E --> C2
```

### 6.7 Future upload AI checklist (when built later)

1. Reuse `callLLMOnce` / `resolveLlmConfig` for both products.  
2. Respect `productMode` + `buildOpenAiTools(...)`.  
3. One assistant service - no product fork.  
4. No RAG DB / embedding service / silent `.env` model swap without ops consent in polish pass.

---

## 8. D11 - Chatbot answer format (implement with Kirana 11.7)

**Verified gap:** Bot bubbles in `AssistantChatContent.tsx` render `item.message` as one plain `Text`. System prompt asks the model to “be concise” but never forbids follow-up suggestions, so replies often end with “Would you like me to…”. This applies to Construction, Inventory, and marketing.

### 8.1 Prompt (must)

In `packages/shared/src/permissions/prompt-builder.ts` add CORE RULES for both `buildPermissionAwarePrompt` and `buildProductMarketingPrompt`:

1. **Answer only.** After answering, stop. Do not offer more help, extra questions, “you can also ask”, suggested next prompts, or tool pitches unless the user asked what they can do.
2. **Format.** Use compact GitHub-flavored markdown:
   - One short `##` heading that names the answer
   - Bullets for lists of items
   - Numbered steps for procedures
   - A markdown table when comparing figures (₹, qty, dates)
   - **Bold** key numbers and statuses
   - Blank line between sections; no walls of text
3. **Tools.** Still call tools for live data (D10). Put tool results into that markdown. Do not dump raw JSON.
4. Confirm write actions before calling write tools (existing rule 3 stays).

### 8.2 UI (must)

`apps/mobile/components/assistant/AssistantChatContent.tsx` (used by Construction overlay, Inventory overlay, and any shared chat surface):

- Parse **bot** messages as markdown. Minimum: headings, `**bold**`, unordered/ordered lists, fenced or indented not required, GFM tables (`| a | b |`).
- Prefer a small existing helper or a few `Text` styles — do **not** add a heavy markdown WebView if a lightweight renderer is enough. If you add a dependency, it must work on web + native Expo.
- User messages stay plain text.
- Starter chips stay on **empty** threads only (already implemented). Do **not** add suggestion chips under a completed bot reply.
- Marketing FAB uses the marketing prompt; apply the same answer-only rule even if that UI stays simpler.

### 8.3 Non-goals

- Do not change D10 LLM routing or hard-code Deepseek as the chat model.
- Do not add RAG.
- Do not remove permission/tool gating.

Implement D11 in the **same Deepseek pass** as Kirana plan Phase 11.7. Copy-paste command: Kirana plan §9.


```
apps/backend/src/services/chatbot.service.ts
apps/backend/src/services/assistant-tools.service.ts
apps/backend/src/services/integration.service.ts
apps/backend/src/routes/chatbot.routes.ts
packages/shared/src/permissions/prompt-builder.ts
packages/shared/src/validators/settings.ts
apps/mobile/components/assistant/*
apps/mobile/app/(app)/_layout.tsx
apps/mobile/app/inventory/_layout.tsx
apps/mobile/app/(app)/settings/integrations.tsx
apps/mobile/components/marketing/MarketingAssistantFab.tsx
```
