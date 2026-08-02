CREATE TABLE "drawings" (
    "id" UUID NOT NULL, "company_id" UUID NOT NULL, "project_id" UUID NOT NULL,
    "drawing_no" TEXT NOT NULL, "title" TEXT NOT NULL, "discipline" TEXT NOT NULL DEFAULT 'CIVIL',
    "category" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT', "current_version_id" UUID,
    "created_by" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "drawings_company_id_drawing_no_key" ON "drawings"("company_id", "drawing_no");
CREATE INDEX "drawings_company_id_idx" ON "drawings"("company_id");
CREATE INDEX "drawings_project_id_idx" ON "drawings"("project_id");
CREATE INDEX "drawings_status_idx" ON "drawings"("status");
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "drawing_versions" (
    "id" UUID NOT NULL, "drawing_id" UUID NOT NULL, "version_label" TEXT NOT NULL,
    "file_url" TEXT NOT NULL, "thumbnail_url" TEXT, "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT,
    CONSTRAINT "drawing_versions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "drawing_versions_drawing_id_version_label_key" ON "drawing_versions"("drawing_id", "version_label");
CREATE INDEX "drawing_versions_drawing_id_idx" ON "drawing_versions"("drawing_id");
ALTER TABLE "drawing_versions" ADD CONSTRAINT "drawing_versions_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drawing_versions" ADD CONSTRAINT "drawing_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "drawing_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
