-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('lore', 'location', 'region', 'npc', 'faction', 'item', 'dungeon', 'dungeon_level', 'room', 'encounter', 'trap', 'puzzle', 'loot', 'secret', 'session', 'quest', 'handout', 'rule', 'player_character', 'monster', 'sound', 'map', 'note');

-- CreateEnum
CREATE TYPE "DungeonPrepStatus" AS ENUM ('unprepared', 'ready', 'played', 'skipped');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('private', 'dm_only', 'player_visible', 'public', 'specific_players', 'unlock_after_session', 'archived');

-- CreateEnum
CREATE TYPE "SecretLevel" AS ENUM ('none', 'spoiler', 'dm_secret');

-- CreateEnum
CREATE TYPE "RevealState" AS ENUM ('hidden', 'preview', 'revealed');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('draft', 'internal', 'published', 'archived');

-- CreateEnum
CREATE TYPE "CanonicalStatus" AS ENUM ('idea', 'draft', 'canon', 'deprecated', 'contradictory', 'non_canon');

-- CreateEnum
CREATE TYPE "ContentBlockType" AS ENUM ('rich_text', 'html', 'image', 'gallery', 'map', 'handout', 'sound', 'relation', 'timeline', 'statblock', 'gm_note', 'player_text', 'ai_summary');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('image', 'map', 'handout', 'document', 'audio', 'video', 'other');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'dm', 'player', 'readonly', 'guest');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "WorldMemberRole" AS ENUM ('owner', 'dm', 'player');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('planned', 'prepared', 'played', 'summarized', 'archived');

-- CreateEnum
CREATE TYPE "LabelSourceType" AS ENUM ('page', 'dungeon_room', 'content_block', 'asset', 'manual');

-- CreateEnum
CREATE TYPE "LabelPrintStatus" AS ENUM ('open', 'exported', 'printed', 'archived');

-- CreateEnum
CREATE TYPE "SoundSourceType" AS ENUM ('local', 'youtube', 'spotify');

-- CreateEnum
CREATE TYPE "PlayerNoteStatus" AS ENUM ('draft', 'visible_to_dm', 'accepted', 'hidden', 'deleted');

-- CreateEnum
CREATE TYPE "PlayerNoteVisibility" AS ENUM ('private', 'dm_only', 'party');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'applied', 'discarded');

-- CreateEnum
CREATE TYPE "AiProposalStatus" AS ENUM ('pending', 'applied', 'discarded', 'superseded');

-- CreateEnum
CREATE TYPE "AiApplyAction" AS ENUM ('apply', 'discard', 'partial_apply', 'edit_apply', 'rerun');

-- CreateEnum
CREATE TYPE "AiProposalApplyMode" AS ENUM ('idea', 'content_block', 'player_recap');

-- CreateEnum
CREATE TYPE "ShareTargetType" AS ENUM ('page', 'handout', 'asset');

-- CreateEnum
CREATE TYPE "BrainVisibility" AS ENUM ('dm_only', 'player_visible', 'public');

-- CreateEnum
CREATE TYPE "BrainSource" AS ENUM ('manual', 'ai_generated', 'import', 'session_summary');

-- CreateEnum
CREATE TYPE "BrainStatus" AS ENUM ('draft', 'reviewed', 'canonical', 'deprecated');

-- CreateEnum
CREATE TYPE "BrainDocumentType" AS ENUM ('world_knowledge', 'campaign_knowledge', 'session_summary', 'npc_facts', 'location_facts', 'faction_facts', 'canon_facts', 'general', 'ai_summary');

-- CreateEnum
CREATE TYPE "BrainFactType" AS ENUM ('npc', 'location', 'faction', 'canon', 'plot_thread', 'decision', 'custom');

-- CreateEnum
CREATE TYPE "BrainLinkSourceType" AS ENUM ('brain_document', 'brain_fact', 'brain_chunk');

-- CreateEnum
CREATE TYPE "BrainLinkTargetType" AS ENUM ('page', 'game_session', 'campaign', 'world', 'brain_document', 'brain_fact');

