-- Cross-module integration: variation links, procurement source, DPR measurement flag

ALTER TABLE "change_orders" ADD COLUMN IF NOT EXISTS "linked_task_id" UUID;
ALTER TABLE "change_orders" ADD COLUMN IF NOT EXISTS "linked_work_order_id" UUID;

ALTER TABLE "change_order_lines" ADD COLUMN IF NOT EXISTS "resource_id" UUID;

ALTER TABLE "material_requisitions" ADD COLUMN IF NOT EXISTS "source_type" TEXT;
ALTER TABLE "material_requisitions" ADD COLUMN IF NOT EXISTS "source_ref" TEXT;

ALTER TABLE "material_usages" ADD COLUMN IF NOT EXISTS "boq_measurement_posted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "change_orders"
  ADD CONSTRAINT "change_orders_linked_task_id_fkey"
  FOREIGN KEY ("linked_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "change_orders"
  ADD CONSTRAINT "change_orders_linked_work_order_id_fkey"
  FOREIGN KEY ("linked_work_order_id") REFERENCES "subcontract_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "change_order_lines"
  ADD CONSTRAINT "change_order_lines_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
