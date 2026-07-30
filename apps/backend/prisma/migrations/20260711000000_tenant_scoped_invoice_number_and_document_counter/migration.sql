-- AlterTable: change invoice_number from globally unique to tenant-scoped unique.
-- FIX: FIN-H1 / DAT-1.2 — Invoice numbers were globally unique, causing cross-tenant
-- P2002 collisions and forcing the generator into a count-based race.
DROP INDEX IF EXISTS "invoices_invoice_number_key";

CREATE UNIQUE INDEX "invoices_company_id_invoice_number_key"
  ON "invoices"("company_id", "invoice_number");

-- CreateTable: DocumentCounter (race-safe per-company, per-year sequential numbers)
-- FIX: SEC-M14 / FIN-H1 / EST-M5 — replaces count()-based document numbering.
CREATE TABLE "document_counters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_counters_company_id_type_year_key"
  ON "document_counters"("company_id", "type", "year");

-- CreateIndex
CREATE INDEX "document_counters_company_id_idx" ON "document_counters"("company_id");

-- AddForeignKey
ALTER TABLE "document_counters"
  ADD CONSTRAINT "document_counters_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;