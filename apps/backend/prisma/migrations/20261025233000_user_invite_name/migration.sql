-- Persist the invited person's name so Sign in + OTP can join them to the shop.
ALTER TABLE "user_invites" ADD COLUMN "name" TEXT;
