-- AlterTable: KI-Wochenvorschlag-Entwurf (Kitchen K3) persistieren
ALTER TABLE "meal_plan_weeks" ADD COLUMN "ai_draft" JSONB;
