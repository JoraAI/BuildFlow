-- INVENTORY_HORIZONTAL_PLATFORM (Phase 0): optional inventory business profile.
-- 1) New enum type (mirrors shared `InventoryBusinessProfile`).
CREATE TYPE "InventoryBusinessProfile" AS ENUM ('RETAIL','WHOLESALE','DISTRIBUTION','TRADING','MATERIAL_SUPPLIER','EQUIPMENT','GENERAL');

-- 2) Company.inventory_profile - optional per-company profile.
--    DEFAULT 'GENERAL' backfills existing rows. Construction tenants keep the
--    (hidden) DB value but never read/update it (service returns null).
ALTER TABLE "companies"
  ADD COLUMN "inventory_profile" "InventoryBusinessProfile" DEFAULT 'GENERAL';
