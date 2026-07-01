-- Subcontractor default TDS
ALTER TABLE "subcontractors" ADD COLUMN "default_tds_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Work order BOQ/task links
ALTER TABLE "subcontract_work_orders" ADD COLUMN "boq_item_id" UUID;
ALTER TABLE "subcontract_work_orders" ADD COLUMN "task_id" UUID;
CREATE INDEX "subcontract_work_orders_boq_item_id_idx" ON "subcontract_work_orders"("boq_item_id");
CREATE INDEX "subcontract_work_orders_task_id_idx" ON "subcontract_work_orders"("task_id");
ALTER TABLE "subcontract_work_orders" ADD CONSTRAINT "subcontract_work_orders_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subcontract_work_orders" ADD CONSTRAINT "subcontract_work_orders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Work order contract lines
CREATE TABLE "subcontract_work_order_lines" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "boq_item_id" UUID,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "contract_qty" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT "subcontract_work_order_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subcontract_work_order_lines_work_order_id_idx" ON "subcontract_work_order_lines"("work_order_id");
ALTER TABLE "subcontract_work_order_lines" ADD CONSTRAINT "subcontract_work_order_lines_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "subcontract_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subcontract_work_order_lines" ADD CONSTRAINT "subcontract_work_order_lines_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Measurement line extensions
ALTER TABLE "subcontract_measurements" ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "subcontract_measurement_lines" ADD COLUMN "work_order_line_id" UUID;
ALTER TABLE "subcontract_measurement_lines" ADD COLUMN "boq_item_id" UUID;
ALTER TABLE "subcontract_measurement_lines" ADD COLUMN "boq_measurement_posted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subcontract_measurement_lines" ADD CONSTRAINT "subcontract_measurement_lines_work_order_line_id_fkey" FOREIGN KEY ("work_order_line_id") REFERENCES "subcontract_work_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subcontract_measurement_lines" ADD CONSTRAINT "subcontract_measurement_lines_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bill retention/advance/payment
ALTER TABLE "bills" ADD COLUMN "retention_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "bills" ADD COLUMN "advance_recovery_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "bills" ADD COLUMN "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "bills" ADD COLUMN "paid_at" TIMESTAMP(3);

-- Subcontractor portal access
CREATE TABLE "subcontractor_portal_access" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "subcontractor_id" UUID NOT NULL,
    "work_order_id" UUID,
    "token_hash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scopes" TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subcontractor_portal_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subcontractor_portal_access_token_hash_key" ON "subcontractor_portal_access"("token_hash");
CREATE INDEX "subcontractor_portal_access_project_id_idx" ON "subcontractor_portal_access"("project_id");
ALTER TABLE "subcontractor_portal_access" ADD CONSTRAINT "subcontractor_portal_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subcontractor_portal_access" ADD CONSTRAINT "subcontractor_portal_access_subcontractor_id_fkey" FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subcontractor_portal_access" ADD CONSTRAINT "subcontractor_portal_access_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "subcontract_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subcontractor_portal_access" ADD CONSTRAINT "subcontractor_portal_access_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
