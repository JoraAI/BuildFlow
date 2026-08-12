-- INVENTORY_HORIZONTAL_PLATFORM (Phase 9): dealer GTM polish.
-- Customer price lists (9.1) + Quote → Sales Order (9.2). All new tables are
-- additive; construction flows are untouched.

-- 9.1 Customer price overrides (customerId NULL = company-default price).
CREATE TABLE "customer_prices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID,
    "resource_id" UUID NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_prices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_prices_company_id_idx" ON "customer_prices"("company_id");
CREATE INDEX "customer_prices_resource_id_idx" ON "customer_prices"("resource_id");
CREATE INDEX "customer_prices_customer_id_idx" ON "customer_prices"("customer_id");

-- 9.2 Quotes (DRAFT → SENT → ACCEPTED/REJECTED) → Sales Order.
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "quote_number" TEXT NOT NULL,
    "customer_id" UUID,
    "customer_name" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "quote_date" DATE NOT NULL,
    "valid_until" DATE,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sales_order_id" UUID,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quotes_company_id_quote_number_key" UNIQUE ("company_id", "quote_number"),
    CONSTRAINT "quotes_sales_order_id_key" UNIQUE ("sales_order_id")
);
CREATE INDEX "quotes_project_id_idx" ON "quotes"("project_id");

CREATE TABLE "quote_lines" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quote_lines_quote_id_idx" ON "quote_lines"("quote_id");

-- Foreign keys (match Prisma schema relations).
ALTER TABLE "customer_prices"
    ADD CONSTRAINT "customer_prices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "customer_prices_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "quotes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "quotes_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quote_lines"
    ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

