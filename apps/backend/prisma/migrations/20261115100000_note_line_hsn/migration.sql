-- Persist HSN/SAC on credit/debit note lines so GST pack freeze is stable.
ALTER TABLE "credit_note_lines" ADD COLUMN IF NOT EXISTS "hsn_sac_code" TEXT;
ALTER TABLE "debit_note_lines" ADD COLUMN IF NOT EXISTS "hsn_sac_code" TEXT;
