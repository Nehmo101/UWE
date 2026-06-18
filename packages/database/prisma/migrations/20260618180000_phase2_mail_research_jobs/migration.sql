-- AlterTable
ALTER TABLE "mail_accounts" ADD COLUMN "last_imap_sync_at" DATETIME;
ALTER TABLE "mail_accounts" ADD COLUMN "imap_sync_error" TEXT;

-- CreateTable
CREATE TABLE "mail_inbox_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "imap_uid" TEXT NOT NULL,
    "message_id" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "from_address" TEXT NOT NULL,
    "to_addresses" JSONB,
    "snippet" TEXT,
    "body_text" TEXT,
    "received_at" DATETIME NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_inbox_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_inbox_messages_account_id_imap_uid_key" ON "mail_inbox_messages"("account_id", "imap_uid");
CREATE INDEX "mail_inbox_messages_account_id_received_at_idx" ON "mail_inbox_messages"("account_id", "received_at");
