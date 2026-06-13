-- Mail Center: templates, recipient groups and message logs (outbound v1)

CREATE TABLE "mail_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL DEFAULT '',
    "body_text" TEXT NOT NULL DEFAULT '',
    "is_system" INTEGER NOT NULL DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mail_templates_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mail_templates_world_id_slug_key" ON "mail_templates"("world_id", "slug");
CREATE INDEX "mail_templates_kind_idx" ON "mail_templates"("kind");

CREATE TABLE "mail_recipient_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_system" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mail_recipient_groups_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mail_recipient_groups_world_id_slug_key" ON "mail_recipient_groups"("world_id", "slug");

CREATE TABLE "mail_recipients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_recipients_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "mail_recipient_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mail_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mail_recipients_group_id_email_key" ON "mail_recipients"("group_id", "email");
CREATE INDEX "mail_recipients_user_id_idx" ON "mail_recipients"("user_id");

CREATE TABLE "mail_message_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subject" TEXT NOT NULL,
    "to_addresses" JSONB NOT NULL,
    "from_address" TEXT NOT NULL,
    "template_id" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "error_message" TEXT,
    "body_logged" INTEGER NOT NULL DEFAULT 0,
    "body_preview" TEXT,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_message_logs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "mail_message_logs_world_id_status_idx" ON "mail_message_logs"("world_id", "status");
CREATE INDEX "mail_message_logs_created_at_idx" ON "mail_message_logs"("created_at");
