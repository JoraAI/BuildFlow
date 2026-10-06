-- B2B buyer join codes (Icecream-inventory-buyer)

CREATE TABLE IF NOT EXISTS "buyer_invites" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "code_hash" TEXT NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "buyer_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "buyer_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "buyer_invites_code_hash_key" ON "buyer_invites"("code_hash");
CREATE INDEX IF NOT EXISTS "buyer_invites_company_id_idx" ON "buyer_invites"("company_id");
CREATE INDEX IF NOT EXISTS "buyer_invites_customer_id_idx" ON "buyer_invites"("customer_id");
CREATE INDEX IF NOT EXISTS "buyer_invites_company_id_expires_at_idx" ON "buyer_invites"("company_id", "expires_at");

DO $$ BEGIN
  ALTER TABLE "buyer_invites" ADD CONSTRAINT "buyer_invites_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buyer_invites" ADD CONSTRAINT "buyer_invites_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buyer_invites" ADD CONSTRAINT "buyer_invites_buyer_user_id_fkey"
    FOREIGN KEY ("buyer_user_id") REFERENCES "buyer_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
