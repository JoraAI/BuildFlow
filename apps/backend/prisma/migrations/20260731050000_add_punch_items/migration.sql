-- Phase 5 (§8.4): Punch List / Snag List table.
CREATE TABLE "punch_items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_to" UUID,
    "due_date" DATE,
    "closed_at" TIMESTAMP(3),
    "closed_by" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "punch_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "punch_items_company_id_idx" ON "punch_items"("company_id");
CREATE INDEX "punch_items_project_id_idx" ON "punch_items"("project_id");
CREATE INDEX "punch_items_status_idx" ON "punch_items"("status");
CREATE INDEX "punch_items_company_id_status_idx" ON "punch_items"("company_id", "status");
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
