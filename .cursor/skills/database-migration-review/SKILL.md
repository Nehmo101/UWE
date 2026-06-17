---
name: database-migration-review
description: Review Prisma/SQLite database migrations in UWE for safety, reversibility, schema consistency, and production deploy impact. Use when reviewing migration PRs, adding schema changes, or before running db:migrate on production hosts.
---

# UWE Database Migration Review

## Stack

- **ORM:** Prisma 7 with libsql/SQLite adapter
- **Schema:** `packages/database/prisma/schema.prisma`
- **Migrations:** `packages/database/prisma/migrations/<timestamp>_<name>/migration.sql`
- **Commands:** `pnpm db:migrate` (dev), `pnpm --filter @uwe/database db:deploy` (production)

## Review workflow

1. Diff `schema.prisma` and new `migration.sql`.
2. Check [references/migration-rules.md](references/migration-rules.md).
3. Verify seed/fixtures still work if models changed.
4. Run locally:

```bash
pnpm --filter @uwe/database db:generate
pnpm --filter @uwe/database db:migrate
pnpm test
pnpm build:release
```

## Red flags (block merge)

- Destructive `DROP` / `DELETE` without backup note
- `NOT NULL` on existing columns without default
- Enum changes without app-layer handling (SQLite stores enums as TEXT)
- Missing migration folder for schema.prisma changes
- Renamed columns without data copy step

## Output template

```markdown
## Migration: <timestamp>_<name>
- Tables/columns affected: ...
- Backward compatible: yes/no
- Production risk: low/medium/high
- Seed impact: ...
- Verdict: approve | request-changes
```

Details: [references/migration-rules.md](references/migration-rules.md)
