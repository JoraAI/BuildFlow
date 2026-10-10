-- ICE_CREAM: buyer roles, invoice sheet discount, inventory cash book

CREATE TYPE "BuyerPartyRole" AS ENUM ('DISTRIBUTOR', 'CUSTOMER');
CREATE TYPE "CashBookDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "CashBookEntryType" AS ENUM ('OPENING', 'SALE_COLLECTION', 'EXPENSE', 'DEPOSIT', 'ADJUSTMENT');
CREATE TYPE "CashBookPaymentMode" AS ENUM ('CASH', 'UPI', 'BANK', 'OTHER');

ALTER TABLE "customers"
  ADD COLUMN "buyer_role" "BuyerPartyRole" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "trade_discount_pct" DECIMAL(5,2);

ALTER TABLE "invoices"
  ADD COLUMN "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "inventory_cash_book_entries" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "entry_date" DATE NOT NULL,
  "direction" "CashBookDirection" NOT NULL,
  "entry_type" "CashBookEntryType" NOT NULL,
  "payment_mode" "CashBookPaymentMode" NOT NULL DEFAULT 'CASH',
  "amount" DECIMAL(14,2) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "invoice_id" UUID,
  "customer_id" UUID,
  "recorded_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_cash_book_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_cash_book_entries_company_id_entry_date_idx" ON "inventory_cash_book_entries"("company_id", "entry_date");
CREATE INDEX "inventory_cash_book_entries_company_id_idx" ON "inventory_cash_book_entries"("company_id");
CREATE INDEX "inventory_cash_book_entries_invoice_id_idx" ON "inventory_cash_book_entries"("invoice_id");

ALTER TABLE "inventory_cash_book_entries" ADD CONSTRAINT "inventory_cash_book_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_cash_book_entries" ADD CONSTRAINT "inventory_cash_book_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_cash_book_entries" ADD CONSTRAINT "inventory_cash_book_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_cash_book_entries" ADD CONSTRAINT "inventory_cash_book_entries_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
