-- FIX (FIN-H3/NR-5): Persist clientState on invoices so editing an invoice
-- doesn't silently flip CGST/SGST → IGST. Previously clientState was a
-- request-only field with no storage, so on update it resolved to undefined
-- and every invoice was treated as inter-state.
ALTER TABLE "invoices" ADD COLUMN "client_state" TEXT;

-- FIX (FIN-H4/NR-12): Enforce project-scoped uniqueness of the RA sequence so
-- two concurrent RUNNING_ACCOUNT invoice creations can't produce duplicate
-- raSequence values. NULL raSequence (non-RA invoices) is excluded by Postgres'
-- default NULL-distinct behaviour, so the constraint only guards RA invoices.
-- Partial index because raSequence is nullable and we only want to enforce
-- uniqueness among the non-NULL (RA) rows.
CREATE UNIQUE INDEX "invoices_projectid_rasequence_unique"
  ON "invoices" ("project_id", "ra_sequence")
  WHERE "ra_sequence" IS NOT NULL;