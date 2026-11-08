-- Owner-declared opening cash/bank for GST handoff packs (period start).
ALTER TABLE "gst_handoff_packs"
ADD COLUMN IF NOT EXISTS "opening_cash_balance" DECIMAL(14, 2);
