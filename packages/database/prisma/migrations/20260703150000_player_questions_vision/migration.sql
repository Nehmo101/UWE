-- ConnectorJobType.vision_extract: SQLite speichert Enums als TEXT (kein DDL nötig).

-- CreateTable
CREATE TABLE "player_questions" (
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
    CONSTRAINT "player_questions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "player_questions_world_id_status_idx" ON "player_questions"("world_id", "status");
