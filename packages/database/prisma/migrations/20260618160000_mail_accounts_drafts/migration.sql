CREATE TABLE "mail_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER,
    "username" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "mail_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT,
    "world_id" TEXT,
    "subject" TEXT NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mail_drafts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "mail_drafts_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "mail_drafts_status_created_at_idx" ON "mail_drafts"("status", "created_at");
