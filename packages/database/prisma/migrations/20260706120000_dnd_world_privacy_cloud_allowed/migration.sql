-- Align stored dnd_world privacy with DEFAULT_PRIVACY_RULES (CLOUD_ALLOWED).
-- Seed in 20260619140000_ai_gateway set dnd_world to CLOUD_FORBIDDEN; runtime
-- defaults and admin policy now allow cloud when permitted (RTX preferred).

UPDATE "ai_gateway_config"
SET
  "privacy_rules" = json_set("privacy_rules", '$.dnd_world', 'CLOUD_ALLOWED'),
  "updated_at" = CURRENT_TIMESTAMP
WHERE json_extract("privacy_rules", '$.dnd_world') = 'CLOUD_FORBIDDEN';
