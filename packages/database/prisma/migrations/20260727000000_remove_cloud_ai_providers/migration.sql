-- Cloud AI providers removed: every AI action in UWE runs on the RTX host.
--
-- `ai_cloud_providers` stored per-provider endpoints and encrypted API keys.
-- `ai_user_grants` rationed cloud access and spend per user. Neither has a
-- meaning once there is a single local backend, so both tables go rather than
-- linger as unused schema.
DROP TABLE IF EXISTS "ai_user_grants";
DROP TABLE IF EXISTS "ai_cloud_providers";
