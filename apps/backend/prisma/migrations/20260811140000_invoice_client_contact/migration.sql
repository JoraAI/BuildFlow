-- INVENTORY_UX_POLISH (D6): optional buyer contact details on invoices
ALTER TABLE "invoices"
  ADD COLUMN "client_address" VARCHAR(500),
  ADD COLUMN "client_phone" VARCHAR(20);
