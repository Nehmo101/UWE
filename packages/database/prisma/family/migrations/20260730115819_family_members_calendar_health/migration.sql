/*
  Warnings:

  - The primary key for the `family_member_profiles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `id` was added to the `family_member_profiles` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateTable
CREATE TABLE "calendar_event_members" (
    "event_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("event_id", "member_id"),
    CONSTRAINT "calendar_event_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "calendar_event_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "family_member_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "family_health_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "member_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "occurred_on" DATETIME,
    "next_due_on" DATETIME,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "family_health_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "family_member_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "family_calendar_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "member_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" DATETIME,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "family_calendar_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "family_member_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_family_member_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "display_name" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'adult',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    "birthday_on" DATETIME,
    "anniversary_on" DATETIME,
    "anniversary_label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
-- Bestandszeilen erhalten: der alte Primaerschluessel `user_id` wird als `id`
-- uebernommen. Er ist garantiert eindeutig und nicht leer (er war der PK), die
-- Zeilen behalten damit eine stabile Identitaet. `user_id` bleibt zusaetzlich
-- gesetzt, sodass die Konto-Verknuepfung bestehender Mitglieder erhalten bleibt.
INSERT INTO "new_family_member_profiles" ("id", "colour", "created_at", "display_name", "note", "updated_at", "user_id") SELECT "user_id", "colour", "created_at", "display_name", "note", "updated_at", "user_id" FROM "family_member_profiles";
DROP TABLE "family_member_profiles";
ALTER TABLE "new_family_member_profiles" RENAME TO "family_member_profiles";
CREATE UNIQUE INDEX "family_member_profiles_user_id_key" ON "family_member_profiles"("user_id");
CREATE INDEX "family_member_profiles_is_active_sort_index_idx" ON "family_member_profiles"("is_active", "sort_index");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "calendar_event_members_member_id_idx" ON "calendar_event_members"("member_id");

-- CreateIndex
CREATE INDEX "family_health_records_member_id_occurred_on_idx" ON "family_health_records"("member_id", "occurred_on");

-- CreateIndex
CREATE INDEX "family_health_records_next_due_on_idx" ON "family_health_records"("next_due_on");

-- CreateIndex
CREATE UNIQUE INDEX "family_calendar_subscriptions_token_hash_key" ON "family_calendar_subscriptions"("token_hash");

-- CreateIndex
CREATE INDEX "family_calendar_subscriptions_is_active_idx" ON "family_calendar_subscriptions"("is_active");
