-- Visibility & Secret System: normalized access fields for pages, blocks, and assets.

-- Prisma SQLite stores enums as TEXT; new values (private, secret levels, reveal states)
-- are enforced at the application layer.

ALTER TABLE "pages" ADD COLUMN "secret_level" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "pages" ADD COLUMN "reveal_state" TEXT NOT NULL DEFAULT 'hidden';

ALTER TABLE "content_blocks" ADD COLUMN "secret_level" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "content_blocks" ADD COLUMN "reveal_state" TEXT NOT NULL DEFAULT 'hidden';

ALTER TABLE "assets" ADD COLUMN "secret_level" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "assets" ADD COLUMN "reveal_state" TEXT NOT NULL DEFAULT 'hidden';
