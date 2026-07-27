# UWE Migration Rules

## SQLite / Prisma specifics

- SQLite has limited `ALTER TABLE` — complex changes may need table rebuild
- Prisma enums are stored as **TEXT** — new enum values are enforced in application code
- Default pattern for new columns: `ADD COLUMN ... NOT NULL DEFAULT '...'`
- Use separate migrations for unrelated changes (easier rollback reasoning)

## Naming convention

```
YYYYMMDDHHMMSS_descriptive_snake_case/
  migration.sql
```

Examples from repo:

- `20260616120000_visibility_secret_system`
- `20260614120000_media_calendar_dnd_agents`

## Safe patterns

### Add nullable column
```sql
ALTER TABLE "pages" ADD COLUMN "secret_level" TEXT;
```

### Add column with default (preferred for NOT NULL)
```sql
ALTER TABLE "pages" ADD COLUMN "secret_level" TEXT NOT NULL DEFAULT 'none';
```

### New table
Let Prisma generate — verify indexes and foreign keys match query patterns.

## Risky patterns

| Pattern | Risk | Mitigation |
|---------|------|------------|
| Drop column | Data loss | Multi-step: deprecate → migrate data → drop later |
| Rename column | App/runtime mismatch | Single deploy with `@map` or copy + drop |
| Change column type | SQLite cast issues | New column + backfill + swap |
| Bulk UPDATE without WHERE | Full table rewrite | Test on copy of production DB |
| Unique index on existing duplicates | Migration fails | Dedupe script first |

## Schema ↔ code checklist

- [ ] `schema.prisma` matches `migration.sql`
- [ ] Generated client types used (`pnpm db:generate`)
- [ ] Repository/service updated for new fields
- [ ] Zod/validation updated if user input involved
- [ ] Tests seed new fields or defaults
- [ ] `.env.example` unchanged unless new ENV (rare for migrations)

## Production deploy

On host (Docker or bare metal):

```bash
pnpm --filter @uwe/database db:deploy   # applies pending migrations
```

**Before migrate in production:**

1. Backup: `pnpm backup:create` or copy `uwe.db`
2. Set `RUN_DB_SEED=false`
3. Stop apps or use maintenance window for breaking migrations

## Seed considerations

- `packages/database/prisma/seed.ts` — dev/demo only
- `terra-seed.ts` — demo world, not product logic
- Security tests use isolated fixtures (`packages/security-tests/`)

## Multi-migration PRs

Acceptable when features are atomic (e.g. visibility + audit log in one release). Document deploy order in PR description.

## Related

- `packages/database/package.json` — scripts
- `docs/backup-restore.md` — backup before migrate
