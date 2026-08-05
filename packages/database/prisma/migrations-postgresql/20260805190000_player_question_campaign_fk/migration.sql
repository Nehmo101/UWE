-- Spielerfragen: `campaign_id` als echte FK mit SET NULL (PostgreSQL).
-- Waisen vorab auf NULL, sonst scheitert die neue Constraint.
-- Gegenstueck: migrations/20260805190000_player_question_campaign_fk.

-- UpdateData: Waisen bereinigen
UPDATE "player_questions"
SET "campaign_id" = NULL
WHERE "campaign_id" IS NOT NULL
  AND "campaign_id" NOT IN (SELECT "id" FROM "campaigns");

-- AddForeignKey
ALTER TABLE "player_questions" ADD CONSTRAINT "player_questions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
