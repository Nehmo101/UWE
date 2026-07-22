# Agent instructions (UWE)

**GitHub Cloud CI is the authoritative gate.** A pull request is ready to merge when
its GitHub checks are green — `pr-check.yml` (file-size budget check, `pnpm lint`, the
affected-package `pnpm ci:light:pr:gate`, a conditional Studio production build, and a
conditional Fedora 44 host smoke for host/deploy changes)
on every PR, and the full `pnpm quality` gate on `main`. Agents (cloud, Cursor, Codex,
Claude) run only in the GitHub Cloud; there is no required local or self-hosted gate.

Running the quality gate locally before pushing is an **optional, recommended
pre-check** that catches failures faster:

```bash
pnpm install --frozen-lockfile
pnpm quality:quiet # recommended for agents — summary + tail on failure
pnpm quality       # full local mirror of the main gate (verbose)
# or, faster, mirroring the PR gate:
pnpm ci:light
```

On failure, read only the **last ~60 lines** of output (or the path printed by `quality:quiet`) — not the full log.

`pnpm quality` runs, in order:

1. `pnpm --filter @uwe/database db:generate` — Prisma client
2. `pnpm lint` — ESLint with `--max-warnings 0`
3. `pnpm secret:scan` — lightweight repository secret scan
4. `pnpm typecheck` — all workspace packages
5. `pnpm test` — unit + integration smoke tests
6. `pnpm test:security` — authz, public leak scanner, Studio route guard smoke tests
7. `pnpm audit:prod` — production dependency audit at high severity and above
8. `pnpm build:release` — production build

A PR is ready when its **GitHub checks are green**. The local run above is an
optional pre-check, not a required or self-hosted gate.

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

### 5. File size budget exceeded (test) — anti-monolith gate

`scripts/file-size-budget-check.mjs` fails `pnpm test` / `test:ci` when a
production file (apps/, packages/, tools/) outgrows its budget:

- **New files: max 700 lines.** Split into colocated modules or a feature package.
- Legacy files in `scripts/file-size-baseline.json` are **frozen** (+10% headroom;
  `packages/database/src/server.ts` only +3%). When touching them, extract code
  instead of growing the file.
- **Never raise a baseline value or add a new entry to silence the failure.**
  `node scripts/file-size-budget-check.mjs --ratchet` only lowers/removes entries
  after files shrink — run it when you split a baseline file.
- New domain services go into a feature package (`packages/<domain>`), **not**
  into `packages/database`. Export new symbols via subpath exports, not by
  growing the `server.ts` barrel.

## Scope discipline

- Match existing package boundaries (`@uwe/auth`, `@uwe/database`, etc.).
- Prefer extending existing services over duplicating logic — but when a file
  hits its size budget, split it instead of growing it (see failure #5).
- Do not edit unrelated files or drive-by refactor.

## Agent token efficiency

- **Search/index exclusions:** `.cursorignore` / `.cursorindexingignore` exclude generated Prisma (~560k lines), lockfile, and build artifacts.
- **Service index:** `docs/engineering/database-service-map.md` — find `@uwe/database` services without opening the 2100+-line barrel.
- **Skills:** `.cursor/skills/manifest.json` — load one skill by trigger, not the whole catalog.

## Further reading

- `docs/engineering/ci.md` — CI workflows, local commands, debugging
- `docs/engineering/self-hosted-ci.md` — Self-hosted CI, Hardware, Billing (historical / optional reference — **not** the active gate)
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

- `pnpm dev` runs the apps via Turbo: **Studio** on `:3000`, **Portal** on `:3001`, **Brain** on `:3002` (owner-only, local/LAN, never public — see `docs/engineering/brain-local-runtime.md`). `pnpm dev:brain` starts Brain alone.
- Product boundaries: apps never import each other and packages never import an app (`pnpm boundary:check`, enforced in `test`/`test:ci`). Product tags live in `@uwe/product-contracts`.
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

### Dev-mode CSP and `next dev` hydration

The CSP (`packages/auth/src/security-headers.ts`) is environment-aware:
`script-src` is `'self' 'unsafe-inline'` in **production** and
`'self' 'unsafe-inline' 'unsafe-eval'` in **development**. The extra
`'unsafe-eval'` in the dev branch is exactly what Next.js Fast Refresh/HMR and
client hydration need, so interactive UI **works** in a browser against
`pnpm dev` — no temporary CSP patching is required for manual dev testing.

- Production stays strict (no `'unsafe-eval'`). Do **not** add `'unsafe-eval'`
  to the production branch — CSP changes there need explicit security review per
  `.cursor/rules/security.mdc`.
- The E2E harness (`scripts/e2e-servers.mjs`) still runs `next build` +
  `next start` with `NODE_ENV=production` to exercise the real production
  CSP/middleware; that is how `pnpm test:e2e` verifies auth flows.
