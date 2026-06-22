-- Mail Portal: folders, attachments, priority, AI actions, audit log

ALTER TABLE "mail_accounts" ADD COLUMN "provider_preset" TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE "mail_accounts" ADD COLUMN "imap_mailbox" TEXT NOT NULL DEFAULT 'INBOX';
ALTER TABLE "mail_accounts" ADD COLUMN "oauth_provider" TEXT;
ALTER TABLE "mail_accounts" ADD COLUMN "oauth_token_enc" TEXT;
ALTER TABLE "mail_accounts" ADD COLUMN "sync_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "mail_inbox_messages" ADD COLUMN "folder_id" TEXT;
ALTER TABLE "mail_inbox_messages" ADD COLUMN "in_reply_to" TEXT;
ALTER TABLE "mail_inbox_messages" ADD COLUMN "cc_addresses" JSONB;
ALTER TABLE "mail_inbox_messages" ADD COLUMN "body_html" TEXT;
ALTER TABLE "mail_inbox_messages" ADD COLUMN "has_attachments" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "mail_inbox_messages_account_id_subject_idx" ON "mail_inbox_messages"("account_id", "subject");
CREATE INDEX "mail_inbox_messages_account_id_from_address_idx" ON "mail_inbox_messages"("account_id", "from_address");

ALTER TABLE "mail_drafts" ADD COLUMN "reply_to_message_id" TEXT;
ALTER TABLE "mail_drafts" ADD COLUMN "to_addresses" JSONB;
ALTER TABLE "mail_drafts" ADD COLUMN "cc_addresses" JSONB;

CREATE TABLE "mail_folders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "imap_path" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "uid_validity" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_folders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mail_folders_account_id_imap_path_key" ON "mail_folders"("account_id", "imap_path");

CREATE TABLE "mail_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "content_id" TEXT,
    "storage_key" TEXT,
    "downloaded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_inbox_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "mail_attachments_message_id_idx" ON "mail_attachments"("message_id");

CREATE TABLE "mail_priority_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "category" TEXT NOT NULL DEFAULT 'info',
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "explanation" TEXT NOT NULL DEFAULT '',
    "rule_signals" JSONB,
    "extracted_actions" JSONB,
    "model_provider" TEXT,
    "model_name" TEXT,
    "scored_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_priority_scores_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_inbox_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mail_priority_scores_message_id_key" ON "mail_priority_scores"("message_id");
CREATE INDEX "mail_priority_scores_category_priority_idx" ON "mail_priority_scores"("category", "priority");

CREATE TABLE "mail_ai_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "input_hash" TEXT,
    "output_text" TEXT,
    "tone" TEXT,
    "model_provider" TEXT,
    "model_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_ai_actions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_inbox_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "mail_ai_actions_message_id_kind_idx" ON "mail_ai_actions"("message_id", "kind");

CREATE TABLE "mail_audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT,
    "message_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_audit_log_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "mail_audit_log_created_at_idx" ON "mail_audit_log"("created_at");
CREATE INDEX "mail_audit_log_account_id_action_idx" ON "mail_audit_log"("account_id", "action");

CREATE INDEX "mail_inbox_messages_folder_id_idx" ON "mail_inbox_messages"("folder_id");
