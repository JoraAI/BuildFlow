-- ICE_CREAM: per-SKU distributor / customer sell prices for B2B catalog
ALTER TABLE "resources"
  ADD COLUMN "distributor_rate" DECIMAL(12,2),
  ADD COLUMN "customer_rate" DECIMAL(12,2);
