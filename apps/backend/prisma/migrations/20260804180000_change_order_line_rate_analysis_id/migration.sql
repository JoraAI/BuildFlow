-- VAR-C6: Add rate_analysis_id to change_order_lines so new-scope variation
-- lines created from a RateAnalysis can persist the RA link. On approve,
-- the new BOQItem gets rateAnalysisId directly, enabling the shortfall
-- scanner to RA-explode composite BOQ rows.

-- ChangeOrderLine: add rate_analysis_id
ALTER TABLE "change_order_lines" ADD COLUMN "rate_analysis_id" UUID;
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_rate_analysis_id_fkey"
  FOREIGN KEY ("rate_analysis_id") REFERENCES "rate_analyses"("id") ON DELETE SET NULL;

-- BOQItem: add resource_id + rate_analysis_id for variation-created rows
ALTER TABLE "boq_items" ADD COLUMN "resource_id" UUID;
ALTER TABLE "boq_items" ADD COLUMN "rate_analysis_id" UUID;
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL;
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_rate_analysis_id_fkey"
  FOREIGN KEY ("rate_analysis_id") REFERENCES "rate_analyses"("id") ON DELETE SET NULL;