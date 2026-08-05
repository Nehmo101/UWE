-- Spielerfragen: `campaign_id` war ein loses TEXT-Feld ohne Fremdschluessel.
-- Beim Loeschen einer Kampagne blieben Waisen-Kennungen stehen, die nirgends
-- mehr hinzeigten. Jetzt haengt die Spalte als echte FK mit SET NULL am
-- campaigns-Eintrag — die Frage ueberlebt die Kampagne, verliert aber sauber
-- ihren Bezug.
--
-- Vorab werden Bestands-Waisen auf NULL gesetzt, sonst scheitert der Umbau an
-- der neuen Constraint. SQLite kann einer bestehenden Spalte keine FK anhaengen,
-- daher Tabellenumbau (RedefineTables-Muster).
-- Gegenstueck: migrations-postgresql/20260805190000_player_question_campaign_fk.

-- UpdateData: Waisen bereinigen
UPDATE "player_questions"
SET "campaign_id" = NULL
WHERE "campaign_id" IS NOT NULL
  AND "campaign_id" NOT IN (SELECT "id" FROM "campaigns");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_player_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "author_user_id" TEXT,
    "author_name" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" DATETIME,
    CONSTRAINT "player_questions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_questions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_player_questions" ("id", "world_id", "campaign_id", "author_user_id", "author_name", "question", "answer", "status", "created_at", "answered_at")
SELECT "id", "world_id", "campaign_id", "author_user_id", "author_name", "question", "answer", "status", "created_at", "answered_at" FROM "player_questions";
DROP TABLE "player_questions";
ALTER TABLE "new_player_questions" RENAME TO "player_questions";
CREATE INDEX "player_questions_world_id_status_idx" ON "player_questions"("world_id", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
