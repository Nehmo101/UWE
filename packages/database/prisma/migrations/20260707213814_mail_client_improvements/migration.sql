-- CreateTable
CREATE TABLE "mail_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "account_id" TEXT,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "last_applied_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mail_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mail_vip_senders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mail_folders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "imap_path" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "uid_validity" TEXT,
    "last_seen_uid" INTEGER NOT NULL DEFAULT 0,
    "folder_role" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_folders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_mail_folders" ("account_id", "display_name", "id", "imap_path", "message_count", "synced_at", "uid_validity") SELECT "account_id", "display_name", "id", "imap_path", "message_count", "synced_at", "uid_validity" FROM "mail_folders";
DROP TABLE "mail_folders";
ALTER TABLE "new_mail_folders" RENAME TO "mail_folders";
CREATE UNIQUE INDEX "mail_folders_account_id_imap_path_key" ON "mail_folders"("account_id", "imap_path");
CREATE TABLE "new_mail_inbox_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "imap_uid" TEXT NOT NULL,
    "message_id" TEXT,
    "in_reply_to" TEXT,
    "references" TEXT,
    "thread_id" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "from_address" TEXT NOT NULL,
    "to_addresses" JSONB,
    "cc_addresses" JSONB,
    "bcc_addresses" JSONB,
    "snippet" TEXT,
    "body_text" TEXT,
    "body_html" TEXT,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "received_at" DATETIME NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "list_unsubscribe_http_url" TEXT,
    "list_unsubscribe_mailto" TEXT,
    "list_unsubscribe_post_supported" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "mail_inbox_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mail_inbox_messages_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "mail_folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_mail_inbox_messages" ("account_id", "body_html", "body_text", "cc_addresses", "folder_id", "from_address", "has_attachments", "id", "imap_uid", "in_reply_to", "is_read", "list_unsubscribe_http_url", "list_unsubscribe_mailto", "list_unsubscribe_post_supported", "message_id", "received_at", "snippet", "subject", "synced_at", "to_addresses") SELECT "account_id", "body_html", "body_text", "cc_addresses", "folder_id", "from_address", "has_attachments", "id", "imap_uid", "in_reply_to", "is_read", "list_unsubscribe_http_url", "list_unsubscribe_mailto", "list_unsubscribe_post_supported", "message_id", "received_at", "snippet", "subject", "synced_at", "to_addresses" FROM "mail_inbox_messages";
DROP TABLE "mail_inbox_messages";
ALTER TABLE "new_mail_inbox_messages" RENAME TO "mail_inbox_messages";
-- Backfill NULL folder_id to the account's INBOX folder so the new (account_id, folder_id, imap_uid)
-- unique index dedupes correctly (SQLite treats NULLs as distinct).
UPDATE "mail_inbox_messages"
SET "folder_id" = (
    SELECT "f"."id" FROM "mail_folders" "f"
    WHERE "f"."account_id" = "mail_inbox_messages"."account_id"
    ORDER BY CASE WHEN "f"."imap_path" = 'INBOX' THEN 0 ELSE 1 END, "f"."id"
    LIMIT 1
)
WHERE "folder_id" IS NULL
  AND EXISTS (SELECT 1 FROM "mail_folders" "f" WHERE "f"."account_id" = "mail_inbox_messages"."account_id");
CREATE INDEX "mail_inbox_messages_account_id_received_at_idx" ON "mail_inbox_messages"("account_id", "received_at");
CREATE INDEX "mail_inbox_messages_account_id_subject_idx" ON "mail_inbox_messages"("account_id", "subject");
CREATE INDEX "mail_inbox_messages_account_id_from_address_idx" ON "mail_inbox_messages"("account_id", "from_address");
CREATE INDEX "mail_inbox_messages_account_id_thread_id_idx" ON "mail_inbox_messages"("account_id", "thread_id");
CREATE UNIQUE INDEX "mail_inbox_messages_account_id_folder_id_imap_uid_key" ON "mail_inbox_messages"("account_id", "folder_id", "imap_uid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "mail_rules_enabled_sort_order_idx" ON "mail_rules"("enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "mail_vip_senders_address_key" ON "mail_vip_senders"("address");

-- Full-text search (SQLite FTS5). Virtual table + external-content triggers keep it in sync
-- with mail_inbox_messages. The application falls back to LIKE/contains if FTS is unavailable.
CREATE VIRTUAL TABLE "mail_messages_fts" USING fts5(
    subject,
    from_address,
    snippet,
    body_text,
    content='mail_inbox_messages',
    content_rowid='rowid'
);
INSERT INTO "mail_messages_fts"("rowid", "subject", "from_address", "snippet", "body_text")
    SELECT "rowid", "subject", "from_address", "snippet", "body_text" FROM "mail_inbox_messages";
CREATE TRIGGER "mail_messages_fts_ai" AFTER INSERT ON "mail_inbox_messages" BEGIN
    INSERT INTO "mail_messages_fts"("rowid", "subject", "from_address", "snippet", "body_text")
        VALUES (new."rowid", new."subject", new."from_address", new."snippet", new."body_text");
END;
CREATE TRIGGER "mail_messages_fts_ad" AFTER DELETE ON "mail_inbox_messages" BEGIN
    INSERT INTO "mail_messages_fts"("mail_messages_fts", "rowid", "subject", "from_address", "snippet", "body_text")
        VALUES ('delete', old."rowid", old."subject", old."from_address", old."snippet", old."body_text");
END;
CREATE TRIGGER "mail_messages_fts_au" AFTER UPDATE ON "mail_inbox_messages" BEGIN
    INSERT INTO "mail_messages_fts"("mail_messages_fts", "rowid", "subject", "from_address", "snippet", "body_text")
        VALUES ('delete', old."rowid", old."subject", old."from_address", old."snippet", old."body_text");
    INSERT INTO "mail_messages_fts"("rowid", "subject", "from_address", "snippet", "body_text")
        VALUES (new."rowid", new."subject", new."from_address", new."snippet", new."body_text");
END;
