-- Auto-post vendor bill payments to the inventory cash book.
ALTER TYPE "CashBookEntryType" ADD VALUE IF NOT EXISTS 'VENDOR_PAYMENT';

ALTER TABLE "inventory_cash_book_entries"
  ADD COLUMN IF NOT EXISTS "bill_id" UUID,
  ADD COLUMN IF NOT EXISTS "vendor_id" UUID;

CREATE INDEX IF NOT EXISTS "inventory_cash_book_entries_bill_id_idx"
  ON "inventory_cash_book_entries"("bill_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_cash_book_entries_bill_id_fkey'
  ) THEN
    ALTER TABLE "inventory_cash_book_entries"
      ADD CONSTRAINT "inventory_cash_book_entries_bill_id_fkey"
      FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_cash_book_entries_vendor_id_fkey'
  ) THEN
    ALTER TABLE "inventory_cash_book_entries"
      ADD CONSTRAINT "inventory_cash_book_entries_vendor_id_fkey"
      FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
