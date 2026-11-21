-- Optional per-unit buy/vendor cost (blank → Resource.costPrice × conversion_to_base).
ALTER TABLE "resource_units" ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(12, 2);
