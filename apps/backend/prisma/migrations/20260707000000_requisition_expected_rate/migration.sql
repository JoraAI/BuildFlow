-- Expected rate snapshots on material requisition lines

ALTER TABLE "material_requisition_lines" ADD COLUMN "expected_rate" DECIMAL(12,2);
ALTER TABLE "material_requisition_lines" ADD COLUMN "rate_source" TEXT;
