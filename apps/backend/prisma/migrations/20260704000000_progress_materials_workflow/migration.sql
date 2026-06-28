-- Progress, materials & costs workflow

ALTER TABLE "boq_items" ADD COLUMN IF NOT EXISTS "executed_qty" DECIMAL(12,3) NOT NULL DEFAULT 0;

ALTER TABLE "material_usages" ADD COLUMN IF NOT EXISTS "task_id" UUID;
ALTER TABLE "material_usages" ADD COLUMN IF NOT EXISTS "boq_item_id" UUID;

ALTER TABLE "material_usages"
  ADD CONSTRAINT "material_usages_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "material_usages"
  ADD CONSTRAINT "material_usages_boq_item_id_fkey"
  FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "boq_measurements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "boq_item_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recorded_by" UUID NOT NULL,
  "notes" TEXT,
  CONSTRAINT "boq_measurements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "boq_measurements"
  ADD CONSTRAINT "boq_measurements_boq_item_id_fkey"
  FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "boq_measurements"
  ADD CONSTRAINT "boq_measurements_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "boq_measurements"
  ADD CONSTRAINT "boq_measurements_recorded_by_fkey"
  FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "boq_measurements_boq_item_id_idx" ON "boq_measurements"("boq_item_id");
CREATE INDEX IF NOT EXISTS "boq_measurements_project_id_idx" ON "boq_measurements"("project_id");

CREATE TABLE IF NOT EXISTS "daily_report_task_updates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "daily_report_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "progress_pct" INTEGER NOT NULL,
  CONSTRAINT "daily_report_task_updates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "daily_report_task_updates"
  ADD CONSTRAINT "daily_report_task_updates_daily_report_id_fkey"
  FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_report_task_updates"
  ADD CONSTRAINT "daily_report_task_updates_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "daily_report_task_updates_daily_report_id_idx" ON "daily_report_task_updates"("daily_report_id");
