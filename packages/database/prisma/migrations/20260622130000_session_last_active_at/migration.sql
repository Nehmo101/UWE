-- Track last user activity for configurable session inactivity timeout.
ALTER TABLE "sessions" ADD COLUMN "last_active_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
