-- FIX (DAT-3.6): Add missing indexes for performance.
-- StockMovement: resource and reference lookups
CREATE INDEX IF NOT EXISTS "stock_movements_resource_id_idx" ON "stock_movements"("resource_id");
CREATE INDEX IF NOT EXISTS "stock_movements_reference_id_idx" ON "stock_movements"("reference_id");

-- InvoiceLineItem: BOQ item lookup
CREATE INDEX IF NOT EXISTS "invoice_line_items_boq_item_id_idx" ON "invoice_line_items"("boq_item_id");

-- Composite indexes for tenant+status queries
CREATE INDEX IF NOT EXISTS "invoices_company_id_status_idx" ON "invoices"("company_id", "status");
CREATE INDEX IF NOT EXISTS "bills_company_id_status_idx" ON "bills"("company_id", "status");
CREATE INDEX IF NOT EXISTS "estimates_company_id_status_idx" ON "estimates"("company_id", "status");

-- FIX (DAT-3.7): Partial unique index preventing duplicate open attendance check-ins
-- (a user can only have one open check-in per project where check_out_at IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "attendances_user_project_open_idx"
  ON "attendances"("user_id", "project_id")
  WHERE "check_out_at" IS NULL;