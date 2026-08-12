-- INVENTORY_HORIZONTAL_PLATFORM (Phase 4): procurement automation.
-- Reorder master fields on Resource; PO approval thresholds on Company.
-- All new columns are nullable/defaulted so construction flows are untouched.

ALTER TABLE "resources"
    ADD COLUMN "preferred_vendor_id" UUID,
    ADD COLUMN "reorder_qty" DECIMAL(12,3),
    ADD COLUMN "lead_time_days" INTEGER;

ALTER TABLE "companies"
    ADD COLUMN "po_auto_approve_below" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "po_owner_approve_above" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "resources" ADD CONSTRAINT "resources_preferred_vendor_id_fkey" FOREIGN KEY ("preferred_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
