-- FIX (NR-44): The `Drawing.currentVersionId @unique` constraint in schema.prisma
-- is NOT enforced in the database — the drawings migration only created the FK.
-- This adds the unique index so two drawings can't point at the same current
-- version, matching the schema.
CREATE UNIQUE INDEX "drawings_current_version_id_key"
  ON "drawings" ("current_version_id")
  WHERE "current_version_id" IS NOT NULL;