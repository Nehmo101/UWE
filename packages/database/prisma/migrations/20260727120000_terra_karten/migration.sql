-- Terra-Ablage (J1): eine Zeile je Karte, der komplette Kartenbaum als JSON.
-- Terra loest Atlas 3D unter denselben Pfaden ab (Owner-Entscheid 27.07.2026).
-- Reine Foundation: nur CREATE TABLE + CREATE INDEX, keine Datenmigration.
-- Alte Atlas-Welten werden ausdruecklich VERWORFEN, nicht uebernommen.

-- CreateTable
CREATE TABLE "terra_karten" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "titel" TEXT NOT NULL DEFAULT 'Karte',
    "daten" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "terra_karten_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "terra_karten_world_id_idx" ON "terra_karten"("world_id");
