-- INVENTORY_HORIZONTAL_PLATFORM (Phase 1): party master + item master + stock adjustments.

-- 1) Party master tables (company-scoped).
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "business_name" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "billing_address" TEXT,
    "shipping_address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "payment_terms" TEXT,
    "credit_limit" DECIMAL(14,2) DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "business_name" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "billing_address" TEXT,
    "shipping_address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "payment_terms" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- 2) Optional party links on invoices/bills (legacy free-text fallback kept).
ALTER TABLE "invoices" ADD COLUMN "customer_id" UUID;
ALTER TABLE "bills" ADD COLUMN "vendor_id" UUID;

-- 3) Item master 1.5 fields on Resource (all optional — construction unaffected).
ALTER TABLE "resources"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "item_code" TEXT,
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "secondary_unit" TEXT,
  ADD COLUMN "conversion_factor" DECIMAL(12,4) DEFAULT 1,
  ADD COLUMN "reorder_point" DECIMAL(12,3) DEFAULT 0;

-- 4) Stock adjustment audit columns.
ALTER TABLE "stock_movements"
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "notes" TEXT;

-- Indexes + FKs
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");
CREATE INDEX "vendors_company_id_idx" ON "vendors"("company_id");
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");
CREATE INDEX "bills_vendor_id_idx" ON "bills"("vendor_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
