---
description: Diagnose and fix a failing UWE CI check with a minimal change
---

Diagnose and fix the failing CI step with a minimal, targeted change, then verify locally.

Follow the canonical procedure in **`.cursor/commands/fix-failing-ci.md`**. Key points:

- Map the failing GitHub check to a local script: lint → `pnpm lint`; typecheck →
  `pnpm typecheck` (run `pnpm --filter @uwe/database db:generate` first if Prisma-related);
  test → `pnpm test:ci`; security → `pnpm test:security` / `pnpm secret:scan`;
  audit → `pnpm audit:prod`; build → `pnpm build:release`; docs → `pnpm docs:check`.
- Reproduce with `pnpm install --frozen-lockfile` then the failing script; read only the
  last ~60 lines of output.
- Fix the root cause (unused imports → prefix `_`; wrong auth import → `AGENTS.md` table;
  lockfile drift → `pnpm install` + commit `pnpm-lock.yaml`). No drive-by refactors.
- Never disable/skip a check to go green. Re-run `pnpm quality:quiet` before pushing.

Report: root cause (one sentence), files changed, commands run, and whether the gate passes.
