# PostgreSQL Migration (Roadmap)

UWE currently ships with **SQLite (libsql)**. PostgreSQL support is prepared at the client layer but requires a deliberate provider switch.

## When to migrate

- Multiple concurrent writers
- Database size beyond comfortable SQLite limits
- Managed Postgres (RDS, Supabase, Neon) as part of infra standardization

## Steps

1. **Backup** — `pnpm backup:create --type=full` before any provider change.
2. **Provision Postgres** — empty database, connection string ready.
3. **Update schema provider** in `packages/database/prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. **Set env** — `DATABASE_URL=postgresql://user:pass@host:5432/uwe`
5. **Migrate fresh** — `pnpm --filter @uwe/database db:migrate` on the empty Postgres DB.
6. **Restore data** — use UWE backup/restore or re-seed for dev.

## Code readiness

- `createPrismaClient()` in `packages/database/src/client.ts` detects postgres URLs and fails fast with a link to this doc until the schema provider is switched.
- Domain logic stays in `@uwe/database` repositories — apps should not use SQLite-specific SQL.

## Not automatic

- Existing SQLite migration SQL is **not** portable 1:1.
- A dedicated Postgres migration baseline will be added when production demand is confirmed.
- Manual repopulation from backup is the supported path for early adopters.

See also: [docs/ROADMAP.md](./ROADMAP.md)
