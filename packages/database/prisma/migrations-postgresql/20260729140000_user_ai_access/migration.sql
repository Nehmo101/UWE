-- Wer darf die RTX-KI benutzen (G-KI) — Postgres-Zweig, gleichzeitig mit dem
-- SQLite-Zweig angelegt. Begruendung fuer die einmalige Bestandsuebernahme
-- steht dort: wer Studio darf, benutzt die KI heute schon; ein Vorgabewert
-- von false waere fuer diese Konten ein Ausfall, keine Rechteklaerung.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ai_access" BOOLEAN NOT NULL DEFAULT false;

-- Bestandsuebernahme (einmalig, siehe oben).
UPDATE "users" SET "ai_access" = true WHERE "studio_access" = true OR "is_owner" = true;
