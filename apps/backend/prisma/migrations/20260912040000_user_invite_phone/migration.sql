-- Allow email-or-phone team invites
ALTER TABLE "user_invites" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "user_invites" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Unique phone per company (multiple NULLs allowed in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS "user_invites_company_id_phone_key"
  ON "user_invites"("company_id", "phone");
