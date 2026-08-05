-- VAR-D2: Add boq_applied_at to change_orders for explicit convert-to-BOQ workflow
ALTER TABLE "change_orders" ADD COLUMN "boq_applied_at" TIMESTAMP;