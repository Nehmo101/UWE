-- Track last user activity for configurable session inactivity timeout.
ALTER TABLE "sessions" ADD COLUMN "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
