-- FIX (NR-1): AuditLog.oldValue was annotated @map("old_value") in schema.prisma
-- but the init migration (20260625202555) created the column as "oldValue".
-- No intervening migration ever renamed it, so the regenerated Prisma client
-- queried a nonexistent column and every recordAudit() threw at runtime
-- (masked only because utils/audit.ts logs-and-continues).
-- This renames the existing column to match the @map so audit logging works.
ALTER TABLE "audit_logs" RENAME COLUMN "oldValue" TO "old_value";