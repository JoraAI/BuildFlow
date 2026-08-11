-- INVENTORY_UX_POLISH (D6): optional buyer contact details on invoices
-- Idempotent: columns may already exist if an earlier env applied a prior
-- migration revision under a different name (e.g. 20260811120000_invoice_client_contact).
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "client_address" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "client_phone" VARCHAR(20);
