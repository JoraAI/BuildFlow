-- BuildFlow Inventory product (INVENTORY_PRODUCT_IMPL)
-- 1) New SubscriptionPlan value: INVENTORY
ALTER TYPE "SubscriptionPlan" ADD VALUE 'INVENTORY';

-- 2) New Role value: INVENTORY_MANAGER (inventory-only, hidden from construction)
ALTER TYPE "Role" ADD VALUE 'INVENTORY_MANAGER';

-- 3) Company.defaultProjectId - hidden default store project (code 'STORE')
--    Unique FK so each project can be the default of at most one company.
ALTER TABLE "companies"
  ADD COLUMN "default_project_id" UUID UNIQUE REFERENCES "projects"("id") ON DELETE SET NULL;
