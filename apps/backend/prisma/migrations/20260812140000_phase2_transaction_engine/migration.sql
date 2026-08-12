-- INVENTORY_HORIZONTAL_PLATFORM (Phase 2): transaction engine.
-- Sales Order → Delivery Challan → Invoice; sales/purchase returns; credit/debit notes;
-- customer credit-limit policy. Company + STORE project scoped.

-- 1) Enums
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'CANCELLED');
CREATE TYPE "DeliveryChallanStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "ReturnKind" AS ENUM ('GOOD', 'DAMAGED');
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');
CREATE TYPE "CreditLimitPolicy" AS ENUM ('ALLOW', 'WARN', 'BLOCK');

-- 2) Company credit-limit policy (default WARN).
ALTER TABLE "companies" ADD COLUMN "credit_limit_policy" "CreditLimitPolicy" NOT NULL DEFAULT 'WARN';

-- 3) Invoice link to a sales order (optional; free-text/SO-less invoices kept).
ALTER TABLE "invoices" ADD COLUMN "sales_order_id" UUID;

-- 4) Tables
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "so_number" TEXT NOT NULL,
    "customer_id" UUID,
    "customer_name" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "order_date" DATE NOT NULL,
    "expected_delivery" DATE,
    "notes" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_order_lines" (
    "id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "delivered_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_challans" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "dc_number" TEXT NOT NULL,
    "sales_order_id" UUID,
    "customer_id" UUID,
    "customer_name" TEXT NOT NULL,
    "status" "DeliveryChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatched_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_challan_lines" (
    "id" UUID NOT NULL,
    "delivery_challan_id" UUID NOT NULL,
    "sales_order_line_id" UUID,
    "resource_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT "delivery_challan_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_returns" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "return_number" TEXT NOT NULL,
    "invoice_id" UUID,
    "customer_id" UUID,
    "customer_name" TEXT NOT NULL,
    "return_date" DATE NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_return_lines" (
    "id" UUID NOT NULL,
    "sales_return_id" UUID NOT NULL,
    "invoice_line_item_id" UUID,
    "resource_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "return_kind" "ReturnKind" NOT NULL DEFAULT 'GOOD',
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "return_number" TEXT NOT NULL,
    "bill_id" UUID,
    "grn_id" UUID,
    "vendor_id" UUID,
    "vendor_name" TEXT NOT NULL,
    "return_date" DATE NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_return_lines" (
    "id" UUID NOT NULL,
    "purchase_return_id" UUID NOT NULL,
    "goods_receipt_line_id" UUID,
    "resource_id" UUID NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "credit_note_number" TEXT NOT NULL,
    "invoice_id" UUID,
    "sales_return_id" UUID,
    "customer_id" UUID,
    "customer_name" TEXT NOT NULL,
    "credit_date" DATE NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_note_lines" (
    "id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "resource_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "debit_notes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "debit_note_number" TEXT NOT NULL,
    "bill_id" UUID,
    "purchase_return_id" UUID,
    "vendor_id" UUID,
    "vendor_name" TEXT NOT NULL,
    "debit_date" DATE NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "debit_note_lines" (
    "id" UUID NOT NULL,
    "debit_note_id" UUID NOT NULL,
    "resource_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT "debit_note_lines_pkey" PRIMARY KEY ("id")
);

-- 5) Uniqueness + indexes
CREATE UNIQUE INDEX "sales_orders_company_id_so_number_key" ON "sales_orders"("company_id", "so_number");
CREATE INDEX "sales_orders_company_id_idx" ON "sales_orders"("company_id");
CREATE INDEX "sales_order_lines_sales_order_id_idx" ON "sales_order_lines"("sales_order_id");
CREATE UNIQUE INDEX "delivery_challans_company_id_dc_number_key" ON "delivery_challans"("company_id", "dc_number");
CREATE INDEX "delivery_challans_company_id_idx" ON "delivery_challans"("company_id");
CREATE INDEX "delivery_challan_lines_delivery_challan_id_idx" ON "delivery_challan_lines"("delivery_challan_id");
CREATE UNIQUE INDEX "sales_returns_company_id_return_number_key" ON "sales_returns"("company_id", "return_number");
CREATE INDEX "sales_returns_company_id_idx" ON "sales_returns"("company_id");
CREATE INDEX "sales_return_lines_sales_return_id_idx" ON "sales_return_lines"("sales_return_id");
CREATE UNIQUE INDEX "purchase_returns_company_id_return_number_key" ON "purchase_returns"("company_id", "return_number");
CREATE INDEX "purchase_returns_company_id_idx" ON "purchase_returns"("company_id");
CREATE INDEX "purchase_return_lines_purchase_return_id_idx" ON "purchase_return_lines"("purchase_return_id");
CREATE UNIQUE INDEX "credit_notes_company_id_credit_note_number_key" ON "credit_notes"("company_id", "credit_note_number");
CREATE INDEX "credit_notes_company_id_idx" ON "credit_notes"("company_id");
CREATE INDEX "credit_note_lines_credit_note_id_idx" ON "credit_note_lines"("credit_note_id");
CREATE UNIQUE INDEX "debit_notes_company_id_debit_note_number_key" ON "debit_notes"("company_id", "debit_note_number");
CREATE INDEX "debit_notes_company_id_idx" ON "debit_notes"("company_id");
CREATE INDEX "debit_note_lines_debit_note_id_idx" ON "debit_note_lines"("debit_note_id");
CREATE INDEX "invoices_sales_order_id_idx" ON "invoices"("sales_order_id");
CREATE UNIQUE INDEX "credit_notes_sales_return_id_key" ON "credit_notes"("sales_return_id");
CREATE UNIQUE INDEX "debit_notes_purchase_return_id_key" ON "debit_notes"("purchase_return_id");


-- 6) Foreign keys
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_challan_lines" ADD CONSTRAINT "delivery_challan_lines_delivery_challan_id_fkey" FOREIGN KEY ("delivery_challan_id") REFERENCES "delivery_challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
