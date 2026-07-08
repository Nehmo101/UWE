-- AlterTable
ALTER TABLE "mail_folders" ADD COLUMN "last_seen_uid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "mail_folders" ADD COLUMN "folder_role" TEXT;

-- AlterTable
ALTER TABLE "mail_inbox_messages" ADD COLUMN "references" TEXT;
ALTER TABLE "mail_inbox_messages" ADD COLUMN "thread_id" TEXT;
ALTER TABLE "mail_inbox_messages" ADD COLUMN "bcc_addresses" JSONB;
ALTER TABLE "mail_inbox_messages" ADD COLUMN "is_starred" BOOLEAN NOT NULL DEFAULT false;

-- Backfill NULL folder_id to the account's INBOX folder so the new unique index dedupes correctly.
UPDATE "mail_inbox_messages" m
SET "folder_id" = (
    SELECT f."id" FROM "mail_folders" f
    WHERE f."account_id" = m."account_id"
    ORDER BY CASE WHEN f."imap_path" = 'INBOX' THEN 0 ELSE 1 END, f."id"
    LIMIT 1
)
WHERE m."folder_id" IS NULL
  AND EXISTS (SELECT 1 FROM "mail_folders" f WHERE f."account_id" = m."account_id");

-- DropIndex + CreateIndex (per-mailbox UID uniqueness)
DROP INDEX IF EXISTS "mail_inbox_messages_account_id_imap_uid_key";
CREATE UNIQUE INDEX "mail_inbox_messages_account_id_folder_id_imap_uid_key" ON "mail_inbox_messages"("account_id", "folder_id", "imap_uid");
CREATE INDEX "mail_inbox_messages_account_id_thread_id_idx" ON "mail_inbox_messages"("account_id", "thread_id");

-- CreateTable
CREATE TABLE "mail_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "account_id" TEXT,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "last_applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mail_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_vip_senders" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_vip_senders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_rules_enabled_sort_order_idx" ON "mail_rules"("enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "mail_vip_senders_address_key" ON "mail_vip_senders"("address");

-- AddForeignKey
ALTER TABLE "mail_rules" ADD CONSTRAINT "mail_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
