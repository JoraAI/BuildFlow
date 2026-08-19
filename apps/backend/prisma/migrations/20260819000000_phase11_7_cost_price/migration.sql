-- Phase 11.7 (INVENTORY_KIRANA_RETAIL_WHOLESALE): vendor unit cost distinct
-- from the selling `rate`. Nullable so construction and existing inventory
-- resources are unaffected. Inventory-only; `rate` stays the estimate catalog
-- rate on construction.
ALTER TABLE "resources"
  ADD COLUMN "cost_price" DECIMAL(12,2);

-- Backfill inventory companies only: costPrice = avgCost when avgCost > 0,
-- else null. Never overwrites `rate`.
UPDATE "resources" r
SET "cost_price" = r."avg_cost"
FROM "companies" c
WHERE r."company_id" = c."id"
  AND c."subscription_plan" = 'INVENTORY'
  AND r."avg_cost" > 0;
