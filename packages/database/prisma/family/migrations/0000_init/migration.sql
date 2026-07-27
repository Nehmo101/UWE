-- CreateTable
CREATE TABLE "contract_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expense_type" TEXT NOT NULL DEFAULT 'other',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
    "category_label" TEXT NOT NULL DEFAULT '',
    "amount_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billing_day" INTEGER,
    "start_date" DATETIME,
    "next_payment_date" DATETIME,
    "renewal_date" DATETIME,
    "cancel_by_date" DATETIME,
    "portal_url" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "calendar_feeds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'read_only',
    "url" TEXT,
    "caldav_url" TEXT,
    "username" TEXT,
    "credentials_enc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "last_sync_at" DATETIME,
    "sync_error" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feed_id" TEXT,
    "world_id" TEXT,
    "session_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start_at" DATETIME NOT NULL,
    "end_at" DATETIME,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'personal',
    "external_uid" TEXT,
    "remote_href" TEXT,
    "remote_etag" TEXT,
    "caldav_pending" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "calendar_events_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "calendar_feeds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "body" TEXT NOT NULL DEFAULT '',
    "variables" JSONB,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT NOT NULL DEFAULT '',
    "servings_base" REAL NOT NULL DEFAULT 2,
    "duration_minutes" INTEGER,
    "effort_rating" INTEGER,
    "taste_rating" INTEGER,
    "kid_rating" INTEGER,
    "partner_rating" INTEGER,
    "steps" JSONB NOT NULL,
    "variants" JSONB,
    "image_storage_key" TEXT,
    "source_url" TEXT,
    "source_scan_id" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meal_plan_weeks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iso_year" INTEGER NOT NULL,
    "iso_week" INTEGER NOT NULL,
    "household_factor" REAL NOT NULL DEFAULT 2.5,
    "goals" JSONB,
    "ai_draft" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "meal_plan_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "slot" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL DEFAULT 'recipe',
    "recipe_id" TEXT,
    "servings" REAL,
    "note" TEXT NOT NULL DEFAULT '',
    "cooked" BOOLEAN NOT NULL DEFAULT false,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "meal_plan_entries_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "meal_plan_weeks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meal_plan_entries_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week_id" TEXT,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "source_recipe_ids" JSONB,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bring_connections" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "email_encrypted" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "bring_user_uuid" TEXT,
    "bring_public_uuid" TEXT,
    "default_list_uuid" TEXT,
    "default_list_name" TEXT,
    "available_lists" JSONB,
    "last_synced_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "scan_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'unanalyzed',
    "privacyLevel" TEXT NOT NULL DEFAULT 'private',
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "page_count" INTEGER,
    "ocr_text" TEXT NOT NULL DEFAULT '',
    "ocr_engine" TEXT,
    "detected_kind" TEXT NOT NULL DEFAULT 'unknown',
    "detection_confidence" TEXT,
    "extracted_fields" JSONB,
    "proposal" JSONB,
    "uncertainties" JSONB,
    "connector_job_id" TEXT,
    "error_message" TEXT,
    "world_id" TEXT,
    "filed_target_type" TEXT,
    "filed_target_id" TEXT,
    "filed_at" DATETIME,
    "rejected_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "interval" TEXT NOT NULL DEFAULT 'yearly',
    "last_done_at" DATETIME,
    "next_due_at" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pantry_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'pantry',
    "amount" REAL,
    "unit" TEXT NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "expires_at" DATETIME,
    "low_stock" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "family_chat_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'shared',
    "owner_user_id" TEXT,
    "connector_id" TEXT,
    "model_id" TEXT,
    "model_label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "family_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "family_chat_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "family_brain_facts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "owner_user_id" TEXT,
    "tags" JSONB,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "family_member_profiles" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "display_name" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "contract_expenses_status_idx" ON "contract_expenses"("status");

-- CreateIndex
CREATE INDEX "contract_expenses_expense_type_idx" ON "contract_expenses"("expense_type");

-- CreateIndex
CREATE INDEX "contract_expenses_renewal_date_idx" ON "contract_expenses"("renewal_date");

-- CreateIndex
CREATE INDEX "contract_expenses_next_payment_date_idx" ON "contract_expenses"("next_payment_date");

-- CreateIndex
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");

-- CreateIndex
CREATE INDEX "calendar_events_world_id_start_at_idx" ON "calendar_events"("world_id", "start_at");

-- CreateIndex
CREATE INDEX "calendar_events_feed_id_external_uid_idx" ON "calendar_events"("feed_id", "external_uid");

-- CreateIndex
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");

-- CreateIndex
CREATE INDEX "recipes_status_idx" ON "recipes"("status");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_normalized_name_idx" ON "recipe_ingredients"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_weeks_iso_year_iso_week_key" ON "meal_plan_weeks"("iso_year", "iso_week");

-- CreateIndex
CREATE INDEX "meal_plan_entries_week_id_date_idx" ON "meal_plan_entries"("week_id", "date");

-- CreateIndex
CREATE INDEX "shopping_list_items_list_id_category_idx" ON "shopping_list_items"("list_id", "category");

-- CreateIndex
CREATE INDEX "scan_documents_status_created_at_idx" ON "scan_documents"("status", "created_at");

-- CreateIndex
CREATE INDEX "scan_documents_detected_kind_idx" ON "scan_documents"("detected_kind");

-- CreateIndex
CREATE INDEX "scan_documents_world_id_idx" ON "scan_documents"("world_id");

-- CreateIndex
CREATE INDEX "maintenance_tasks_next_due_at_idx" ON "maintenance_tasks"("next_due_at");

-- CreateIndex
CREATE INDEX "pantry_items_location_idx" ON "pantry_items"("location");

-- CreateIndex
CREATE INDEX "pantry_items_expires_at_idx" ON "pantry_items"("expires_at");

-- CreateIndex
CREATE INDEX "family_chat_conversations_scope_owner_user_id_updated_at_idx" ON "family_chat_conversations"("scope", "owner_user_id", "updated_at");

-- CreateIndex
CREATE INDEX "family_chat_messages_conversation_id_created_at_idx" ON "family_chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "family_brain_facts_owner_user_id_updated_at_idx" ON "family_brain_facts"("owner_user_id", "updated_at");