-- CreateEnum
CREATE TYPE "MailMessageStatus" AS ENUM ('draft', 'pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "MailTemplateKind" AS ENUM ('session_recap', 'handout', 'share_link', 'custom');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('mail_send', 'mail_sync', 'ai_run', 'embedding', 'reindex', 'import', 'backup', 'backup_restore', 'canon_check', 'image_studio', 'agent_job', 'calendar_sync', 'research');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('inbox', 'triaged', 'linked', 'archived');

-- CreateEnum
CREATE TYPE "CaptureType" AS ENUM ('quick_note', 'dnd_idea', 'uwe_todo', 'project_idea', 'hardware', 'contract_expense', 'art_miniature_terrain', 'link', 'file_image');

-- CreateEnum
CREATE TYPE "PersonalProjectStatus" AS ENUM ('idea', 'planned', 'active', 'blocked', 'paused', 'done', 'archived');

-- CreateEnum
CREATE TYPE "PersonalProjectCategory" AS ENUM ('uwe', 'hardware_homelab', 'dnd', 'art_workshop', 'printing_3d', 'other');

-- CreateEnum
CREATE TYPE "WorkshopProjectType" AS ENUM ('dnd_terrain', 'miniature', 'printing_3d', 'diorama', 'artwork', 'other');

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('idea', 'planned', 'material_missing', 'in_progress', 'paused', 'done', 'archived');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'cancelled', 'review', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ContractExpenseType" AS ENUM ('subscription', 'rent', 'insurance', 'utility', 'software', 'other');

-- CreateEnum
CREATE TYPE "ContractBillingInterval" AS ENUM ('monthly', 'yearly', 'once', 'other');

-- CreateEnum
CREATE TYPE "HardwareStatus" AS ENUM ('planned', 'active', 'offline', 'broken', 'retired', 'archived');

-- CreateEnum
CREATE TYPE "AdminLinkSourceType" AS ENUM ('capture', 'personal_project', 'workshop_project', 'contract_expense', 'hardware_device', 'personal_brain_document', 'personal_brain_fact');

-- CreateEnum
CREATE TYPE "AdminLinkTargetType" AS ENUM ('capture', 'personal_project', 'workshop_project', 'contract_expense', 'hardware_device', 'personal_brain_document', 'personal_brain_fact', 'world', 'page', 'asset');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('content_created', 'content_updated', 'content_deleted', 'content_restored', 'visibility_changed', 'inspector_fix_applied', 'template_created', 'template_updated', 'template_used', 'import_executed', 'export_executed', 'backup_created', 'backup_restored', 'seed_applied', 'ai_proposal_applied', 'ai_proposal_discarded', 'error', 'warning');

-- CreateEnum
CREATE TYPE "ActivityTargetType" AS ENUM ('page', 'content_block', 'asset', 'page_template', 'world', 'share_link', 'game_session', 'label', 'print_list', 'ai_proposal', 'ai_run', 'brain_document', 'system');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('login_success', 'login_failed', 'logout', 'setup_owner_created', 'user_created', 'user_disabled', 'user_enabled', 'password_reset', 'user_role_changed', 'password_changed', 'user_invited', 'content_created', 'content_updated', 'content_deleted', 'visibility_changed', 'secret_revealed', 'import_started', 'import_completed', 'import_failed', 'upload_created', 'upload_deleted', 'ai_request', 'backup_created', 'restore_started', 'restore_completed', 'authz_denied', 'rate_limit_hit', 'api_token_created', 'api_token_used', 'api_token_revoked', 'api_token_rotated', 'webhook_created', 'webhook_updated', 'webhook_deleted', 'webhook_delivered', 'webhook_failed', 'mfa_enabled', 'mfa_disabled', 'mfa_challenge_failed', 'security_warning_dismissed');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('user', 'session', 'page', 'content_block', 'asset', 'world', 'system', 'ai_run', 'backup', 'import', 'settings', 'api_token', 'webhook_endpoint', 'webhook_delivery', 'security_warning');

-- CreateEnum
CREATE TYPE "ApiTokenScopeName" AS ENUM ('health_read', 'worlds_read', 'export_read', 'webhooks_manage', 'ai_invoke', 'mail_read', 'mail_send', 'settings_read', 'settings_write', 'admin_read', 'admin_write', 'backup_read', 'backup_write');

-- CreateEnum
CREATE TYPE "SecurityWarningSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "MailDraftStatus" AS ENUM ('draft', 'pending_review', 'sent');

-- CreateEnum
CREATE TYPE "ImageStudioOperation" AS ENUM ('generate', 'edit', 'inpaint', 'remove_background', 'variant');

-- CreateEnum
CREATE TYPE "ImageStudioStatus" AS ENUM ('draft', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ImageStudioLinkTargetType" AS ENUM ('page', 'asset', 'label', 'game_session', 'handout', 'brain_document', 'capture');

-- CreateEnum
CREATE TYPE "CalendarEventKind" AS ENUM ('session', 'prep', 'personal', 'external', 'dnd');

-- CreateEnum
CREATE TYPE "CalendarFeedType" AS ENUM ('local', 'caldav', 'ical_url', 'familywall');

-- CreateEnum
CREATE TYPE "CalendarFeedDirection" AS ENUM ('read_only', 'read_write');

-- CreateEnum
CREATE TYPE "DevAgentJobStatus" AS ENUM ('pending', 'dispatched', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "DevAgentJobProvider" AS ENUM ('github_actions', 'cursor_cloud', 'cursor_cli_local');

-- CreateEnum
CREATE TYPE "DndApiProvider" AS ENUM ('open5e', 'dnd5e_srd');

-- CreateEnum
CREATE TYPE "InferenceProvider" AS ENUM ('ollama', 'openai_compatible', 'cloud');

-- CreateEnum
CREATE TYPE "ResearchSessionStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ResearchContextMode" AS ENUM ('dnd_brain', 'life_brain', 'open_web');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'player',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "force_password_change" BOOLEAN NOT NULL DEFAULT false,
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMP(3),
    "invite_token_hash" TEXT,
    "invite_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "role" "WorldMemberRole" NOT NULL,
    "character_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_player_access" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "page_player_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_unlocks" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_label" TEXT,

    CONSTRAINT "session_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worlds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "guest_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
    "guest_comments_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "parent_page_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PageType" NOT NULL,
    "summary" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "publish_status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "secret_level" "SecretLevel" NOT NULL DEFAULT 'none',
    "reveal_state" "RevealState" NOT NULL DEFAULT 'hidden',
    "canonical_status" "CanonicalStatus" NOT NULL DEFAULT 'draft',
    "prep_status" "DungeonPrepStatus",
    "tags" JSONB,
    "aliases" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "session_number" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "status" "GameSessionStatus" NOT NULL DEFAULT 'planned',
    "summary_dm" TEXT,
    "summary_player" TEXT,
    "notes" TEXT,
    "open_plots" TEXT,
    "player_decisions" TEXT,
    "recap_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_session_page_links" (
    "id" TEXT NOT NULL,
    "game_session_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_session_page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "asset_id" TEXT,
    "type" "ContentBlockType" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "secret_level" "SecretLevel" NOT NULL DEFAULT 'none',
    "reveal_state" "RevealState" NOT NULL DEFAULT 'hidden',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssetType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "secret_level" "SecretLevel" NOT NULL DEFAULT 'none',
    "reveal_state" "RevealState" NOT NULL DEFAULT 'hidden',
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_page_links" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_links" (
    "id" TEXT NOT NULL,
    "source_page_id" TEXT NOT NULL,
    "target_page_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label_templates" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "layout_settings" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "label_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "source_type" "LabelSourceType" NOT NULL,
    "source_id" TEXT,
    "template_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "layout_settings" JSONB NOT NULL,
    "print_status" "LabelPrintStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_lists" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "LabelPrintStatus" NOT NULL DEFAULT 'open',
    "for_next_session" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_list_items" (
    "id" TEXT NOT NULL,
    "print_list_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "print_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soundboard_buttons" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "source_type" "SoundSourceType" NOT NULL,
    "source_url" TEXT,
    "asset_id" TEXT,
    "thumbnail" TEXT,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "loop" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "visibility" "Visibility" NOT NULL DEFAULT 'dm_only',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "soundboard_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soundboard_button_page_links" (
    "id" TEXT NOT NULL,
    "soundboard_button_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soundboard_button_page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_notes" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "page_id" TEXT,
    "game_session_id" TEXT,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "PlayerNoteVisibility" NOT NULL DEFAULT 'private',
    "status" "PlayerNoteStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "target_type" "ShareTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "password_hash" TEXT,
    "read_only" BOOLEAN NOT NULL DEFAULT true,
    "log_access" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_access_logs" (
    "id" TEXT NOT NULL,
    "share_link_id" TEXT NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "share_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spotify_connections" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "spotify_user_id" TEXT NOT NULL,
    "spotify_display_name" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spotify_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "settings" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "world_slug" TEXT,
    "action" "ActivityAction" NOT NULL,
    "target_type" "ActivityTargetType" NOT NULL,
    "target_id" TEXT,
    "target_label" TEXT,
    "target_href" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "undo_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "target_type" "AuditTargetType" NOT NULL,
    "target_id" TEXT,
    "world_id" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "metadata_json" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "undo_entries" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "operation" TEXT NOT NULL,
    "target_type" "ActivityTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "undone_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "undo_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "page_type" "PageType" NOT NULL,
    "default_visibility" "Visibility" NOT NULL DEFAULT 'dm_only',
    "title_placeholder" TEXT NOT NULL DEFAULT '',
    "blocks" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seed_history" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "seed_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "page_id" TEXT,
    "game_session_id" TEXT,
    "user_id" TEXT,
    "source" TEXT,
    "task_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'pending',
    "system_prompt" TEXT,
    "user_prompt" TEXT,
    "context_data" JSONB,
    "result_text" TEXT,
    "result_meta" JSONB,
    "error_message" TEXT,
    "error_details" JSONB,
    "duration_ms" INTEGER,
    "target_type" TEXT,
    "target_id" TEXT,
    "proposals" JSONB,
    "applied_at" TIMESTAMP(3),
    "discarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_proposals" (
    "id" TEXT NOT NULL,
    "ai_run_id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "status" "AiProposalStatus" NOT NULL DEFAULT 'pending',
    "suggested_mode" "AiProposalApplyMode" NOT NULL,
    "patch" JSONB NOT NULL,
    "result_text" TEXT NOT NULL,
    "edited_text" TEXT,
    "source_page_id" TEXT,
    "session_id" TEXT,
    "applied_target_type" "ActivityTargetType",
    "applied_target_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "discarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_apply_logs" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "ai_run_id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "action" "AiApplyAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "undo_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_apply_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_documents" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "game_session_id" TEXT,
    "page_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "document_type" "BrainDocumentType" NOT NULL DEFAULT 'general',
    "visibility" "BrainVisibility" NOT NULL DEFAULT 'dm_only',
    "source" "BrainSource" NOT NULL DEFAULT 'manual',
    "status" "BrainStatus" NOT NULL DEFAULT 'draft',
    "trust_level" DOUBLE PRECISION,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brain_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brain_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_facts" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "game_session_id" TEXT,
    "page_id" TEXT,
    "fact_type" "BrainFactType" NOT NULL DEFAULT 'custom',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "visibility" "BrainVisibility" NOT NULL DEFAULT 'dm_only',
    "source" "BrainSource" NOT NULL DEFAULT 'manual',
    "status" "BrainStatus" NOT NULL DEFAULT 'draft',
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brain_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_links" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "source_type" "BrainLinkSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_type" "BrainLinkTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL DEFAULT 'related',
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "world_id" TEXT,
    "world_slug" TEXT,
    "user_id" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "error_message" TEXT,
    "error_details" JSONB,
    "progress" INTEGER,
    "progress_label" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "related_type" TEXT,
    "related_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_templates" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "kind" "MailTemplateKind" NOT NULL DEFAULT 'custom',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL DEFAULT '',
    "body_text" TEXT NOT NULL DEFAULT '',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_recipient_groups" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_recipient_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_recipients" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_message_logs" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "status" "MailMessageStatus" NOT NULL DEFAULT 'pending',
    "subject" TEXT NOT NULL,
    "to_addresses" JSONB NOT NULL,
    "from_address" TEXT NOT NULL,
    "template_id" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "error_message" TEXT,
    "body_logged" BOOLEAN NOT NULL DEFAULT false,
    "body_preview" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_accounts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER,
    "username" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT,
    "last_imap_sync_at" TIMESTAMP(3),
    "imap_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_inbox_messages" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "imap_uid" TEXT NOT NULL,
    "message_id" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "from_address" TEXT NOT NULL,
    "to_addresses" JSONB,
    "snippet" TEXT,
    "body_text" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_drafts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT,
    "world_id" TEXT,
    "subject" TEXT NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "status" "MailDraftStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "capture_type" "CaptureType" NOT NULL DEFAULT 'quick_note',
    "status" "CaptureStatus" NOT NULL DEFAULT 'inbox',
    "url" TEXT,
    "storage_key" TEXT,
    "world_id" TEXT,
    "page_id" TEXT,
    "metadata" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triaged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "PersonalProjectStatus" NOT NULL DEFAULT 'idea',
    "category" "PersonalProjectCategory" NOT NULL DEFAULT 'other',
    "next_action" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "links" JSONB,
    "cost_cents" INTEGER,
    "world_id" TEXT,
    "page_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "project_type" "WorkshopProjectType" NOT NULL,
    "status" "WorkshopStatus" NOT NULL DEFAULT 'idea',
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_expenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "expense_type" "ContractExpenseType" NOT NULL DEFAULT 'other',
    "billing_interval" "ContractBillingInterval" NOT NULL DEFAULT 'monthly',
    "category_label" TEXT NOT NULL DEFAULT '',
    "amount_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billing_day" INTEGER,
    "start_date" TIMESTAMP(3),
    "next_payment_date" TIMESTAMP(3),
    "renewal_date" TIMESTAMP(3),
    "cancel_by_date" TIMESTAMP(3),
    "portal_url" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "status" "HardwareStatus" NOT NULL DEFAULT 'planned',
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_brain_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_brain_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_brain_facts" (
    "id" TEXT NOT NULL,
    "fact_type" TEXT NOT NULL DEFAULT 'custom',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_brain_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_entity_links" (
    "id" TEXT NOT NULL,
    "source_type" "AdminLinkSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_type" "AdminLinkTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL DEFAULT 'related',
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generator_presets" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "target_type" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generator_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generator_outputs" (
    "id" TEXT NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generator_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_studio_projects" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "status" "ImageStudioStatus" NOT NULL DEFAULT 'draft',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_studio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_studio_versions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "operation" "ImageStudioOperation" NOT NULL,
    "prompt" TEXT,
    "asset_id" TEXT,
    "parent_version_id" TEXT,
    "provider_mode" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_studio_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_studio_links" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "target_type" "ImageStudioLinkTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_studio_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_feeds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CalendarFeedType" NOT NULL,
    "direction" "CalendarFeedDirection" NOT NULL DEFAULT 'read_only',
    "url" TEXT,
    "caldav_url" TEXT,
    "username" TEXT,
    "credentials_enc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "sync_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT,
    "world_id" TEXT,
    "session_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "kind" "CalendarEventKind" NOT NULL DEFAULT 'personal',
    "external_uid" TEXT,
    "remote_href" TEXT,
    "remote_etag" TEXT,
    "caldav_pending" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_agent_jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "DevAgentJobStatus" NOT NULL DEFAULT 'pending',
    "provider" "DevAgentJobProvider" NOT NULL DEFAULT 'github_actions',
    "branch_name" TEXT,
    "pr_url" TEXT,
    "issue_url" TEXT,
    "github_run_id" TEXT,
    "cursor_job_id" TEXT,
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "dev_agent_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dnd_beyond_references" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "entity_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dnd_beyond_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dnd_api_cache_entries" (
    "id" TEXT NOT NULL,
    "provider" "DndApiProvider" NOT NULL,
    "cache_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dnd_api_cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "rotated_from_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_token_scopes" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "scope" "ApiTokenScopeName" NOT NULL,

    CONSTRAINT "api_token_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_token_usage_logs" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_token_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "secret_prefix" TEXT NOT NULL,
    "events_json" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status_code" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "payload_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_warnings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "SecurityWarningSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by_id" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_secrets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "backup_codes_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "challenge_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inference_endpoints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "api_key_enc" TEXT,
    "provider" "InferenceProvider" NOT NULL DEFAULT 'ollama',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_probe_at" TIMESTAMP(3),
    "probe_status" TEXT,
    "cached_models" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inference_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_versions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_sessions" (
    "id" TEXT NOT NULL,
    "world_id" TEXT,
    "query" TEXT NOT NULL,
    "status" "ResearchSessionStatus" NOT NULL DEFAULT 'pending',
    "context_mode" "ResearchContextMode" NOT NULL DEFAULT 'dnd_brain',
    "report_md" TEXT,
    "owner_id" TEXT,
    "ai_run_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_sources" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "fetched_at" TIMESTAMP(3),

    CONSTRAINT "research_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_user_id_key" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "world_memberships_user_id_world_id_key" ON "world_memberships"("user_id", "world_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_player_access_page_id_user_id_key" ON "page_player_access"("page_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_unlocks_page_id_user_id_key" ON "session_unlocks"("page_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "worlds_slug_key" ON "worlds"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_world_id_slug_key" ON "campaigns"("world_id", "slug");

-- CreateIndex
CREATE INDEX "pages_parent_page_id_idx" ON "pages"("parent_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_world_id_slug_key" ON "pages"("world_id", "slug");

-- CreateIndex
CREATE INDEX "game_sessions_world_id_session_number_idx" ON "game_sessions"("world_id", "session_number");

-- CreateIndex
CREATE UNIQUE INDEX "game_session_page_links_game_session_id_page_id_key" ON "game_session_page_links"("game_session_id", "page_id");

-- CreateIndex
CREATE INDEX "content_blocks_page_id_sort_order_idx" ON "content_blocks"("page_id", "sort_order");

-- CreateIndex
CREATE INDEX "content_blocks_asset_id_idx" ON "content_blocks"("asset_id");

-- CreateIndex
CREATE INDEX "assets_world_id_type_idx" ON "assets"("world_id", "type");

-- CreateIndex
CREATE INDEX "asset_page_links_page_id_idx" ON "asset_page_links"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_page_links_asset_id_page_id_key" ON "asset_page_links"("asset_id", "page_id");

-- CreateIndex
CREATE INDEX "page_links_source_page_id_idx" ON "page_links"("source_page_id");

-- CreateIndex
CREATE INDEX "page_links_target_page_id_idx" ON "page_links"("target_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "label_templates_world_id_slug_key" ON "label_templates"("world_id", "slug");

-- CreateIndex
CREATE INDEX "labels_world_id_updated_at_idx" ON "labels"("world_id", "updated_at");

-- CreateIndex
CREATE INDEX "labels_source_type_source_id_idx" ON "labels"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "print_lists_world_id_updated_at_idx" ON "print_lists"("world_id", "updated_at");

-- CreateIndex
CREATE INDEX "print_list_items_print_list_id_sort_order_idx" ON "print_list_items"("print_list_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "print_list_items_print_list_id_label_id_key" ON "print_list_items"("print_list_id", "label_id");

-- CreateIndex
CREATE INDEX "soundboard_buttons_world_id_campaign_id_idx" ON "soundboard_buttons"("world_id", "campaign_id");

-- CreateIndex
CREATE INDEX "soundboard_buttons_asset_id_idx" ON "soundboard_buttons"("asset_id");

-- CreateIndex
CREATE INDEX "soundboard_button_page_links_page_id_idx" ON "soundboard_button_page_links"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "soundboard_button_page_links_soundboard_button_id_page_id_key" ON "soundboard_button_page_links"("soundboard_button_id", "page_id");

-- CreateIndex
CREATE INDEX "player_notes_world_id_status_idx" ON "player_notes"("world_id", "status");

-- CreateIndex
CREATE INDEX "player_notes_world_id_campaign_id_idx" ON "player_notes"("world_id", "campaign_id");

-- CreateIndex
CREATE INDEX "player_notes_user_id_world_id_idx" ON "player_notes"("user_id", "world_id");

-- CreateIndex
CREATE INDEX "player_notes_page_id_idx" ON "player_notes"("page_id");

-- CreateIndex
CREATE INDEX "player_notes_game_session_id_idx" ON "player_notes"("game_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_world_id_idx" ON "share_links"("world_id");

-- CreateIndex
CREATE INDEX "share_links_target_type_target_id_idx" ON "share_links"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "share_access_logs_share_link_id_accessed_at_idx" ON "share_access_logs"("share_link_id", "accessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "spotify_connections_world_id_key" ON "spotify_connections"("world_id");

-- CreateIndex
CREATE INDEX "activity_logs_world_id_created_at_idx" ON "activity_logs"("world_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_undo_entry_id_idx" ON "activity_logs"("undo_entry_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_timestamp_idx" ON "audit_logs"("actor_user_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_world_id_timestamp_idx" ON "audit_logs"("world_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "undo_entries_world_id_created_at_idx" ON "undo_entries"("world_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "page_templates_slug_key" ON "page_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "seed_history_key_key" ON "seed_history"("key");

-- CreateIndex
CREATE INDEX "ai_runs_world_id_created_at_idx" ON "ai_runs"("world_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_runs_status_created_at_idx" ON "ai_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_runs_page_id_idx" ON "ai_runs"("page_id");

-- CreateIndex
CREATE INDEX "ai_proposals_ai_run_id_idx" ON "ai_proposals"("ai_run_id");

-- CreateIndex
CREATE INDEX "ai_proposals_world_id_status_idx" ON "ai_proposals"("world_id", "status");

-- CreateIndex
CREATE INDEX "ai_apply_logs_proposal_id_created_at_idx" ON "ai_apply_logs"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_apply_logs_ai_run_id_idx" ON "ai_apply_logs"("ai_run_id");

-- CreateIndex
CREATE INDEX "ai_apply_logs_world_id_created_at_idx" ON "ai_apply_logs"("world_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_apply_logs_undo_entry_id_idx" ON "ai_apply_logs"("undo_entry_id");

-- CreateIndex
CREATE INDEX "brain_documents_world_id_status_idx" ON "brain_documents"("world_id", "status");

-- CreateIndex
CREATE INDEX "brain_documents_world_id_visibility_idx" ON "brain_documents"("world_id", "visibility");

-- CreateIndex
CREATE INDEX "brain_documents_world_id_document_type_idx" ON "brain_documents"("world_id", "document_type");

-- CreateIndex
CREATE INDEX "brain_documents_page_id_idx" ON "brain_documents"("page_id");

-- CreateIndex
CREATE INDEX "brain_documents_game_session_id_idx" ON "brain_documents"("game_session_id");

-- CreateIndex
CREATE INDEX "brain_chunks_document_id_idx" ON "brain_chunks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "brain_chunks_document_id_chunk_index_key" ON "brain_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE INDEX "brain_facts_world_id_status_idx" ON "brain_facts"("world_id", "status");

-- CreateIndex
CREATE INDEX "brain_facts_world_id_visibility_idx" ON "brain_facts"("world_id", "visibility");

-- CreateIndex
CREATE INDEX "brain_facts_world_id_fact_type_idx" ON "brain_facts"("world_id", "fact_type");

-- CreateIndex
CREATE INDEX "brain_facts_page_id_idx" ON "brain_facts"("page_id");

-- CreateIndex
CREATE INDEX "brain_facts_game_session_id_idx" ON "brain_facts"("game_session_id");

-- CreateIndex
CREATE INDEX "brain_links_world_id_idx" ON "brain_links"("world_id");

-- CreateIndex
CREATE INDEX "brain_links_source_type_source_id_idx" ON "brain_links"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "brain_links_target_type_target_id_idx" ON "brain_links"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "jobs_status_created_at_idx" ON "jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "jobs_type_created_at_idx" ON "jobs"("type", "created_at");

-- CreateIndex
CREATE INDEX "jobs_world_id_created_at_idx" ON "jobs"("world_id", "created_at");

-- CreateIndex
CREATE INDEX "job_logs_job_id_created_at_idx" ON "job_logs"("job_id", "created_at");

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
CREATE INDEX "mail_inbox_messages_account_id_received_at_idx" ON "mail_inbox_messages"("account_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "mail_inbox_messages_account_id_imap_uid_key" ON "mail_inbox_messages"("account_id", "imap_uid");

-- CreateIndex
CREATE INDEX "mail_drafts_status_created_at_idx" ON "mail_drafts"("status", "created_at");

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
CREATE INDEX "contract_expenses_next_payment_date_idx" ON "contract_expenses"("next_payment_date");

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

-- CreateIndex
CREATE INDEX "image_studio_projects_world_id_status_idx" ON "image_studio_projects"("world_id", "status");

-- CreateIndex
CREATE INDEX "image_studio_versions_project_id_version_number_idx" ON "image_studio_versions"("project_id", "version_number");

-- CreateIndex
CREATE INDEX "image_studio_links_target_type_target_id_idx" ON "image_studio_links"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "image_studio_links_project_id_target_type_target_id_key" ON "image_studio_links"("project_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");

-- CreateIndex
CREATE INDEX "calendar_events_world_id_start_at_idx" ON "calendar_events"("world_id", "start_at");

-- CreateIndex
CREATE INDEX "calendar_events_feed_id_external_uid_idx" ON "calendar_events"("feed_id", "external_uid");

-- CreateIndex
CREATE INDEX "dev_agent_jobs_status_created_at_idx" ON "dev_agent_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "dnd_beyond_references_world_id_idx" ON "dnd_beyond_references"("world_id");

-- CreateIndex
CREATE INDEX "dnd_api_cache_entries_expires_at_idx" ON "dnd_api_cache_entries"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "dnd_api_cache_entries_provider_cache_key_key" ON "dnd_api_cache_entries"("provider", "cache_key");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_is_active_idx" ON "api_tokens"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "api_tokens_token_prefix_idx" ON "api_tokens"("token_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "api_token_scopes_token_id_scope_key" ON "api_token_scopes"("token_id", "scope");

-- CreateIndex
CREATE INDEX "api_token_usage_logs_token_id_created_at_idx" ON "api_token_usage_logs"("token_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_endpoints_is_active_idx" ON "webhook_endpoints"("is_active");

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpoint_id_created_at_idx" ON "webhook_deliveries"("endpoint_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "security_warnings_code_key" ON "security_warnings"("code");

-- CreateIndex
CREATE INDEX "security_warnings_severity_dismissed_at_idx" ON "security_warnings"("severity", "dismissed_at");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_secrets_user_id_key" ON "two_factor_secrets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_challenges_challenge_token_hash_key" ON "two_factor_challenges"("challenge_token_hash");

-- CreateIndex
CREATE INDEX "two_factor_challenges_user_id_expires_at_idx" ON "two_factor_challenges"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "inference_endpoints_is_enabled_idx" ON "inference_endpoints"("is_enabled");

-- CreateIndex
CREATE INDEX "page_versions_page_id_created_at_idx" ON "page_versions"("page_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "page_versions_page_id_version_key" ON "page_versions"("page_id", "version");

-- CreateIndex
CREATE INDEX "research_sessions_status_created_at_idx" ON "research_sessions"("status", "created_at");

-- CreateIndex
CREATE INDEX "research_sessions_world_id_created_at_idx" ON "research_sessions"("world_id", "created_at");

-- CreateIndex
CREATE INDEX "research_sources_session_id_idx" ON "research_sources"("session_id");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_memberships" ADD CONSTRAINT "world_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_memberships" ADD CONSTRAINT "world_memberships_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_player_access" ADD CONSTRAINT "page_player_access_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_player_access" ADD CONSTRAINT "page_player_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_unlocks" ADD CONSTRAINT "session_unlocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_unlocks" ADD CONSTRAINT "session_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_page_id_fkey" FOREIGN KEY ("parent_page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_session_page_links" ADD CONSTRAINT "game_session_page_links_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_session_page_links" ADD CONSTRAINT "game_session_page_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_page_links" ADD CONSTRAINT "asset_page_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_page_links" ADD CONSTRAINT "asset_page_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_page_id_fkey" FOREIGN KEY ("source_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "label_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_lists" ADD CONSTRAINT "print_lists_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_lists" ADD CONSTRAINT "print_lists_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_list_items" ADD CONSTRAINT "print_list_items_print_list_id_fkey" FOREIGN KEY ("print_list_id") REFERENCES "print_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_list_items" ADD CONSTRAINT "print_list_items_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soundboard_buttons" ADD CONSTRAINT "soundboard_buttons_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soundboard_buttons" ADD CONSTRAINT "soundboard_buttons_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soundboard_buttons" ADD CONSTRAINT "soundboard_buttons_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soundboard_button_page_links" ADD CONSTRAINT "soundboard_button_page_links_soundboard_button_id_fkey" FOREIGN KEY ("soundboard_button_id") REFERENCES "soundboard_buttons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soundboard_button_page_links" ADD CONSTRAINT "soundboard_button_page_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notes" ADD CONSTRAINT "player_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_access_logs" ADD CONSTRAINT "share_access_logs_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spotify_connections" ADD CONSTRAINT "spotify_connections_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_undo_entry_id_fkey" FOREIGN KEY ("undo_entry_id") REFERENCES "undo_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_ai_run_id_fkey" FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_apply_logs" ADD CONSTRAINT "ai_apply_logs_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "ai_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_apply_logs" ADD CONSTRAINT "ai_apply_logs_undo_entry_id_fkey" FOREIGN KEY ("undo_entry_id") REFERENCES "undo_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_documents" ADD CONSTRAINT "brain_documents_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_documents" ADD CONSTRAINT "brain_documents_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_documents" ADD CONSTRAINT "brain_documents_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_documents" ADD CONSTRAINT "brain_documents_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_chunks" ADD CONSTRAINT "brain_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "brain_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_facts" ADD CONSTRAINT "brain_facts_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_facts" ADD CONSTRAINT "brain_facts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_facts" ADD CONSTRAINT "brain_facts_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_facts" ADD CONSTRAINT "brain_facts_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_links" ADD CONSTRAINT "brain_links_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_templates" ADD CONSTRAINT "mail_templates_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_recipient_groups" ADD CONSTRAINT "mail_recipient_groups_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_recipients" ADD CONSTRAINT "mail_recipients_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "mail_recipient_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_recipients" ADD CONSTRAINT "mail_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_message_logs" ADD CONSTRAINT "mail_message_logs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_inbox_messages" ADD CONSTRAINT "mail_inbox_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_drafts" ADD CONSTRAINT "mail_drafts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_drafts" ADD CONSTRAINT "mail_drafts_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_entries" ADD CONSTRAINT "capture_entries_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_entries" ADD CONSTRAINT "capture_entries_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_projects" ADD CONSTRAINT "personal_projects_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_projects" ADD CONSTRAINT "personal_projects_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_projects" ADD CONSTRAINT "workshop_projects_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_projects" ADD CONSTRAINT "workshop_projects_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_presets" ADD CONSTRAINT "generator_presets_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_outputs" ADD CONSTRAINT "generator_outputs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_outputs" ADD CONSTRAINT "generator_outputs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_outputs" ADD CONSTRAINT "generator_outputs_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "generator_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_studio_projects" ADD CONSTRAINT "image_studio_projects_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_studio_versions" ADD CONSTRAINT "image_studio_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "image_studio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_studio_versions" ADD CONSTRAINT "image_studio_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_studio_links" ADD CONSTRAINT "image_studio_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "image_studio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "calendar_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dnd_beyond_references" ADD CONSTRAINT "dnd_beyond_references_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dnd_beyond_references" ADD CONSTRAINT "dnd_beyond_references_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token_scopes" ADD CONSTRAINT "api_token_scopes_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "api_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token_usage_logs" ADD CONSTRAINT "api_token_usage_logs_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "api_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_secrets" ADD CONSTRAINT "two_factor_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_sessions" ADD CONSTRAINT "research_sessions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "research_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
