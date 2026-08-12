# BuildFlow - Standalone Fix Prompt for GLM-5.2 (Round 40 TALLY-1)

> **Baseline:** `fdc1271` · main  
> **Active work:** **§2.21 Round 40 - Tally Prime export** - **COMPLETE**  
> **Do not re-break:** Round 40 deliverables or Rounds 12–39.

---

## 2.21 Round 40 - TALLY-1 (COMPLETE)

### Verification

| Item | Status |
|------|--------|
| Sales retention balances (debit Retention Money) | Done |
| Purchase retention + advance recovery lines | Done |
| `gstAmount` fallback when CGST/SGST/IGST unset | Done |
| `retention` + `advanceRecovery` in schema / Integrations UI / seed / `.env.example` | Done |
| Export to Tally on Project Accounting + Reports Hub | Done |
| `tally-export.test.ts` (8 tests) | Pass |
| `.env.test` `BCRYPT_COST=8` (unblocks integration suite) | Done |

### Definition of done

- [x] Sales vouchers with retention balance (signed amount sum ≈ 0)
- [x] `retention` (+ `advanceRecovery`) in shared schema + Integrations UI + seed / `.env.example`
- [x] In-app **Export to Tally** download wired to existing API
- [x] Integration tests green under `pnpm --filter @buildflow/backend test -- tally-export`
- [x] Docs updated for export location
- [x] No regressions to purchase IGST/CGST split or IST dates

### Key files touched

- `apps/backend/src/services/tally.service.ts`
- `apps/backend/src/services/integration.service.ts`
- `apps/backend/src/__tests__/integration/tally-export.test.ts`
- `packages/shared/src/validators/settings.ts`
- `apps/mobile/app/(app)/settings/integrations.tsx`
- `apps/mobile/app/(app)/accounting/project/[id].tsx`
- `apps/mobile/app/(app)/reports-hub/index.tsx`
- `apps/mobile/services/report-download.ts`

### Working rule

Do not recreate `AUDIT_FINDINGS.md`. Do not re-credit sales retention while using post-retention `invoice.total`.
