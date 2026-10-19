-- Cash book expense categories (all inventory verticals) + production wastage qty.
ALTER TABLE "inventory_cash_book_entries"
  ADD COLUMN IF NOT EXISTS "category" TEXT;

ALTER TABLE "production_batches"
  ADD COLUMN IF NOT EXISTS "wastage_qty" DECIMAL(12, 3) NOT NULL DEFAULT 0;
