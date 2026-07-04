-- AlterTable: Bild-Anhänge für Ideen-Management (Prompt-Bilder + Übergabe an Claude)
ALTER TABLE "dev_ideas" ADD COLUMN "attachments" JSONB;
