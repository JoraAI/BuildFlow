-- Ice cream manufacturer vertical + B2B buyers

CREATE TYPE "ProductionBatchStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

CREATE TYPE "SalesOrderSource" AS ENUM ('MANUAL', 'B2B_APP');

ALTER TYPE "InventoryVertical" ADD VALUE IF NOT EXISTS 'ICE_CREAM';

ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "b2b_published" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "source" "SalesOrderSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "carrier" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "tracking_ref" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "shipped_at" TIMESTAMP(3);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "buyer_user_id" UUID;

CREATE TABLE IF NOT EXISTS "recipes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "output_resource_id" UUID NOT NULL,
    "output_qty" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recipe_lines" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "input_resource_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "production_batches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "output_qty" DECIMAL(12,3) NOT NULL,
    "batch_code" TEXT NOT NULL,
    "manufactured_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "status" "ProductionBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_by" UUID,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "buyer_users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "buyer_users_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recipes_company_id_idx" ON "recipes"("company_id");
CREATE INDEX IF NOT EXISTS "recipe_lines_recipe_id_idx" ON "recipe_lines"("recipe_id");
CREATE INDEX IF NOT EXISTS "production_batches_company_id_idx" ON "production_batches"("company_id");
CREATE INDEX IF NOT EXISTS "production_batches_company_id_status_idx" ON "production_batches"("company_id", "status");
CREATE INDEX IF NOT EXISTS "buyer_users_company_id_idx" ON "buyer_users"("company_id");
CREATE INDEX IF NOT EXISTS "buyer_users_customer_id_idx" ON "buyer_users"("customer_id");
CREATE INDEX IF NOT EXISTS "sales_orders_company_id_source_idx" ON "sales_orders"("company_id", "source");

CREATE UNIQUE INDEX IF NOT EXISTS "buyer_users_company_id_email_key" ON "buyer_users"("company_id", "email");

DO $$ BEGIN
  ALTER TABLE "recipes" ADD CONSTRAINT "recipes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recipes" ADD CONSTRAINT "recipes_output_resource_id_fkey" FOREIGN KEY ("output_resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_input_resource_id_fkey" FOREIGN KEY ("input_resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "buyer_users" ADD CONSTRAINT "buyer_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "buyer_users" ADD CONSTRAINT "buyer_users_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "buyer_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
