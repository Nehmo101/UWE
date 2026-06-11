-- AlterTable: dungeon cockpit hierarchy and prep status
ALTER TABLE "pages" ADD COLUMN "parent_page_id" TEXT;
ALTER TABLE "pages" ADD COLUMN "prep_status" TEXT;

CREATE INDEX "pages_parent_page_id_idx" ON "pages"("parent_page_id");
