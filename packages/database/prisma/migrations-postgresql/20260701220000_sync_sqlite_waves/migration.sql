-- CreateEnum
CREATE TYPE "ContentReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "ContentReviewSourceType" AS ENUM ('ai_proposal', 'co_dm_change', 'player_note', 'portal_unlock');

-- CreateEnum
CREATE TYPE "WorkshopPaintTarget" AS ENUM ('miniature', 'terrain', 'diorama', 'other');

-- CreateEnum
CREATE TYPE "WorkshopRentalStatus" AS ENUM ('available', 'reserved', 'on_loan', 'maintenance', 'retired');

-- CreateEnum
CREATE TYPE "ContractExpenseSource" AS ENUM ('manual', 'ai_usage');

-- CreateEnum
CREATE TYPE "EntityTagEntityType" AS ENUM ('page', 'asset', 'soundboard_button', 'personal_brain_document', 'personal_brain_fact', 'capture', 'project', 'workshop', 'contract', 'hardware', 'dev_idea');

-- CreateEnum
CREATE TYPE "WorldEventSourceType" AS ENUM ('manual', 'faction_sim', 'session', 'import');

-- CreateEnum
CREATE TYPE "WorldEventEntityRole" AS ENUM ('primary', 'involved', 'location', 'faction');

-- CreateEnum
CREATE TYPE "DndRulesEdition" AS ENUM ('dnd5e_2014', 'dnd5e_2024');

