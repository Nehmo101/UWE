-- Haerten gegen externe Angreifer ohne Konto (drei additive Spalten):
--
-- 1) two_factor_challenges.attempt_count — Fehlversuchszaehler pro Challenge.
--    Ab MAX_CHALLENGE_ATTEMPTS wird die Challenge verbrannt (consumed_at
--    gesetzt); die 5-Minuten-TTL ist damit kein Freibrief fuer beliebig viele
--    TOTP-Rateversuche mehr.
--
-- 2) users.failed_login_count / users.locked_until — kontobasiertes Lockout,
--    zusaetzlich zum IP-Rate-Limit. Kontobasiert (nicht IP-gekeyt), damit ein
--    Angreifer die Sperre nicht durch IP-Rotation umgeht.
--
-- Alle drei Spalten sind additiv mit Default — kein Datenverlust, reversibel.

-- AlterTable
ALTER TABLE "two_factor_challenges" ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" DATETIME;
