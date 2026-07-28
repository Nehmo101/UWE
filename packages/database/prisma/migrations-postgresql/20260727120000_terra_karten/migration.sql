-- Terra-Ablage (J1) — Postgres-Zweig, gleichzeitig mit dem SQLite-Zweig
-- angelegt. Der Postgres-Ordner hinkt bei Atlas hinterher (siehe
-- docs/engineering/terra-runde-j-atlas-abbau.md, Vorabbefund 2); bei Terra
-- soll diese Drift gar nicht erst entstehen.

-- CreateTable
CREATE TABLE "terra_karten" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "titel" TEXT NOT NULL DEFAULT 'Karte',
    "daten" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terra_karten_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terra_karten_world_id_idx" ON "terra_karten"("world_id");

-- AddForeignKey
ALTER TABLE "terra_karten" ADD CONSTRAINT "terra_karten_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
