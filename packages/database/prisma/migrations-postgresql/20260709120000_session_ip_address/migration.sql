-- Store client IP at session creation for account security overview.
-- Postgres-Zweig, Spiegel von migrations/20260709120000_session_ip_address —
-- fehlte bisher, obwohl schema.postgresql.prisma die Spalte kennt.
ALTER TABLE "sessions" ADD COLUMN "ip_address" TEXT;
