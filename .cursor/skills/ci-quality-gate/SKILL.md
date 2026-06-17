---
name: ci-quality-gate
description: Run the UWE CI quality pipeline before finishing agent work. Use when implementing features, fixing bugs, or preparing a PR. Prevents recurring lint (unused imports) and typecheck failures.
---

# CI Quality Gate

## When to use

- Before committing or pushing any agent branch
- After merging or rebasing onto `main`
- When CI fails on a PR you authored

## Workflow

1. Install dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Run the full quality pipeline (same as GitHub Actions `quality` job):

   ```bash
   pnpm quality
   ```

3. If lint fails with `@typescript-eslint/no-unused-vars`:
   - Remove unused imports
   - Prefix intentionally unused params with `_`
   - Re-run `pnpm lint`

4. If typecheck fails in `@uwe/auth`:
   - Verify `SESSION_COOKIE_NAME` is imported from `session` or `@uwe/auth`, not `runtime-config`
   - Run `pnpm --filter @uwe/database db:generate` then `pnpm typecheck`

5. If tests fail, fix the failing package and re-run `pnpm quality`.

6. Only push when `pnpm quality` exits 0.

## Do not

- Push with only `pnpm typecheck` or partial checks
- Leave unused imports "for later"
- Skip `pnpm-lock.yaml` after dependency changes
- Import server-only modules into client components (`node:crypto`, Prisma, etc.)

## References

- See [failure-patterns.md](references/failure-patterns.md) for CI log examples
- See [AGENTS.md](../../../AGENTS.md) for repo-wide agent rules
- CI workflow: [.github/workflows/ci.yml](../../../.github/workflows/ci.yml)
