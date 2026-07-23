-- Brain database baseline (uwe-brain.db). Generated from prisma/brain/schema.prisma
-- via 'prisma migrate diff --from-empty', plus the mail FTS5 virtual table + sync
-- triggers (external-content, mirrors the main-db mail_client_improvements migration).

-- CreateTable
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
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "mail_recipient_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "mail_recipients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_recipients_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "mail_recipient_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    "body_logged" BOOLEAN NOT NULL DEFAULT false,
    "body_preview" TEXT,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "mail_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "provider_preset" TEXT NOT NULL DEFAULT 'generic',
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "imap_mailbox" TEXT NOT NULL DEFAULT 'INBOX',
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER,
    "username" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "oauth_provider" TEXT,
    "oauth_token_enc" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT,
    "last_imap_sync_at" DATETIME,
    "imap_sync_error" TEXT,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "mail_folders" (
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

-- CreateTable
CREATE TABLE "mail_inbox_messages" (
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "mail_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT,
    "world_id" TEXT,
    "reply_to_message_id" TEXT,
    "subject" TEXT NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "to_addresses" JSONB,
    "cc_addresses" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mail_drafts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "personal_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'idea',
    "category" TEXT NOT NULL DEFAULT 'other',
    "next_action" TEXT,
    "next_action_date" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "links" JSONB,
    "cost_cents" INTEGER,
    "world_id" TEXT,
    "page_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "project_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_steps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "personal_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL DEFAULT '',
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "caption" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "personal_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "result_photos" JSONB,
    "cost_cents" INTEGER,
    "next_action" TEXT,
    "next_action_date" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "world_id" TEXT,
    "page_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workshop_paint_recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "target_type" TEXT NOT NULL DEFAULT 'other',
    "primer" TEXT NOT NULL DEFAULT '',
    "basecoat" TEXT NOT NULL DEFAULT '',
    "wash" TEXT NOT NULL DEFAULT '',
    "highlights" TEXT NOT NULL DEFAULT '',
    "colors_used" JSONB,
    "result_photo_url" TEXT,
    "rating" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workshop_paint_recipes_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workshop_print_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "printer" TEXT NOT NULL DEFAULT '',
    "nozzle" TEXT NOT NULL DEFAULT '',
    "filament" TEXT NOT NULL DEFAULT '',
    "layer_height" TEXT NOT NULL DEFAULT '',
    "supports" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "errors" TEXT NOT NULL DEFAULT '',
    "improvements" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workshop_print_profiles_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workshop_terrain_rentals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "terrain_set_name" TEXT NOT NULL,
    "box_label" TEXT NOT NULL DEFAULT '',
    "replacement_value_cents" INTEGER,
    "rental_price_cents" INTEGER,
    "deposit_cents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'available',
    "damages" TEXT NOT NULL DEFAULT '',
    "handover_checklist" JSONB,
    "return_checklist" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workshop_terrain_rentals_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
CREATE TABLE "hardware_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "hostname" TEXT,
    "ip_address" TEXT,
    "local_url" TEXT,
    "public_url" TEXT,
    "operating_system" TEXT NOT NULL DEFAULT '',
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
CREATE TABLE "personal_brain_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "personal_brain_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "personal_brain_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "miniature_collection_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "game_system" TEXT,
    "faction" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'purchased',
    "notes" TEXT NOT NULL DEFAULT '',
    "reference_image_asset_id" TEXT,
    "compare_photo_asset_ids" JSONB,
    "workshop_project_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "miniature_collection_items_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE TABLE "research_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "context_mode" TEXT NOT NULL DEFAULT 'dnd_brain',
    "report_md" TEXT,
    "owner_id" TEXT,
    "ai_run_id" TEXT,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "research_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "fetched_at" DATETIME,
    CONSTRAINT "research_sources_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "research_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

-- CreateIndex
CREATE INDEX "mail_templates_kind_idx" ON "mail_templates"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "mail_templates_world_id_slug_key" ON "mail_templates"("world_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "mail_recipient_groups_world_id_slug_key" ON "mail_recipient_groups"("world_id", "slug");

-- CreateIndex
CREATE INDEX "mail_recipients_user_id_idx" ON "mail_recipients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_recipients_group_id_email_key" ON "mail_recipients"("group_id", "email");

-- CreateIndex
CREATE INDEX "mail_message_logs_world_id_status_idx" ON "mail_message_logs"("world_id", "status");

-- CreateIndex
CREATE INDEX "mail_message_logs_created_at_idx" ON "mail_message_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mail_folders_account_id_imap_path_key" ON "mail_folders"("account_id", "imap_path");

-- CreateIndex
CREATE INDEX "mail_inbox_messages_account_id_received_at_idx" ON "mail_inbox_messages"("account_id", "received_at");

-- CreateIndex
CREATE INDEX "mail_inbox_messages_account_id_subject_idx" ON "mail_inbox_messages"("account_id", "subject");

-- CreateIndex
CREATE INDEX "mail_inbox_messages_account_id_from_address_idx" ON "mail_inbox_messages"("account_id", "from_address");

-- CreateIndex
CREATE INDEX "mail_inbox_messages_account_id_thread_id_idx" ON "mail_inbox_messages"("account_id", "thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_inbox_messages_account_id_folder_id_imap_uid_key" ON "mail_inbox_messages"("account_id", "folder_id", "imap_uid");

-- CreateIndex
CREATE INDEX "mail_attachments_message_id_idx" ON "mail_attachments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_priority_scores_message_id_key" ON "mail_priority_scores"("message_id");

-- CreateIndex
CREATE INDEX "mail_priority_scores_category_priority_idx" ON "mail_priority_scores"("category", "priority");

-- CreateIndex
CREATE INDEX "mail_ai_actions_message_id_kind_idx" ON "mail_ai_actions"("message_id", "kind");

-- CreateIndex
CREATE INDEX "mail_unsubscribe_requests_account_id_sender_address_idx" ON "mail_unsubscribe_requests"("account_id", "sender_address");

-- CreateIndex
CREATE INDEX "mail_unsubscribe_requests_status_idx" ON "mail_unsubscribe_requests"("status");

-- CreateIndex
CREATE INDEX "mail_audit_log_created_at_idx" ON "mail_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "mail_audit_log_account_id_action_idx" ON "mail_audit_log"("account_id", "action");

-- CreateIndex
CREATE INDEX "mail_drafts_status_created_at_idx" ON "mail_drafts"("status", "created_at");

-- CreateIndex
CREATE INDEX "mail_rules_enabled_sort_order_idx" ON "mail_rules"("enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "mail_vip_senders_address_key" ON "mail_vip_senders"("address");

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
CREATE INDEX "project_steps_project_id_sort_order_idx" ON "project_steps"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "project_images_project_id_sort_order_idx" ON "project_images"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "workshop_projects_status_idx" ON "workshop_projects"("status");

-- CreateIndex
CREATE INDEX "workshop_projects_project_type_idx" ON "workshop_projects"("project_type");

-- CreateIndex
CREATE INDEX "workshop_projects_world_id_idx" ON "workshop_projects"("world_id");

-- CreateIndex
CREATE INDEX "workshop_paint_recipes_target_type_idx" ON "workshop_paint_recipes"("target_type");

-- CreateIndex
CREATE INDEX "workshop_paint_recipes_workshop_project_id_idx" ON "workshop_paint_recipes"("workshop_project_id");

-- CreateIndex
CREATE INDEX "workshop_print_profiles_workshop_project_id_idx" ON "workshop_print_profiles"("workshop_project_id");

-- CreateIndex
CREATE INDEX "workshop_terrain_rentals_status_idx" ON "workshop_terrain_rentals"("status");

-- CreateIndex
CREATE INDEX "workshop_terrain_rentals_workshop_project_id_idx" ON "workshop_terrain_rentals"("workshop_project_id");

-- CreateIndex
CREATE INDEX "contract_expenses_status_idx" ON "contract_expenses"("status");

-- CreateIndex
CREATE INDEX "contract_expenses_expense_type_idx" ON "contract_expenses"("expense_type");

-- CreateIndex
CREATE INDEX "contract_expenses_renewal_date_idx" ON "contract_expenses"("renewal_date");

-- CreateIndex
CREATE INDEX "contract_expenses_next_payment_date_idx" ON "contract_expenses"("next_payment_date");

-- CreateIndex
CREATE INDEX "hardware_devices_status_idx" ON "hardware_devices"("status");

-- CreateIndex
CREATE INDEX "hardware_devices_role_idx" ON "hardware_devices"("role");

-- CreateIndex
CREATE INDEX "personal_brain_documents_category_idx" ON "personal_brain_documents"("category");

-- CreateIndex
CREATE INDEX "personal_brain_chunks_document_id_idx" ON "personal_brain_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_brain_chunks_document_id_chunk_index_key" ON "personal_brain_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE INDEX "personal_brain_facts_fact_type_idx" ON "personal_brain_facts"("fact_type");

-- CreateIndex
CREATE INDEX "admin_entity_links_source_type_source_id_idx" ON "admin_entity_links"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "admin_entity_links_target_type_target_id_idx" ON "admin_entity_links"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");

-- CreateIndex
CREATE INDEX "calendar_events_world_id_start_at_idx" ON "calendar_events"("world_id", "start_at");

-- CreateIndex
CREATE INDEX "calendar_events_feed_id_external_uid_idx" ON "calendar_events"("feed_id", "external_uid");

-- CreateIndex
CREATE INDEX "miniature_collection_items_status_idx" ON "miniature_collection_items"("status");

-- CreateIndex
CREATE INDEX "miniature_collection_items_manufacturer_idx" ON "miniature_collection_items"("manufacturer");

-- CreateIndex
CREATE INDEX "miniature_collection_items_game_system_idx" ON "miniature_collection_items"("game_system");

-- CreateIndex
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");

-- CreateIndex
CREATE INDEX "research_sessions_status_created_at_idx" ON "research_sessions"("status", "created_at");

-- CreateIndex
CREATE INDEX "research_sessions_world_id_created_at_idx" ON "research_sessions"("world_id", "created_at");

-- CreateIndex
CREATE INDEX "research_sources_session_id_idx" ON "research_sources"("session_id");

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


-- Full-text search (SQLite FTS5) over mail_inbox_messages.
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
