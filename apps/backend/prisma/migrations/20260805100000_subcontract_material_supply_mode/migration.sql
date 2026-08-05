-- SUB-C1: Add MaterialSupplyMode enum + material_supply_mode column to subcontract_work_orders
CREATE TYPE "MaterialSupplyMode" AS ENUM ('NONE', 'GC_SUPPLIED', 'MIXED');
ALTER TABLE "subcontract_work_orders" ADD COLUMN "material_supply_mode" "MaterialSupplyMode" NOT NULL DEFAULT 'NONE';
