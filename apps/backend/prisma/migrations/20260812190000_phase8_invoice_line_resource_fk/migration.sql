-- Phase 8.4 follow-up: schema declares InvoiceLineItem.resourceId → Resource (SetNull),
-- but 20260812180000 only added the column + index. Add the FK to match Prisma.
ALTER TABLE "invoice_line_items"
  ADD CONSTRAINT "invoice_line_items_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
