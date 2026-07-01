-- BOQ procured qty (from GRN linked via indent) + estimate rate analysis BOM link
ALTER TABLE "boq_items" ADD COLUMN "procured_qty" DECIMAL(12,3) NOT NULL DEFAULT 0;

ALTER TABLE "estimate_items" ADD COLUMN "rate_analysis_id" UUID;

CREATE INDEX "estimate_items_rate_analysis_id_idx" ON "estimate_items"("rate_analysis_id");

ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_rate_analysis_id_fkey" FOREIGN KEY ("rate_analysis_id") REFERENCES "rate_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
