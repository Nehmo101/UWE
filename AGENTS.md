# Agent instructions (UWE)

Cloud agents and Cursor subagents must pass the same **quality** gate as CI before opening or updating a pull request.

## Required check (mirrors `.github/workflows/ci.yml`)

```bash
pnpm install --frozen-lockfile
pnpm quality
```

`pnpm quality` runs, in order:

1. `pnpm --filter @uwe/database db:generate` — Prisma client
2. `pnpm lint` — ESLint with `--max-warnings 0`
3. `pnpm secret:scan` — lightweight repository secret scan
4. `pnpm typecheck` — all workspace packages
5. `pnpm test` — unit + integration smoke tests
6. `pnpm test:security` — authz, public leak scanner, Studio route guard smoke tests
7. `pnpm audit:prod` — production dependency audit at high severity and above
8. `pnpm build:release` — production build

Do **not** push or mark a PR ready until this succeeds locally.

## Common recurring failures

### 1. Unused imports / variables (lint)

ESLint rule `@typescript-eslint/no-unused-vars` is strict. Prefix intentionally unused symbols with `_`:

```typescript
import { used, _unused } from "./module";
function handler(_request: Request) { ... }
```

Remove imports you added but no longer use. Run `pnpm lint` after every edit pass.

### 2. Wrong internal auth imports (typecheck)

| Symbol | Import from |
|--------|-------------|
| `SESSION_COOKIE_NAME`, `PREVIEW_COOKIE_NAME` | `@uwe/auth` or `packages/auth/src/session` |
| `getUweRuntimeConfig`, `getSessionCookieOptions` | `@uwe/auth` or `packages/auth/src/runtime-config` |

Do not import `SESSION_COOKIE_NAME` from `runtime-config` in new code — use `session` or the `@uwe/auth` barrel.

### 3. Prisma client missing (typecheck / test)

Always run `db:generate` before typecheck when touching `packages/database`. The `quality` script does this automatically.

### 4. Lockfile out of sync

After adding dependencies: `pnpm install` and commit `pnpm-lock.yaml`. CI uses `--frozen-lockfile`.

## Scope discipline

- Match existing package boundaries (`@uwe/auth`, `@uwe/database`, etc.).
- Prefer extending existing services over duplicating logic.
- Do not edit unrelated files or drive-by refactor.

## Further reading

- `.cursor/skills/ci-quality-gate/SKILL.md` — detailed quality workflow
- `docs/AGENT_JOBS.md` — GitHub Actions agent job integration
- `docs/TEST_PLAN.md` — manual QA checklist
