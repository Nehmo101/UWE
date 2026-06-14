/*
  Warnings:

  - You are about to alter the column `body_logged` on the `mail_message_logs` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `is_system` on the `mail_recipient_groups` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `is_active` on the `mail_templates` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `is_system` on the `mail_templates` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.

*/
-- CreateTable
CREATE TABLE "capture_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "capture_type" TEXT NOT NULL DEFAULT 'quick_note',
    "status" TEXT NOT NULL DEFAULT 'inbox',
    "url" TEXT,
    "storage_key" TEXT,
    "world_id" TEXT,
    "page_id" TEXT,
    "metadata" JSONB,
    "captured_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triaged_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "capture_entries_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "capture_entries_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "personal_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'idea',
    "category" TEXT NOT NULL DEFAULT 'other',
    "next_action" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "links" JSONB,
    "cost_cents" INTEGER,
    "world_id" TEXT,
    "page_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "personal_projects_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "personal_projects_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workshop_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "project_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "description" TEXT NOT NULL DEFAULT '',
    "materials_needed" JSONB,
    "materials_used" JSONB,
    "colors_used" JSONB,
    "filaments_used" JSONB,
    "stl_links" JSONB,
    "image_gallery" JSONB,
    "reference_images" JSONB,
    "progress_photos" JSONB,
    "cost_cents" INTEGER,
    "next_action" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "world_id" TEXT,
    "page_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workshop_projects_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workshop_projects_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contract_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expense_type" TEXT NOT NULL DEFAULT 'other',
    "amount_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billing_day" INTEGER,
    "renewal_date" DATETIME,
    "cancel_by_date" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "hardware_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "hostname" TEXT,
    "ip_address" TEXT,
    "specs" JSONB,
    "setup_steps" JSONB,
    "error_notes" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "personal_brain_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "personal_brain_facts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fact_type" TEXT NOT NULL DEFAULT 'custom',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "admin_entity_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL DEFAULT 'related',
    "label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "generator_presets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "target_type" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "generator_presets_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "generator_outputs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "page_id" TEXT,
    "preset_id" TEXT,
    "context_type" TEXT,
    "context_id" TEXT,
    "generator_action" TEXT,
    "prompt_summary" TEXT,
    "output" JSONB NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "variant_of_id" TEXT,
    "ai_run_id" TEXT,
    "tone" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "generator_outputs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "generator_outputs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "generator_outputs_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "generator_presets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mail_message_logs" (
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
    "body_logged" BOOLEAN NOT NULL DEFAULT false,
    "body_preview" TEXT,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_message_logs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_mail_message_logs" ("body_logged", "body_preview", "created_at", "error_message", "from_address", "id", "sent_at", "source_id", "source_type", "status", "subject", "template_id", "to_addresses", "world_id") SELECT "body_logged", "body_preview", "created_at", "error_message", "from_address", "id", "sent_at", "source_id", "source_type", "status", "subject", "template_id", "to_addresses", "world_id" FROM "mail_message_logs";
DROP TABLE "mail_message_logs";
ALTER TABLE "new_mail_message_logs" RENAME TO "mail_message_logs";
CREATE INDEX "mail_message_logs_world_id_status_idx" ON "mail_message_logs"("world_id", "status");
CREATE INDEX "mail_message_logs_created_at_idx" ON "mail_message_logs"("created_at");
CREATE TABLE "new_mail_recipient_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mail_recipient_groups_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_mail_recipient_groups" ("created_at", "description", "id", "is_system", "name", "slug", "updated_at", "world_id") SELECT "created_at", "description", "id", "is_system", "name", "slug", "updated_at", "world_id" FROM "mail_recipient_groups";
DROP TABLE "mail_recipient_groups";
ALTER TABLE "new_mail_recipient_groups" RENAME TO "mail_recipient_groups";
CREATE UNIQUE INDEX "mail_recipient_groups_world_id_slug_key" ON "mail_recipient_groups"("world_id", "slug");
CREATE TABLE "new_mail_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL DEFAULT '',
    "body_text" TEXT NOT NULL DEFAULT '',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mail_templates_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_mail_templates" ("body_html", "body_text", "created_at", "description", "id", "is_active", "is_system", "kind", "name", "slug", "subject", "updated_at", "world_id") SELECT "body_html", "body_text", "created_at", "description", "id", "is_active", "is_system", "kind", "name", "slug", "subject", "updated_at", "world_id" FROM "mail_templates";
DROP TABLE "mail_templates";
ALTER TABLE "new_mail_templates" RENAME TO "mail_templates";
CREATE INDEX "mail_templates_kind_idx" ON "mail_templates"("kind");
CREATE UNIQUE INDEX "mail_templates_world_id_slug_key" ON "mail_templates"("world_id", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "capture_entries_status_captured_at_idx" ON "capture_entries"("status", "captured_at");

-- CreateIndex
CREATE INDEX "capture_entries_capture_type_idx" ON "capture_entries"("capture_type");

-- CreateIndex
CREATE INDEX "capture_entries_world_id_idx" ON "capture_entries"("world_id");

-- CreateIndex
CREATE INDEX "personal_projects_status_idx" ON "personal_projects"("status");

-- CreateIndex
CREATE INDEX "personal_projects_category_idx" ON "personal_projects"("category");

-- CreateIndex
CREATE INDEX "personal_projects_world_id_idx" ON "personal_projects"("world_id");

-- CreateIndex
CREATE INDEX "workshop_projects_status_idx" ON "workshop_projects"("status");

-- CreateIndex
CREATE INDEX "workshop_projects_project_type_idx" ON "workshop_projects"("project_type");

-- CreateIndex
CREATE INDEX "workshop_projects_world_id_idx" ON "workshop_projects"("world_id");

-- CreateIndex
CREATE INDEX "contract_expenses_status_idx" ON "contract_expenses"("status");

-- CreateIndex
CREATE INDEX "contract_expenses_expense_type_idx" ON "contract_expenses"("expense_type");

-- CreateIndex
CREATE INDEX "contract_expenses_renewal_date_idx" ON "contract_expenses"("renewal_date");

-- CreateIndex
CREATE INDEX "hardware_devices_status_idx" ON "hardware_devices"("status");

-- CreateIndex
CREATE INDEX "hardware_devices_role_idx" ON "hardware_devices"("role");

-- CreateIndex
CREATE INDEX "personal_brain_documents_category_idx" ON "personal_brain_documents"("category");

-- CreateIndex
CREATE INDEX "personal_brain_facts_fact_type_idx" ON "personal_brain_facts"("fact_type");

-- CreateIndex
CREATE INDEX "admin_entity_links_source_type_source_id_idx" ON "admin_entity_links"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "admin_entity_links_target_type_target_id_idx" ON "admin_entity_links"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "generator_presets_world_id_target_type_idx" ON "generator_presets"("world_id", "target_type");

-- CreateIndex
CREATE INDEX "generator_presets_target_type_sort_order_idx" ON "generator_presets"("target_type", "sort_order");

-- CreateIndex
CREATE INDEX "generator_outputs_world_id_page_id_idx" ON "generator_outputs"("world_id", "page_id");

-- CreateIndex
CREATE INDEX "generator_outputs_context_type_context_id_idx" ON "generator_outputs"("context_type", "context_id");

-- CreateIndex
CREATE INDEX "generator_outputs_preset_id_idx" ON "generator_outputs"("preset_id");

-- CreateIndex
CREATE INDEX "generator_outputs_is_favorite_idx" ON "generator_outputs"("is_favorite");
