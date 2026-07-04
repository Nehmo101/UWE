-- CreateTable
CREATE TABLE "mail_unsubscribe_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "message_id" TEXT,
    "sender_address" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "target_url" TEXT,
    "target_mailto" TEXT,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "requested_by_user_id" TEXT,
    "requested_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_unsubscribe_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mail_unsubscribe_requests_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_inbox_messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "list_unsubscribe_http_url" TEXT,
    "list_unsubscribe_mailto" TEXT,
    "list_unsubscribe_post_supported" BOOLEAN NOT NULL DEFAULT false,
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "mail_unsubscribe_requests_account_id_sender_address_idx" ON "mail_unsubscribe_requests"("account_id", "sender_address");

-- CreateIndex
CREATE INDEX "mail_unsubscribe_requests_status_idx" ON "mail_unsubscribe_requests"("status");
