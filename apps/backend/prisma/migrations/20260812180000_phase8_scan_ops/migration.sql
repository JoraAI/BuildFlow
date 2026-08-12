-- INVENTORY_HORIZONTAL_PLATFORM (Phase 8): commercial polish & scan ops.
-- All new columns are nullable so construction flows (BOQ/estimates/procurement)
-- are untouched.

-- 8.3 Batch / lot lite: optional batch code on movements + GRN lines + DC lines.
ALTER TABLE "stock_movements" ADD COLUMN "batch_code" TEXT;
ALTER TABLE "goods_receipt_lines" ADD COLUMN "batch_code" TEXT;
ALTER TABLE "delivery_challan_lines" ADD COLUMN "batch_code" TEXT;

-- 8.4 Invoice line ↔ Resource link for true margin reports.
ALTER TABLE "invoice_line_items" ADD COLUMN "resource_id" UUID;
CREATE INDEX "invoice_line_items_resource_id_idx" ON "invoice_line_items" ("resource_id");
