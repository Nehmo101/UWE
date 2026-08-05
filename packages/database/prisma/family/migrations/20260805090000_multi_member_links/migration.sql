-- Mehrere Mitglieder je Akten-Eintrag und je Kalender-Abo.
--
-- Vorher hing beides an genau einer Person (`member_id`). Termine konnten das
-- schon lange über `calendar_event_members`; Akte und Abo ziehen jetzt nach —
-- eine Impfung betrifft beide Katzen, ein Abo darf zwei Kinder zeigen.
--
-- Bestand wandert 1:1 in die Verknüpfungstabellen: jeder Eintrag behält sein
-- bisheriges Mitglied, jedes an eine Person gebundene Abo seine Person. Ein Abo
-- ohne `member_id` galt für den ganzen Haushalt und bekommt weiterhin keine
-- Verknüpfung — leer heißt nach wie vor „alle".

-- CreateTable
CREATE TABLE "family_health_record_members" (
    "record_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("record_id", "member_id"),
    CONSTRAINT "family_health_record_members_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "family_health_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "family_health_record_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "family_member_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "family_health_record_members_member_id_idx" ON "family_health_record_members"("member_id");

-- CreateTable
CREATE TABLE "family_calendar_subscription_members" (
    "subscription_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("subscription_id", "member_id"),
    CONSTRAINT "family_calendar_subscription_members_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "family_calendar_subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "family_calendar_subscription_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "family_member_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "family_calendar_subscription_members_member_id_idx" ON "family_calendar_subscription_members"("member_id");

-- Bestand übernehmen, bevor die Spalten fallen.
INSERT INTO "family_health_record_members" ("record_id", "member_id", "created_at")
SELECT "id", "member_id", "created_at" FROM "family_health_records";

INSERT INTO "family_calendar_subscription_members" ("subscription_id", "member_id", "created_at")
SELECT "id", "member_id", "created_at" FROM "family_calendar_subscriptions" WHERE "member_id" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_family_health_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "occurred_on" DATETIME,
    "next_due_on" DATETIME,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_family_health_records" ("created_at", "id", "kind", "metadata", "next_due_on", "notes", "occurred_on", "title", "updated_at") SELECT "created_at", "id", "kind", "metadata", "next_due_on", "notes", "occurred_on", "title", "updated_at" FROM "family_health_records";
DROP TABLE "family_health_records";
ALTER TABLE "new_family_health_records" RENAME TO "family_health_records";
CREATE INDEX "family_health_records_occurred_on_idx" ON "family_health_records"("occurred_on");
CREATE INDEX "family_health_records_next_due_on_idx" ON "family_health_records"("next_due_on");
CREATE TABLE "new_family_calendar_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_family_calendar_subscriptions" ("created_at", "id", "is_active", "label", "last_used_at", "revoked_at", "token_hash", "token_prefix", "updated_at") SELECT "created_at", "id", "is_active", "label", "last_used_at", "revoked_at", "token_hash", "token_prefix", "updated_at" FROM "family_calendar_subscriptions";
DROP TABLE "family_calendar_subscriptions";
ALTER TABLE "new_family_calendar_subscriptions" RENAME TO "family_calendar_subscriptions";
CREATE UNIQUE INDEX "family_calendar_subscriptions_token_hash_key" ON "family_calendar_subscriptions"("token_hash");
CREATE INDEX "family_calendar_subscriptions_is_active_idx" ON "family_calendar_subscriptions"("is_active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
