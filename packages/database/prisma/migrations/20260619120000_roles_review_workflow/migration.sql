-- Add co_dm world membership role
-- SQLite does not support ALTER TYPE; recreate enum via table copy is not needed for TEXT columns in SQLite.
-- Prisma stores enums as TEXT; new value co_dm is accepted without migration DDL.

-- Content review workflow
CREATE TABLE "content_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "diff" JSONB,
    "payload" JSONB,
    "proposed_by_user_id" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" DATETIME,
    "reject_reason" TEXT,
    "target_href" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "content_reviews_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_reviews_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "content_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "content_reviews_source_type_source_id_key" ON "content_reviews"("source_type", "source_id");
CREATE INDEX "content_reviews_world_id_status_idx" ON "content_reviews"("world_id", "status");
CREATE INDEX "content_reviews_status_created_at_idx" ON "content_reviews"("status", "created_at");

CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "content_reviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "review_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "review_comments_review_id_created_at_idx" ON "review_comments"("review_id", "created_at");
