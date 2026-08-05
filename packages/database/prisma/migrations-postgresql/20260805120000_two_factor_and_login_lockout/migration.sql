-- Postgres-Zweig, gleichzeitig mit dem SQLite-Zweig angelegt. Begruendung der
-- drei additiven Spalten steht dort:
--   two_factor_challenges.attempt_count → Challenge nach N Fehlversuchen
--     verbrennen (TOTP-Bruteforce innerhalb der TTL stoppen),
--   users.failed_login_count / users.locked_until → kontobasiertes Lockout,
--     das IP-Rotation ueberlebt.
-- Additiv mit Default — kein Datenverlust, reversibel.

-- AlterTable
ALTER TABLE "two_factor_challenges" ADD COLUMN     "attempt_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3);
