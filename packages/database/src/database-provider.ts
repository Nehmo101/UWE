/**
 * Database provider detection and PostgreSQL migration path.
 *
 * SQLite (libsql) remains the default for local dev and tests.
 * PostgreSQL uses a separate schema + baseline migration:
 *   - `prisma/schema.postgresql.prisma`
 *   - `prisma/migrations-postgresql/`
 *
 * Enable PostgreSQL:
 *   DATABASE_URL=postgresql://user:pass@host:5432/uwe
 *   pnpm --filter @uwe/database db:deploy:postgres
 *   pnpm --filter @uwe/database db:seed
 */

export function isPostgresDatabaseUrl(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}
