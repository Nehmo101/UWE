-- Access model: four checkboxes per e-mail address.
--
-- Notiz Lasse: Konten legt nur der Owner an, und pro Adresse entscheiden vier
-- Häkchen, welche App sie betreten darf — Portal, Studio, Brain, Family.
-- Die Rollen-Enums, die Welt-Rollen und der Gastmodus entfallen dabei.

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

-- WorldMembership is a pure assignment now: person X belongs to world Y.
ALTER TABLE "world_memberships" DROP COLUMN "role";

-- Guest mode: without a checkbox nobody gets in, so there is no anonymous
-- audience left to enable per world.
ALTER TABLE "worlds" DROP COLUMN "guest_mode_enabled";
ALTER TABLE "worlds" DROP COLUMN "guest_comments_enabled";

-- The audit log gains a matching action name. Historical rows are rewritten so
-- they still parse against the enum.
UPDATE "audit_logs" SET "action" = 'user_access_changed' WHERE "action" = 'user_role_changed';
