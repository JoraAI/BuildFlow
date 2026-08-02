-- FIX (NR-13): Make material_requisition_lines.resource_id nullable so
-- BOQ-only lines (no catalog resource) can be saved.
ALTER TABLE "material_requisition_lines" ALTER COLUMN "resource_id" DROP NOT NULL;
