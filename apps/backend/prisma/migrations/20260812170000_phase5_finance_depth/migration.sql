-- INVENTORY_HORIZONTAL_PLATFORM (Phase 5): finance depth.
-- WAC valuation, landed cost on GRN, note GST state split. All new columns are
-- nullable/defaulted so construction flows are untouched.

-- 5.2 Weighted-average cost on Resource + cost metadata on StockMovement.
ALTER TABLE "resources" ADD COLUMN "avg_cost" DECIMAL(14,4) NOT NULL DEFAULT 0;

ALTER TABLE "stock_movements"
    ADD COLUMN "unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    ADD COLUMN "inventory_value" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- 5.1 Landed cost on GoodsReceiptNote + unit cost on GoodsReceiptLine.
ALTER TABLE "goods_receipt_notes"
    ADD COLUMN "freight_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "insurance_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "handling_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "customs_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "landed_cost_allocation" TEXT NOT NULL DEFAULT 'QUANTITY';

ALTER TABLE "goods_receipt_lines" ADD COLUMN "unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- 5.5 GST state split on credit/debit notes.
ALTER TABLE "credit_notes"
    ADD COLUMN "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "debit_notes"
    ADD COLUMN "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
