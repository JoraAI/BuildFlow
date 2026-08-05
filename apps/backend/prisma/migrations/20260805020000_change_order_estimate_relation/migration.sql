-- EST-VO-11a: Add FK constraint from change_orders.estimate_id to estimates.id
-- The estimate_id column already exists (added in an earlier migration);
-- this migration adds the foreign key relation so Prisma can join.

ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_estimate_id_fkey"
  FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE SET NULL;