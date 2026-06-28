-- Regional rate books + project material rate overrides

ALTER TABLE "projects" ADD COLUMN "rate_region_id" UUID;

CREATE TABLE "rate_regions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_regions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "regional_material_rates" (
    "id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regional_material_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_material_rates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_material_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_regions_company_id_idx" ON "rate_regions"("company_id");
CREATE INDEX "regional_material_rates_region_id_idx" ON "regional_material_rates"("region_id");
CREATE INDEX "regional_material_rates_resource_id_idx" ON "regional_material_rates"("resource_id");
CREATE UNIQUE INDEX "regional_material_rates_region_id_resource_id_effective_date_key" ON "regional_material_rates"("region_id", "resource_id", "effective_date");
CREATE INDEX "project_material_rates_project_id_idx" ON "project_material_rates"("project_id");
CREATE UNIQUE INDEX "project_material_rates_project_id_resource_id_key" ON "project_material_rates"("project_id", "resource_id");
CREATE INDEX "projects_rate_region_id_idx" ON "projects"("rate_region_id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_rate_region_id_fkey" FOREIGN KEY ("rate_region_id") REFERENCES "rate_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rate_regions" ADD CONSTRAINT "rate_regions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regional_material_rates" ADD CONSTRAINT "regional_material_rates_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "rate_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regional_material_rates" ADD CONSTRAINT "regional_material_rates_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_material_rates" ADD CONSTRAINT "project_material_rates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_material_rates" ADD CONSTRAINT "project_material_rates_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