-- CreateEnum
CREATE TYPE "QuestLifecycleStatus" AS ENUM ('open', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "MailPriorityCategory" AS ENUM ('urgent', 'reply_needed', 'today', 'waiting', 'info', 'newsletter', 'suspicious');

-- CreateEnum
CREATE TYPE "MailAiActionKind" AS ENUM ('summarize', 'reply_draft', 'prioritize');

-- CreateEnum
CREATE TYPE "MailAuditAction" AS ENUM ('account_create', 'account_update', 'account_delete', 'sync', 'read', 'search', 'draft_create', 'draft_update', 'send', 'prioritize', 'ai_summarize', 'ai_reply_draft');

-- CreateEnum
CREATE TYPE "DevIdeaStatus" AS ENUM ('in_planning', 'implemented', 'rejected');

-- CreateEnum
CREATE TYPE "DevIdeaType" AS ENUM ('feature', 'bug', 'prompt');

-- CreateEnum
CREATE TYPE "DevIdeaLifecycle" AS ENUM ('existing', 'planned', 'broken', 'deprecated');

-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('open', 'in_progress', 'resolved', 'wont_fix');

-- CreateEnum
CREATE TYPE "BugReportSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "MiniatureCollectionStatus" AS ENUM ('purchased', 'built', 'primed', 'painted');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('pending', 'preview', 'executing', 'completed', 'failed', 'rolled_back');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('knoteforge', 'obsidian', 'pdf', 'markdown', 'bulk_image');

-- CreateEnum
CREATE TYPE "ImportTargetType" AS ENUM ('world', 'personal_brain', 'capture', 'dnd_page');

-- CreateEnum
CREATE TYPE "DocumentTemplateCategory" AS ENUM ('contract', 'guide', 'checklist', 'other');

-- CreateEnum
CREATE TYPE "AtlasNodeLevel" AS ENUM ('globe', 'continent', 'landscape', 'city');

-- CreateEnum
CREATE TYPE "AtlasFeatureKind" AS ENUM ('region', 'river', 'road', 'biome', 'relief', 'label', 'pin');

-- CreateEnum
CREATE TYPE "AtlasLabelColor" AS ENUM ('black', 'red');

-- CreateEnum
CREATE TYPE "AtlasPaletteSource" AS ENUM ('builtin', 'ai', 'upload');

-- CreateEnum
CREATE TYPE "AtlasPaletteReviewStatus" AS ENUM ('pending', 'approved');

-- CreateEnum
CREATE TYPE "AiRoutingMode" AS ENUM ('LOCAL_ONLY', 'LOCAL_THEN_CLOUD', 'CLOUD_ONLY', 'DISABLED');

-- CreateEnum
CREATE TYPE "AiPrivacyLevel" AS ENUM ('CLOUD_ALLOWED', 'CLOUD_FORBIDDEN', 'LOCAL_REQUIRED');

-- CreateEnum
CREATE TYPE "AiFeatureCategory" AS ENUM ('general_chat', 'dnd_world', 'personal_brain', 'private_notes', 'admin_diagnostics', 'image_generation');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'review_submitted';
ALTER TYPE "ActivityAction" ADD VALUE 'review_approved';
ALTER TYPE "ActivityAction" ADD VALUE 'review_rejected';
ALTER TYPE "ActivityAction" ADD VALUE 'review_commented';

-- AlterEnum
ALTER TYPE "ActivityTargetType" ADD VALUE 'content_review';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'host_update_started';
ALTER TYPE "AuditAction" ADD VALUE 'host_update_completed';
ALTER TYPE "AuditAction" ADD VALUE 'host_update_failed';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CanonicalStatus" ADD VALUE 'prepared';
ALTER TYPE "CanonicalStatus" ADD VALUE 'played';
ALTER TYPE "CanonicalStatus" ADD VALUE 'discarded';

-- AlterEnum
ALTER TYPE "CaptureType" ADD VALUE 'voice_memo';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConnectorJobType" ADD VALUE 'label_print';
ALTER TYPE "ConnectorJobType" ADD VALUE 'printer_discover';

-- AlterEnum
ALTER TYPE "ConnectorLane" ADD VALUE 'printing';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MailTemplateKind" ADD VALUE 'session_reminder';
ALTER TYPE "MailTemplateKind" ADD VALUE 'system_warning';
ALTER TYPE "MailTemplateKind" ADD VALUE 'backup_warning';
ALTER TYPE "MailTemplateKind" ADD VALUE 'contract_reminder';
ALTER TYPE "MailTemplateKind" ADD VALUE 'terrain_rental';

-- AlterEnum
ALTER TYPE "WorldMemberRole" ADD VALUE 'co_dm';

-- AlterTable
ALTER TABLE "connectors" DROP COLUMN "allowed_capabilities",
DROP COLUMN "reported_capabilities";

-- AlterTable
ALTER TABLE "contract_expenses" ADD COLUMN     "source" "ContractExpenseSource" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "player_visible_schedule" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "mail_accounts" ADD COLUMN     "imap_mailbox" TEXT NOT NULL DEFAULT 'INBOX',
ADD COLUMN     "oauth_provider" TEXT,
ADD COLUMN     "oauth_token_enc" TEXT,
ADD COLUMN     "provider_preset" TEXT NOT NULL DEFAULT 'generic',
ADD COLUMN     "sync_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "mail_drafts" ADD COLUMN     "cc_addresses" JSONB,
ADD COLUMN     "reply_to_message_id" TEXT,
ADD COLUMN     "to_addresses" JSONB;

-- AlterTable
ALTER TABLE "mail_inbox_messages" ADD COLUMN     "body_html" TEXT,
ADD COLUMN     "cc_addresses" JSONB,
ADD COLUMN     "folder_id" TEXT,
ADD COLUMN     "has_attachments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "in_reply_to" TEXT;

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "quest_status" "QuestLifecycleStatus";

-- AlterTable
ALTER TABLE "personal_projects" ADD COLUMN     "next_action_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "spotify_connections" ADD COLUMN     "preferred_device_id" TEXT,
ADD COLUMN     "preferred_device_name" TEXT;

-- AlterTable
ALTER TABLE "workshop_projects" ADD COLUMN     "next_action_date" TIMESTAMP(3),
ADD COLUMN     "result_photos" JSONB;

-- AlterTable
ALTER TABLE "worlds" ADD COLUMN     "is_sandbox" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "page_key" TEXT NOT NULL,
    "widgets" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_calendars" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Weltkalender',
    "months" JSONB NOT NULL,
    "days_per_week" INTEGER NOT NULL DEFAULT 7,
    "day_names" JSONB,
    "current_date" JSONB NOT NULL,
    "epoch_label" TEXT,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_events" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "calendar_id" TEXT,
    "in_game_date" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "summary_player" TEXT,
    "summary_dm" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "secret_level" "SecretLevel" NOT NULL DEFAULT 'none',
    "source_type" "WorldEventSourceType" NOT NULL DEFAULT 'manual',
    "source_ai_proposal_id" TEXT,
    "game_session_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_event_entity_links" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "role" "WorldEventEntityRole" NOT NULL DEFAULT 'involved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "world_event_entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_states" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "goals" JSONB,
    "resources" JSONB,
    "relationships" JSONB,
    "agenda" TEXT NOT NULL DEFAULT '',
    "power_level" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "display_name" TEXT NOT NULL,
    "rules_edition" "DndRulesEdition" NOT NULL DEFAULT 'dnd5e_2024',
    "level" INTEGER NOT NULL DEFAULT 1,
    "abilities" JSONB NOT NULL,
    "skills" JSONB,
    "combat" JSONB,
    "spellcasting" JSONB,
    "classes" JSONB,
    "species" JSONB,
    "background" JSONB,
    "features" JSONB,
    "bio" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_spells" (
    "id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "spell_key" TEXT NOT NULL,
    "spell_level" INTEGER NOT NULL DEFAULT 0,
    "prepared" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "display_name" TEXT,
    "school" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_spells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_treasuries" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Gruppenschatz',
    "currencies" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "party_treasuries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "character_id" TEXT,
    "treasury_id" TEXT,
    "page_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight" DOUBLE PRECISION,
    "value" JSONB,
    "properties" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_statblocks" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "rules_edition" "DndRulesEdition" NOT NULL DEFAULT 'dnd5e_2024',
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structured_statblocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reviews" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "source_type" "ContentReviewSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" "ContentReviewStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "diff" JSONB,
    "payload" JSONB,
    "proposed_by_user_id" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "target_href" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_folders" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "imap_path" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "uid_validity" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "content_id" TEXT,
    "storage_key" TEXT,
    "downloaded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_priority_scores" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "category" "MailPriorityCategory" NOT NULL DEFAULT 'info',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "explanation" TEXT NOT NULL DEFAULT '',
    "rule_signals" JSONB,
    "extracted_actions" JSONB,
    "model_provider" TEXT,
    "model_name" TEXT,
    "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_priority_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_ai_actions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "kind" "MailAiActionKind" NOT NULL,
    "input_hash" TEXT,
    "output_text" TEXT,
    "tone" TEXT,
    "model_provider" TEXT,
    "model_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_ai_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_audit_log" (
    "id" TEXT NOT NULL,
    "account_id" TEXT,
    "message_id" TEXT,
    "user_id" TEXT,
    "action" "MailAuditAction" NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_paint_recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_type" "WorkshopPaintTarget" NOT NULL DEFAULT 'other',
    "primer" TEXT NOT NULL DEFAULT '',
    "basecoat" TEXT NOT NULL DEFAULT '',
    "wash" TEXT NOT NULL DEFAULT '',
    "highlights" TEXT NOT NULL DEFAULT '',
    "colors_used" JSONB,
    "result_photo_url" TEXT,
    "rating" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_paint_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_print_profiles" (
    "id" TEXT NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_print_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_terrain_rentals" (
    "id" TEXT NOT NULL,
    "terrain_set_name" TEXT NOT NULL,
    "box_label" TEXT NOT NULL DEFAULT '',
    "replacement_value_cents" INTEGER,
    "rental_price_cents" INTEGER,
    "deposit_cents" INTEGER,
    "status" "WorkshopRentalStatus" NOT NULL DEFAULT 'available',
    "damages" TEXT NOT NULL DEFAULT '',
    "handover_checklist" JSONB,
    "return_checklist" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_terrain_rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_brain_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_brain_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" "DevIdeaStatus" NOT NULL DEFAULT 'in_planning',
    "idea_type" "DevIdeaType" NOT NULL DEFAULT 'feature',
    "lifecycle" "DevIdeaLifecycle" NOT NULL DEFAULT 'planned',
    "module" TEXT,
    "maturity_level" TEXT,
    "chat_transcript" JSONB,
    "generated_prompt" TEXT,
    "dev_agent_job_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "BugReportStatus" NOT NULL DEFAULT 'open',
    "severity" "BugReportSeverity" NOT NULL DEFAULT 'medium',
    "module" TEXT,
    "screenshot_asset_id" TEXT,
    "reporter_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miniature_collection_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "game_system" TEXT,
    "faction" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "MiniatureCollectionStatus" NOT NULL DEFAULT 'purchased',
    "notes" TEXT NOT NULL DEFAULT '',
    "reference_image_asset_id" TEXT,
    "compare_photo_asset_ids" JSONB,
    "workshop_project_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "miniature_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "source_type" "ImportSourceType" NOT NULL,
    "target_type" "ImportTargetType" NOT NULL,
    "target_world_id" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'pending',
    "file_name" TEXT,
    "preview_payload" JSONB,
    "result_summary" JSONB,
    "undo_token" TEXT,
    "error_message" TEXT,
    "created_by_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DocumentTemplateCategory" NOT NULL DEFAULT 'other',
    "body" TEXT NOT NULL DEFAULT '',
    "variables" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_maps" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Atlas',
    "style_preset" TEXT NOT NULL DEFAULT 'tolkien-ink',
    "settings" JSONB,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "tile_layer" JSONB,
    "visibility" "Visibility" NOT NULL DEFAULT 'dm_only',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_nodes" (
    "id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "parent_feature_id" TEXT,
    "level" "AtlasNodeLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "extent" JSONB,
    "silhouette" JSONB,
    "seed" INTEGER,
    "background_asset_id" TEXT,
    "page_id" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'dm_only',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_features" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "kind" "AtlasFeatureKind" NOT NULL,
    "geometry" JSONB NOT NULL,
    "style" JSONB,
    "label_text" TEXT,
    "label_color" "AtlasLabelColor",
    "child_node_id" TEXT,
    "linked_page_id" TEXT,
    "layer" INTEGER NOT NULL DEFAULT 0,
    "visibility" "Visibility" NOT NULL DEFAULT 'dm_only',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_objects" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "palette_item_id" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "layer" INTEGER NOT NULL DEFAULT 0,
    "linked_page_id" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'dm_only',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_palette_items" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" "AtlasPaletteSource" NOT NULL DEFAULT 'builtin',
    "asset_id" TEXT,
    "builtin_glyph_key" TEXT,
    "review_status" "AtlasPaletteReviewStatus" NOT NULL DEFAULT 'approved',
    "style_tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_palette_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_gateway_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "routing_mode" "AiRoutingMode" NOT NULL DEFAULT 'LOCAL_THEN_CLOUD',
    "cloud_fallback_enabled" BOOLEAN NOT NULL DEFAULT false,
    "privacy_rules" JSONB NOT NULL DEFAULT '{}',
    "feature_models" JSONB NOT NULL DEFAULT '{}',
    "daily_budget_usd" DOUBLE PRECISION,
    "monthly_budget_usd" DOUBLE PRECISION,
    "per_user_daily_budget_usd" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_gateway_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cloud_providers" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "base_url" TEXT,
    "default_model" TEXT,
    "api_key_enc" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_cloud_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_user_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "cloud_fallback_allowed" BOOLEAN NOT NULL DEFAULT false,
    "daily_budget_usd" DOUBLE PRECISION,
    "granted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_user_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "feature" TEXT NOT NULL,
    "task_type" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "context_mode" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_usd" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_tags" (
    "id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "entity_type" "EntityTagEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "world_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_layouts_user_id_idx" ON "dashboard_layouts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_user_id_page_key_key" ON "dashboard_layouts"("user_id", "page_key");

-- CreateIndex
CREATE UNIQUE INDEX "world_calendars_world_id_key" ON "world_calendars"("world_id");

-- CreateIndex
CREATE INDEX "world_events_world_id_sort_order_idx" ON "world_events"("world_id", "sort_order");

-- CreateIndex
CREATE INDEX "world_event_entity_links_page_id_idx" ON "world_event_entity_links"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "world_event_entity_links_event_id_page_id_role_key" ON "world_event_entity_links"("event_id", "page_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "faction_states_page_id_key" ON "faction_states"("page_id");

-- CreateIndex
CREATE INDEX "faction_states_world_id_idx" ON "faction_states"("world_id");

-- CreateIndex
CREATE UNIQUE INDEX "characters_page_id_key" ON "characters"("page_id");

-- CreateIndex
CREATE INDEX "characters_world_id_owner_user_id_idx" ON "characters"("world_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "character_spells_character_id_idx" ON "character_spells"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_spells_character_id_spell_key_key" ON "character_spells"("character_id", "spell_key");

-- CreateIndex
CREATE UNIQUE INDEX "party_treasuries_world_id_key" ON "party_treasuries"("world_id");

-- CreateIndex
CREATE INDEX "inventory_items_world_id_idx" ON "inventory_items"("world_id");

-- CreateIndex
CREATE INDEX "inventory_items_character_id_idx" ON "inventory_items"("character_id");

-- CreateIndex
CREATE INDEX "inventory_items_treasury_id_idx" ON "inventory_items"("treasury_id");

-- CreateIndex
CREATE UNIQUE INDEX "structured_statblocks_page_id_key" ON "structured_statblocks"("page_id");

-- CreateIndex
CREATE INDEX "structured_statblocks_world_id_idx" ON "structured_statblocks"("world_id");

-- CreateIndex
CREATE INDEX "content_reviews_world_id_status_idx" ON "content_reviews"("world_id", "status");

-- CreateIndex
CREATE INDEX "content_reviews_status_created_at_idx" ON "content_reviews"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_reviews_source_type_source_id_key" ON "content_reviews"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "review_comments_review_id_created_at_idx" ON "review_comments"("review_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mail_folders_account_id_imap_path_key" ON "mail_folders"("account_id", "imap_path");

-- CreateIndex
CREATE INDEX "mail_attachments_message_id_idx" ON "mail_attachments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_priority_scores_message_id_key" ON "mail_priority_scores"("message_id");

-- CreateIndex
CREATE INDEX "mail_priority_scores_category_priority_idx" ON "mail_priority_scores"("category", "priority");

-- CreateIndex
CREATE INDEX "mail_ai_actions_message_id_kind_idx" ON "mail_ai_actions"("message_id", "kind");

-- CreateIndex
CREATE INDEX "mail_audit_log_created_at_idx" ON "mail_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "mail_audit_log_account_id_action_idx" ON "mail_audit_log"("account_id", "action");

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
CREATE INDEX "personal_brain_chunks_document_id_idx" ON "personal_brain_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_brain_chunks_document_id_chunk_index_key" ON "personal_brain_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE INDEX "dev_ideas_status_updated_at_idx" ON "dev_ideas"("status", "updated_at");

-- CreateIndex
CREATE INDEX "dev_ideas_idea_type_lifecycle_idx" ON "dev_ideas"("idea_type", "lifecycle");

-- CreateIndex
CREATE INDEX "bug_reports_status_updated_at_idx" ON "bug_reports"("status", "updated_at");

-- CreateIndex
CREATE INDEX "bug_reports_severity_idx" ON "bug_reports"("severity");

-- CreateIndex
CREATE INDEX "miniature_collection_items_status_idx" ON "miniature_collection_items"("status");

-- CreateIndex
CREATE INDEX "miniature_collection_items_manufacturer_idx" ON "miniature_collection_items"("manufacturer");

-- CreateIndex
CREATE INDEX "miniature_collection_items_game_system_idx" ON "miniature_collection_items"("game_system");

-- CreateIndex
CREATE INDEX "import_jobs_status_created_at_idx" ON "import_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_target_type_idx" ON "import_jobs"("target_type");

-- CreateIndex
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_maps_world_id_key" ON "atlas_maps"("world_id");

-- CreateIndex
CREATE INDEX "atlas_nodes_map_id_sort_order_idx" ON "atlas_nodes"("map_id", "sort_order");

-- CreateIndex
CREATE INDEX "atlas_nodes_parent_id_idx" ON "atlas_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "atlas_features_node_id_layer_sort_order_idx" ON "atlas_features"("node_id", "layer", "sort_order");

-- CreateIndex
CREATE INDEX "atlas_objects_node_id_layer_idx" ON "atlas_objects"("node_id", "layer");

-- CreateIndex
CREATE INDEX "atlas_palette_items_world_id_kind_idx" ON "atlas_palette_items"("world_id", "kind");

-- CreateIndex
CREATE INDEX "atlas_palette_items_review_status_idx" ON "atlas_palette_items"("review_status");

-- CreateIndex
CREATE INDEX "ai_cloud_providers_is_enabled_priority_idx" ON "ai_cloud_providers"("is_enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ai_cloud_providers_provider_id_key" ON "ai_cloud_providers"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_user_grants_user_id_key" ON "ai_user_grants"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_created_at_idx" ON "ai_usage_logs"("feature", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_key_key" ON "tags"("key");

-- CreateIndex
CREATE INDEX "entity_tags_entity_type_entity_id_idx" ON "entity_tags"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "entity_tags_world_id_idx" ON "entity_tags"("world_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_tags_tag_id_entity_type_entity_id_key" ON "entity_tags"("tag_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "mail_inbox_messages_account_id_subject_idx" ON "mail_inbox_messages"("account_id", "subject");

-- CreateIndex
CREATE INDEX "mail_inbox_messages_account_id_from_address_idx" ON "mail_inbox_messages"("account_id", "from_address");

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_calendars" ADD CONSTRAINT "world_calendars_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "world_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_event_entity_links" ADD CONSTRAINT "world_event_entity_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "world_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_event_entity_links" ADD CONSTRAINT "world_event_entity_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_states" ADD CONSTRAINT "faction_states_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_states" ADD CONSTRAINT "faction_states_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_spells" ADD CONSTRAINT "character_spells_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_treasuries" ADD CONSTRAINT "party_treasuries_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_treasury_id_fkey" FOREIGN KEY ("treasury_id") REFERENCES "party_treasuries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_statblocks" ADD CONSTRAINT "structured_statblocks_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_statblocks" ADD CONSTRAINT "structured_statblocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "content_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_folders" ADD CONSTRAINT "mail_folders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_inbox_messages" ADD CONSTRAINT "mail_inbox_messages_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "mail_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_attachments" ADD CONSTRAINT "mail_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_priority_scores" ADD CONSTRAINT "mail_priority_scores_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_ai_actions" ADD CONSTRAINT "mail_ai_actions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_audit_log" ADD CONSTRAINT "mail_audit_log_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_paint_recipes" ADD CONSTRAINT "workshop_paint_recipes_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_print_profiles" ADD CONSTRAINT "workshop_print_profiles_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_terrain_rentals" ADD CONSTRAINT "workshop_terrain_rentals_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_brain_chunks" ADD CONSTRAINT "personal_brain_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "personal_brain_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miniature_collection_items" ADD CONSTRAINT "miniature_collection_items_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_target_world_id_fkey" FOREIGN KEY ("target_world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_maps" ADD CONSTRAINT "atlas_maps_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_nodes" ADD CONSTRAINT "atlas_nodes_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "atlas_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_nodes" ADD CONSTRAINT "atlas_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "atlas_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_nodes" ADD CONSTRAINT "atlas_nodes_parent_feature_id_fkey" FOREIGN KEY ("parent_feature_id") REFERENCES "atlas_features"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_nodes" ADD CONSTRAINT "atlas_nodes_background_asset_id_fkey" FOREIGN KEY ("background_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_nodes" ADD CONSTRAINT "atlas_nodes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_features" ADD CONSTRAINT "atlas_features_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_features" ADD CONSTRAINT "atlas_features_child_node_id_fkey" FOREIGN KEY ("child_node_id") REFERENCES "atlas_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_features" ADD CONSTRAINT "atlas_features_linked_page_id_fkey" FOREIGN KEY ("linked_page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_objects" ADD CONSTRAINT "atlas_objects_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_objects" ADD CONSTRAINT "atlas_objects_palette_item_id_fkey" FOREIGN KEY ("palette_item_id") REFERENCES "atlas_palette_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_objects" ADD CONSTRAINT "atlas_objects_linked_page_id_fkey" FOREIGN KEY ("linked_page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_palette_items" ADD CONSTRAINT "atlas_palette_items_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_palette_items" ADD CONSTRAINT "atlas_palette_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_user_grants" ADD CONSTRAINT "ai_user_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

