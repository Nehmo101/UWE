# PostgreSQL (optional production database)

UWE defaults to **SQLite (libsql)** for local development and tests. **PostgreSQL** is supported via a separate schema and baseline migration — no need to change `schema.prisma` for SQLite users.

## Quick start (PostgreSQL)

```bash
# Provision empty Postgres DB, then:
export DATABASE_URL=postgresql://user:pass@localhost:5432/uwe
pnpm --filter @uwe/database db:generate
pnpm --filter @uwe/database db:deploy:postgres
pnpm --filter @uwe/database db:seed
```

## Architecture

| Component | SQLite (default) | PostgreSQL |
|-----------|------------------|------------|
| Schema | `prisma/schema.prisma` | `prisma/schema.postgresql.prisma` |
| Migrations | `prisma/migrations/` | `prisma/migrations-postgresql/` |
| Generated client | `src/generated/prisma/` | `src/generated/prisma-postgres/` |
| Driver | `@prisma/adapter-libsql` | `@prisma/adapter-pg` + `pg` |

`createPrismaClient()` selects the driver from `DATABASE_URL` automatically.

## Migrate from SQLite

1. **Backup** — `pnpm backup:create --type=full`
2. Set `DATABASE_URL=postgresql://…`
3. `pnpm --filter @uwe/database db:deploy:postgres` on empty Postgres
4. **Restore** via Studio backup UI or re-seed for dev
5. Restored users need password setup — see [backup-restore.md](./backup-restore.md)

## CI

The `postgres-smoke` job runs `db:deploy:postgres` + `pnpm test:postgres-smoke` (includes Prisma client generate) against a service container.

## Do not

- Apply SQLite migration SQL directly to Postgres
- Mix migration folders — use `db:deploy` for SQLite, `db:deploy:postgres` for Postgres

See also: [docs/ROADMAP.md](./ROADMAP.md)
