-- Password hardening: invite/reset token hashes and forced password change flag.
ALTER TABLE "users" ADD COLUMN "force_password_change" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "reset_token_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "reset_token_expires_at" DATETIME;
ALTER TABLE "users" ADD COLUMN "invite_token_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "invite_token_expires_at" DATETIME;
