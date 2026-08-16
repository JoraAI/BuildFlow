-- Phase 11.5: keep printed MRP distinct from the tenant's selling rate.
-- Nullable fields preserve all construction and existing inventory resources.
ALTER TABLE "resources"
  ADD COLUMN "mrp" DECIMAL(12,2),
  ADD COLUMN "mrp_updated_at" TIMESTAMP(3);
