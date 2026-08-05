-- Access model: four checkboxes per e-mail address — Postgres-Zweig.
--
-- Spiegel von migrations/20260727050000_access_checkboxes; die Begruendung
-- steht dort. Dieser Zweig fehlte bisher: die Spalten "is_owner",
-- "portal_access", "studio_access", "brain_access", "family_access" wurden in
-- PostgreSQL nie angelegt, wodurch 20260729140000_user_ai_access mit
-- P3018 / 42703 ("studio_access does not exist") abbrach (CI: postgres-smoke).

ALTER TABLE "users" ADD COLUMN "is_owner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "portal_access" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "studio_access" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "brain_access" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "family_access" BOOLEAN NOT NULL DEFAULT false;

-- Translate the old role into checkboxes so nobody is locked out by the migration.
--   owner  → everything, plus the owner marker (operations, restore, Command Center)
--   admin  → Studio (system administration lived there) and Portal
--   dm     → Studio and Portal
--   player → Portal
--   readonly, guest → nothing; they need a checkbox from the owner
UPDATE "users" SET "is_owner" = true WHERE "role" = 'owner';
UPDATE "users"
   SET "portal_access" = true, "studio_access" = true,
       "brain_access" = true, "family_access" = true
 WHERE "role" = 'owner';
UPDATE "users" SET "portal_access" = true, "studio_access" = true
 WHERE "role" IN ('admin', 'dm');
UPDATE "users" SET "portal_access" = true WHERE "role" = 'player';

ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "UserRole";

-- WorldMembership is a pure assignment now: person X belongs to world Y.
ALTER TABLE "world_memberships" DROP COLUMN "role";
DROP TYPE "WorldMemberRole";

-- Guest mode: without a checkbox nobody gets in, so there is no anonymous
-- audience left to enable per world.
ALTER TABLE "worlds" DROP COLUMN "guest_mode_enabled";
ALTER TABLE "worlds" DROP COLUMN "guest_comments_enabled";

-- The audit log gains a matching action name; historical rows are rewritten.
-- PostgreSQL laesst einen per ADD VALUE ergaenzten Enum-Wert nicht in
-- derselben Transaktion verwenden, deshalb wird der Typ neu aufgebaut und die
-- Historie beim Spaltenumbau umgeschrieben. 'visibility_changed' bleibt als
-- Altwert bestehen (historische Zeilen behalten ihn, wie im SQLite-Zweig).
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
CREATE TYPE "AuditAction" AS ENUM (
  'login_success', 'login_failed', 'logout', 'setup_owner_created',
  'user_created', 'user_disabled', 'user_deleted', 'user_enabled',
  'password_reset', 'user_access_changed', 'password_changed', 'user_invited',
  'content_created', 'content_updated', 'content_deleted',
  'visibility_changed', 'secret_revealed',
  'import_started', 'import_completed', 'import_failed',
  'upload_created', 'upload_deleted', 'ai_request',
  'backup_created', 'restore_started', 'restore_completed',
  'authz_denied', 'rate_limit_hit',
  'api_token_created', 'api_token_used', 'api_token_revoked', 'api_token_rotated',
  'webhook_created', 'webhook_updated', 'webhook_deleted',
  'webhook_delivered', 'webhook_failed',
  'mfa_enabled', 'mfa_disabled', 'mfa_challenge_failed',
  'security_warning_dismissed',
  'host_update_started', 'host_update_completed', 'host_update_failed',
  'host_restart_started', 'secret_status_viewed'
);
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "AuditAction"
  USING (
    CASE WHEN "action"::text = 'user_role_changed'
         THEN 'user_access_changed'
         ELSE "action"::text
    END
  )::"AuditAction";
DROP TYPE "AuditAction_old";
