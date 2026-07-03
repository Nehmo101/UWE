-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "secret_level" TEXT NOT NULL DEFAULT 'none',
    "reveal_state" TEXT NOT NULL DEFAULT 'hidden',
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assets_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assets" ("campaign_id", "created_at", "description", "id", "metadata", "mime_type", "reveal_state", "secret_level", "size", "storage_key", "tags", "title", "type", "updated_at", "visibility", "world_id") SELECT "campaign_id", "created_at", "description", "id", "metadata", "mime_type", "reveal_state", "secret_level", "size", "storage_key", "tags", "title", "type", "updated_at", "visibility", "world_id" FROM "assets";
DROP TABLE "assets";
ALTER TABLE "new_assets" RENAME TO "assets";
CREATE INDEX "assets_world_id_type_idx" ON "assets"("world_id", "type");
CREATE TABLE "new_content_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "page_id" TEXT NOT NULL,
    "asset_id" TEXT,
    "type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "secret_level" TEXT NOT NULL DEFAULT 'none',
    "reveal_state" TEXT NOT NULL DEFAULT 'hidden',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "content_blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_blocks_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_content_blocks" ("asset_id", "content", "created_at", "id", "metadata", "page_id", "reveal_state", "secret_level", "sort_order", "type", "updated_at", "visibility") SELECT "asset_id", "content", "created_at", "id", "metadata", "page_id", "reveal_state", "secret_level", "sort_order", "type", "updated_at", "visibility" FROM "content_blocks";
DROP TABLE "content_blocks";
ALTER TABLE "new_content_blocks" RENAME TO "content_blocks";
CREATE INDEX "content_blocks_page_id_sort_order_idx" ON "content_blocks"("page_id", "sort_order");
CREATE INDEX "content_blocks_asset_id_idx" ON "content_blocks"("asset_id");
CREATE TABLE "new_mail_inbox_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "imap_uid" TEXT NOT NULL,
    "message_id" TEXT,
    "in_reply_to" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "from_address" TEXT NOT NULL,
    "to_addresses" JSONB,
    "cc_addresses" JSONB,
    "snippet" TEXT,
    "body_text" TEXT,
    "body_html" TEXT,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "received_at" DATETIME NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_inbox_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mail_inbox_messages_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "mail_folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_mail_inbox_messages" ("account_id", "body_html", "body_text", "cc_addresses", "folder_id", "from_address", "has_attachments", "id", "imap_uid", "in_reply_to", "is_read", "message_id", "received_at", "snippet", "subject", "synced_at", "to_addresses") SELECT "account_id", "body_html", "body_text", "cc_addresses", "folder_id", "from_address", "has_attachments", "id", "imap_uid", "in_reply_to", "is_read", "message_id", "received_at", "snippet", "subject", "synced_at", "to_addresses" FROM "mail_inbox_messages";
DROP TABLE "mail_inbox_messages";
ALTER TABLE "new_mail_inbox_messages" RENAME TO "mail_inbox_messages";
CREATE INDEX "mail_inbox_messages_account_id_received_at_idx" ON "mail_inbox_messages"("account_id", "received_at");
CREATE INDEX "mail_inbox_messages_account_id_subject_idx" ON "mail_inbox_messages"("account_id", "subject");
CREATE INDEX "mail_inbox_messages_account_id_from_address_idx" ON "mail_inbox_messages"("account_id", "from_address");
CREATE UNIQUE INDEX "mail_inbox_messages_account_id_imap_uid_key" ON "mail_inbox_messages"("account_id", "imap_uid");
CREATE TABLE "new_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "parent_page_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "publish_status" TEXT NOT NULL DEFAULT 'draft',
    "secret_level" TEXT NOT NULL DEFAULT 'none',
    "reveal_state" TEXT NOT NULL DEFAULT 'hidden',
    "canonical_status" TEXT NOT NULL DEFAULT 'draft',
    "prep_status" TEXT,
    "quest_status" TEXT,
    "tags" JSONB,
    "aliases" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pages_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pages_parent_page_id_fkey" FOREIGN KEY ("parent_page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pages" ("aliases", "campaign_id", "canonical_status", "created_at", "id", "parent_page_id", "prep_status", "publish_status", "quest_status", "reveal_state", "secret_level", "slug", "summary", "tags", "title", "type", "updated_at", "visibility", "world_id") SELECT "aliases", "campaign_id", "canonical_status", "created_at", "id", "parent_page_id", "prep_status", "publish_status", "quest_status", "reveal_state", "secret_level", "slug", "summary", "tags", "title", "type", "updated_at", "visibility", "world_id" FROM "pages";
DROP TABLE "pages";
ALTER TABLE "new_pages" RENAME TO "pages";
CREATE INDEX "pages_parent_page_id_idx" ON "pages"("parent_page_id");
CREATE UNIQUE INDEX "pages_world_id_slug_key" ON "pages"("world_id", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
-- Idempotent: on fresh DBs the pre-rename index name "sessions_token_idx" exists
-- (from 20260611215658_auth_and_memberships, kept across the token->token_hash
-- column rename in 20260618220000). On baselined hosts the sessions indexes were
-- already created under their final names, so guard both sides.
DROP INDEX IF EXISTS "sessions_token_idx";
CREATE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions"("token_hash");

-- RedefineIndex
DROP INDEX IF EXISTS "sessions_token_key";
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_key" ON "sessions"("token_hash");
