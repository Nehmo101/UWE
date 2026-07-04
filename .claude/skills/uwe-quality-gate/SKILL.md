---
name: uwe-quality-gate
description: Run the UWE quality gate before finishing work and fix the recurring lint/typecheck/build failures. Use before committing or pushing, after a rebase, or when CI is red. Also invokable as /quality and /fix-failing-ci.
---

# UWE Quality Gate

Before committing/pushing agent work (GitHub Cloud CI is the authoritative gate):

1. `pnpm install --frozen-lockfile` (the SessionStart harness normally does this already).
2. Run one gate:
   - **`pnpm quality:quiet`** — recommended for agents (summary + tail on failure)
   - `pnpm quality` — full verbose main-gate mirror
   - `pnpm ci:light` — faster PR mirror
3. On failure read **only the last ~60 lines** (or the path `quality:quiet` prints).

`pnpm quality` order: `db:generate` → `lint` (`--max-warnings 0`) → `secret:scan` → `typecheck`
→ `test` → `test:security` → `audit:prod` → `build:release` → bundle-budget.

Recurring failures (fix, don't silence):
- **Unused imports/vars** → remove, or prefix intentionally-unused with `_`.
- **Wrong auth import path** → use `@uwe/auth`; see the table in `AGENTS.md`.
- **Missing Prisma client** → `pnpm --filter @uwe/database db:generate`.
- **Lockfile drift** → `pnpm install`, commit `pnpm-lock.yaml` (CI uses `--frozen-lockfile`).
- **File-size budget** → split the file; run `node scripts/file-size-budget-check.mjs --ratchet`
  after shrinking. Never raise a baseline or add an entry.

Never use broad `eslint-disable` / `@ts-ignore`, skip checks, or import server-only modules into client components.

Depth: `AGENTS.md`, `.cursor/skills/ci-quality-gate/SKILL.md`, `docs/engineering/ci.md`.
