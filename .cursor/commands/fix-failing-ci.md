# Fix Failing CI

Diagnose and fix a failing CI step with minimal, targeted changes.

## Steps

1. Identify the failing workflow and job from the CI log (CI, PR Check, Security, Docs Check).
2. Map the failing step to a local `package.json` script:
   - Lint → `pnpm lint`
   - Typecheck → `pnpm typecheck` (run `pnpm --filter @uwe/database db:generate` first if Prisma-related)
   - Test → `pnpm test` or `pnpm test:ci`
   - Security → `pnpm test:security` or `pnpm secret:scan`
   - Audit → `pnpm security:audit`
   - Build → `pnpm build:release`
   - Docs → `pnpm docs:check`
   - Full gate → `pnpm quality`
3. Reproduce locally:
   ```bash
   pnpm install --frozen-lockfile
   # run the failing script
   ```
4. Fix the root cause — common patterns:
   - Unused imports → remove or prefix with `_`
   - Wrong auth import path → see `AGENTS.md`
   - Missing Prisma client → `pnpm --filter @uwe/database db:generate`
   - Lockfile drift → `pnpm install` and commit `pnpm-lock.yaml`
   - Secret scan false positive → remove hardcoded value or add justified allowlist entry
5. Re-run the full gate: `pnpm quality`
6. Commit with a clear message referencing the fixed check.

## Rules

- Never disable or skip CI checks without explicit user approval and documentation.
- Do not use `@ts-ignore` or `eslint-disable` broadly to silence errors.
- Keep fixes scoped to the failure — no drive-by refactors.

## Output

- Root cause (one sentence)
- Files changed
- Commands run and results
- Whether `pnpm quality` passes
