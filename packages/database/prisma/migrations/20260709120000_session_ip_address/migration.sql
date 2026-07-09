-- Store client IP at session creation for account security overview.
ALTER TABLE "sessions" ADD COLUMN "ip_address" TEXT;
