-- Phase 5 (§8.9): Petty Cash / Site Expenses table.
-- Tracks small cash expenditures at site with receipt tracking and
-- categorized reconciliation. Each entry is company+project scoped.
--
-- FIX (NR-21): This SQL was previously stranded in a stray extensionless file
-- `prisma/m` (an anti-pattern flagged in §2.2B). Moved here to a proper
-- migration folder so `prisma migrate deploy` creates the table.
CREATE TABLE "petty_cash_entries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID,
    "entry_number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(14,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "paid_to" TEXT NOT NULL,
    "receipt_url" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_entries_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: entry numbers are per-company
CREATE UNIQUE INDEX "petty_cash_entries_company_id_entry_number_key"
    ON "petty_cash_entries"("company_id", "entry_number");

-- Indexes for hot paths
CREATE INDEX "petty_cash_entries_company_id_idx" ON "petty_cash_entries"("company_id");
CREATE INDEX "petty_cash_entries_project_id_idx" ON "petty_cash_entries"("project_id");
CREATE INDEX "petty_cash_entries_company_id_status_idx" ON "petty_cash_entries"("company_id", "status");

-- Foreign keys
ALTER TABLE "petty_cash_entries"
    ADD CONSTRAINT "petty_cash_entries_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "petty_cash_entries"
    ADD CONSTRAINT "petty_cash_entries_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "petty_cash_entries"
    ADD CONSTRAINT "petty_cash_entries_recorded_by_fkey"
    FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;