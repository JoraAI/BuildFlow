-- Phase 5 (§8.2): RFIs & Submittals
CREATE TABLE "rfis" (
    "id" UUID NOT NULL, "company_id" UUID NOT NULL, "project_id" UUID NOT NULL, "task_id" UUID, "boq_item_id" UUID,
    "rfi_number" TEXT NOT NULL, "subject" TEXT NOT NULL, "question" TEXT NOT NULL, "answer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN', "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[], "raised_by" UUID NOT NULL, "answered_by" UUID,
    "answered_at" TIMESTAMP(3), "due_date" DATE, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rfis_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "rfis_company_id_rfi_number_key" ON "rfis"("company_id", "rfi_number");
CREATE INDEX "rfis_company_id_idx" ON "rfis"("company_id");
CREATE INDEX "rfis_project_id_idx" ON "rfis"("project_id");
CREATE INDEX "rfis_status_idx" ON "rfis"("status");
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_answered_by_fkey" FOREIGN KEY ("answered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "submittals" (
    "id" UUID NOT NULL, "company_id" UUID NOT NULL, "project_id" UUID NOT NULL, "task_id" UUID,
    "submittal_no" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MATERIAL', "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[], "submitted_by" UUID NOT NULL, "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3), "review_notes" TEXT, "due_date" DATE, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "submittals_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "submittals_company_id_submittal_no_key" ON "submittals"("company_id", "submittal_no");
CREATE INDEX "submittals_company_id_idx" ON "submittals"("company_id");
CREATE INDEX "submittals_project_id_idx" ON "submittals"("project_id");
CREATE INDEX "submittals_status_idx" ON "submittals"("status");
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
