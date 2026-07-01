-- C6: SRD/Open5e spell catalog + homebrew details on character spells
ALTER TABLE "character_spells" ADD COLUMN "display_name" TEXT;
ALTER TABLE "character_spells" ADD COLUMN "school" TEXT;
ALTER TABLE "character_spells" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
