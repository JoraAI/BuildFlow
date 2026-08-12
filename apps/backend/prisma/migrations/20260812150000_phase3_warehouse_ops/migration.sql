-- INVENTORY_HORIZONTAL_PLATFORM (Phase 3): warehouse ops.
-- Multi-warehouse (StockLocation extensions), stock transfers, stock counts.
-- Company + STORE project scoped (project_id is a plain scalar like Phase 2).

-- 1) Multi-warehouse fields on StockLocation.
ALTER TABLE "stock_locations"
    ADD COLUMN "code" TEXT,
    ADD COLUMN "address" TEXT,
    ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "stock_locations_company_id_is_default_idx" ON "stock_locations"("company_id", "is_default");

-- Keep the existing default STORE location as isDefault=true for inventory tenants
-- (construction companies keep is_default=false - their flows are unchanged).
UPDATE "stock_locations" sl
SET "is_default" = true
FROM "companies" c
WHERE c.id = sl."company_id"
  AND c."subscription_plan" = 'INVENTORY'
  AND c."default_project_id" = sl."project_id";

-- 2) Enums
CREATE TYPE "TransferOrderStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');

-- 3) Tables
CREATE TABLE "transfer_orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID NOT NULL,
    "status" "TransferOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatched_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "transfer_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transfer_order_lines" (
    "id" UUID NOT NULL,
    "transfer_order_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "received_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    CONSTRAINT "transfer_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "count_number" TEXT NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "count_date" DATE NOT NULL,
    "notes" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_count_lines" (
    "id" UUID NOT NULL,
    "stock_count_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "system_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "counted_qty" DECIMAL(12,3) NOT NULL,
    "variance" DECIMAL(12,3) NOT NULL DEFAULT 0,
    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- 4) Indexes
CREATE UNIQUE INDEX "transfer_orders_company_id_transfer_number_key" ON "transfer_orders"("company_id", "transfer_number");
CREATE INDEX "transfer_orders_company_id_idx" ON "transfer_orders"("company_id");
CREATE INDEX "transfer_order_lines_transfer_order_id_idx" ON "transfer_order_lines"("transfer_order_id");
CREATE UNIQUE INDEX "stock_counts_company_id_count_number_key" ON "stock_counts"("company_id", "count_number");
CREATE INDEX "stock_counts_company_id_idx" ON "stock_counts"("company_id");
CREATE INDEX "stock_count_lines_stock_count_id_idx" ON "stock_count_lines"("stock_count_id");

-- 5) Foreign keys
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transfer_order_lines" ADD CONSTRAINT "transfer_order_lines_transfer_order_id_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
