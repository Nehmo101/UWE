-- Publish status removed.
--
-- `publish_status` (draft / internal / review / published / archived) held a
-- page back from players until the DM released it. The review workflow that
-- used the "review" value is already gone, and world membership is now the only
-- access rule: a member sees everything in their world. A per-page release step
-- has nothing left to hold back.
ALTER TABLE "pages" DROP COLUMN "publish_status";
