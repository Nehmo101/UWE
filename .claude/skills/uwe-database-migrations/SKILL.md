---
name: uwe-database-migrations
description: Add or review UWE Prisma/SQLite schema changes and migrations for safety, reversibility, and deploy impact. Use when editing packages/database/prisma/schema.prisma, adding a migration, or before db:deploy on a host.
---

# UWE Database Migrations

Stack: Prisma + libsql/SQLite adapter. Schema `packages/database/prisma/schema.prisma`;
migrations `packages/database/prisma/migrations/<timestamp>_<name>/migration.sql`.

Workflow for a schema change:

```bash
pnpm --filter @uwe/database db:migrate     # create dev migration
pnpm --filter @uwe/database db:generate    # regenerate client
pnpm test
pnpm build:release
```

Every `schema.prisma` change **must** ship its migration folder. Production applies migrations
with `pnpm --filter @uwe/database db:deploy` (idempotent `prisma migrate deploy`).

Red flags (block merge):
- Destructive `DROP` / `DELETE` without a backup note.
- `NOT NULL` on an existing column without a default.
- Renamed column without a data-copy step.
- Enum changes without app-layer handling (SQLite stores enums as TEXT).
- `schema.prisma` changed but no migration folder added.

Keep seeds working: seeds are idempotent via the seed-tracker (`packages/database/src/seed-tracker.ts`);
re-verify `pnpm --filter @uwe/database db:seed` after model changes.

Depth: `.cursor/skills/database-migration-review/SKILL.md` (+ `references/migration-rules.md`).
