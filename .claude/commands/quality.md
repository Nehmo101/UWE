---
description: Run the UWE quality gate the smart way and fix failures
argument-hint: "[light|full]  (default: quiet full gate)"
---

Run the UWE quality gate and drive it to green.

1. Ensure deps + Prisma client are ready (the SessionStart harness normally does this):
   `pnpm install --frozen-lockfile` then `pnpm --filter @uwe/database db:generate`.
2. Run the gate:
   - default / `full` → `pnpm quality:quiet` (summary + tail on failure)
   - `light` → `pnpm ci:light` (faster PR mirror)
3. On failure, read **only the last ~60 lines** (or the path `quality:quiet` prints) — not the whole log.
4. Fix the root cause with a minimal, scoped change. Common patterns and the auth-import
   table are in `AGENTS.md` ("Common recurring failures"). Never silence checks with
   broad `eslint-disable` / `@ts-ignore` or by raising `scripts/file-size-baseline.json`.
5. Re-run until green. Report: root cause, files changed, final gate result.

Canonical: `.cursor/skills/ci-quality-gate/SKILL.md`, `docs/engineering/ci.md`.
