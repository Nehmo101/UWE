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

- `docs/engineering/ci.md` — CI workflows, local commands, debugging
- `docs/engineering/self-hosted-ci.md` — Self-hosted CI, Hardware, Billing (geplant für später)
- `docs/engineering/cursor-workflow.md` — Cursor rules, commands, agent PR workflow
- `.cursor/rules/` — project, coding, CI, security, and docs rules for Cursor
- `.cursor/skills/ci-quality-gate/SKILL.md` — detailed quality workflow
- `docs/AGENT_JOBS.md` — GitHub Actions agent job integration
- `docs/TEST_PLAN.md` — manual QA checklist

## Cursor Cloud specific instructions

The startup update script already runs `pnpm install --frozen-lockfile` and
`pnpm --filter @uwe/database db:generate`. The notes below cover non-obvious
run/test caveats; standard commands live in `README.md` and root `package.json`.

### Services & how to run them (development)

- `pnpm dev` runs both apps via Turbo: **Studio** on `:3000`, **Portal** on `:3001`
  (or `pnpm dev:studio` / `pnpm dev:portal`). Health: `GET /api/health` on each.
- Lint/typecheck/test/build are the root scripts (`pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm test:security`, `pnpm build:release`); the full gate is
  `pnpm quality` (see top of this file). All currently pass.

### First-run database setup (DB file is git-ignored, not in the update script)

A fresh VM has no local DB. Once per VM, create env + database:

```bash
cp -n .env.example .env
pnpm --filter @uwe/database db:deploy   # apply migrations (idempotent)
pnpm --filter @uwe/database db:seed     # demo world "Terra" + users
```

- SQLite lives at `packages/database/data/uwe.db`. `resolveDatabaseUrl` always
  resolves a relative `file:` `DATABASE_URL` to that path regardless of CWD, so
  every process (dev, scripts, standalone) shares the same seeded DB.
- Seeded dev/demo login: **`dm@uwe.local` / `uwe-dev`** (Studio DM). Other seeded
  player accounts also use `uwe-dev`.

### Known dev-mode gotcha: strict CSP blocks `next dev` hydration

The committed CSP (`packages/auth/src/security-headers.ts`) sets
`script-src 'self' 'unsafe-inline'` (no `'unsafe-eval'`). This is correct for
production, but Next.js **dev** mode (`next dev`) needs `'unsafe-eval'` for Fast
Refresh/HMR. In a browser against `pnpm dev`, client hydration fails
(`EvalError: ... 'unsafe-eval' is not an allowed source`) and the login form
falls back to a broken native GET — i.e. interactive UI does not work in dev.

- Production builds are unaffected. The project's E2E harness
  (`scripts/e2e-servers.mjs`) runs `next build` + `next start` with
  `NODE_ENV=production`, where the strict CSP works; that is how `pnpm test:e2e`
  verifies auth flows.
- For manual browser testing in dev, temporarily add `'unsafe-eval'` to the
  dev branch of the CSP in `security-headers.ts` (production unchanged) and
  revert before committing — CSP changes need explicit security review per
  `.cursor/rules/security.mdc`.

### Known broken route (pre-existing)

`/worlds/[worldSlug]/pages/new` errors at render: `createPageAction` in
`apps/studio/app/actions.ts` is passed to `<form action={...}>` but that file
is missing the `"use server"` directive, so the page hangs on the
`Studio wird geladen…` loader. Other write flows (e.g. `/capture`, which uses
`apps/studio/app/capture-actions.ts`) are proper server actions and work.
