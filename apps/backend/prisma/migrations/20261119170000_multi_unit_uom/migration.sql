-- Multi-unit UOM: company toggle, shop unit catalog, per-item units.
ALTER TABLE "companies"
  ADD COLUMN "multi_unit_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "company_units" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_units_company_id_name_key" ON "company_units"("company_id", "name");
CREATE INDEX "company_units_company_id_idx" ON "company_units"("company_id");

ALTER TABLE "company_units"
  ADD CONSTRAINT "company_units_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "resource_units" (
  "id" UUID NOT NULL,
  "resource_id" UUID NOT NULL,
  "company_unit_id" UUID NOT NULL,
  "unit_name" TEXT NOT NULL,
  "is_base" BOOLEAN NOT NULL DEFAULT false,
  "conversion_to_base" DECIMAL(14,6) NOT NULL DEFAULT 1,
  "rate" DECIMAL(12,2),
  "distributor_rate" DECIMAL(12,2),
  "customer_rate" DECIMAL(12,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resource_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resource_units_resource_id_company_unit_id_key" ON "resource_units"("resource_id", "company_unit_id");
CREATE INDEX "resource_units_resource_id_idx" ON "resource_units"("resource_id");

ALTER TABLE "resource_units"
  ADD CONSTRAINT "resource_units_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_units"
  ADD CONSTRAINT "resource_units_company_unit_id_fkey"
  FOREIGN KEY ("company_unit_id") REFERENCES "company_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: ensure company units exist for each inventory resource's base + secondary unit,
-- then create ResourceUnit rows from secondaryUnit / conversionFactor.
INSERT INTO "company_units" ("id", "company_id", "name", "symbol", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), r."company_id", lower(trim(r."unit")), NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "resources" r
WHERE r."is_deleted" = false
  AND trim(r."unit") <> ''
ON CONFLICT ("company_id", "name") DO NOTHING;

INSERT INTO "company_units" ("id", "company_id", "name", "symbol", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), r."company_id", lower(trim(r."secondary_unit")), NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "resources" r
WHERE r."is_deleted" = false
  AND r."secondary_unit" IS NOT NULL
  AND trim(r."secondary_unit") <> ''
ON CONFLICT ("company_id", "name") DO NOTHING;

INSERT INTO "resource_units" (
  "id", "resource_id", "company_unit_id", "unit_name", "is_base",
  "conversion_to_base", "rate", "distributor_rate", "customer_rate",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  r."id",
  cu."id",
  cu."name",
  true,
  1,
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "resources" r
JOIN "company_units" cu
  ON cu."company_id" = r."company_id"
 AND cu."name" = lower(trim(r."unit"))
WHERE r."is_deleted" = false
  AND trim(r."unit") <> ''
ON CONFLICT ("resource_id", "company_unit_id") DO NOTHING;

INSERT INTO "resource_units" (
  "id", "resource_id", "company_unit_id", "unit_name", "is_base",
  "conversion_to_base", "rate", "distributor_rate", "customer_rate",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  r."id",
  cu."id",
  cu."name",
  false,
  COALESCE(NULLIF(r."conversion_factor", 0), 1),
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "resources" r
JOIN "company_units" cu
  ON cu."company_id" = r."company_id"
 AND cu."name" = lower(trim(r."secondary_unit"))
WHERE r."is_deleted" = false
  AND r."secondary_unit" IS NOT NULL
  AND trim(r."secondary_unit") <> ''
  AND lower(trim(r."secondary_unit")) <> lower(trim(r."unit"))
ON CONFLICT ("resource_id", "company_unit_id") DO NOTHING;
