-- Persist defect pins dropped on blueprint sheets.
ALTER TABLE "drawings" ADD COLUMN IF NOT EXISTS "pins" JSONB NOT NULL DEFAULT '[]';
