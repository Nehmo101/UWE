/**
 * PostgreSQL migration path for UWE (planned).
 *
 * SQLite remains the default. Switching providers requires:
 * 1. Set `DATABASE_URL=postgresql://user:pass@host:5432/uwe`
 * 2. Change `provider` in `packages/database/prisma/schema.prisma` to `postgresql`
 * 3. Run `pnpm --filter @uwe/database db:migrate` on a fresh database
 * 4. Re-seed or restore from backup
 *
 * `createPrismaClient()` detects postgres URLs and uses the native Prisma driver
 * (no libsql adapter). Schema SQL differs — do not apply SQLite migrations directly.
 */

export function isPostgresDatabaseUrl(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}
