-- Secret levels and reveal state removed.
--
-- `secret_level` / `reveal_state` let a page, block, asset or world event stay
-- hidden from players until the DM revealed it. With world membership as the
-- only access rule — a member sees everything in their world — a per-item
-- reveal has nothing left to gate.
ALTER TABLE "pages" DROP COLUMN "secret_level";
ALTER TABLE "pages" DROP COLUMN "reveal_state";
ALTER TABLE "content_blocks" DROP COLUMN "secret_level";
ALTER TABLE "content_blocks" DROP COLUMN "reveal_state";
ALTER TABLE "assets" DROP COLUMN "secret_level";
ALTER TABLE "assets" DROP COLUMN "reveal_state";
ALTER TABLE "world_events" DROP COLUMN "secret_level";
