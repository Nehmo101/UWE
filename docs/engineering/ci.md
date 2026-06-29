# CI — Workflows, Scripts, and Debugging

Stand: 2026-06-29

UWE uses **pnpm** (lockfile: `pnpm-lock.yaml`, `packageManager: pnpm@10.12.1`) and **Turbo** for the monorepo. CI runs on **Node 22** in GitHub Actions.

## Caching and job timeouts

Hosted jobs restore **Turbo** (`.turbo/`) and **Next.js build** caches (`.next/cache` in Studio and Portal) via `actions/cache` before the quality gate on `main`, and Turbo cache before `ci:light` on PRs. This speeds up incremental `typecheck`, `test`, and `build:release` runs without changing gate semantics.

Each hosted job sets `timeout-minutes` to cap runaway jobs (quality 25, PR fast-checks 20, postgres-smoke 15, e2e 30, security 20, docs 10).

## Cost strategy

GitHub-hosted minutes are reserved for **cheap PR feedback**. Expensive checks run on **`main`**, on a **schedule**, or **manually** — not on every pull request.

| Event | Workflow | Gate |
|-------|----------|------|
| **Pull request** | `pr-check.yml` | `pnpm ci:light` (lint, typecheck, test:ci, secret scan, docs) |
| **Push `main`** | `ci.yml` | Full `pnpm quality` + PostgreSQL smoke (when DB paths change) |
| **Sunday 03:00 UTC / manual** | `ci.yml` | E2E + performance budget checks |
| **Monday 06:00 UTC / manual** | `security.yml` | Secret scan, prod audit, security tests |
| **Push `main` (docs paths)** | `docs-check.yml` | Supplemental link scan (not a PR gate) |
| **Manual** | `cursor-agent.yml` | Agent branch + draft PR (PR gate validates after push) |
| **CI success on `main`** | `deploy.yml` | Deploy via self-hosted runner on the Linux mini |

## Workflows

| Workflow | File | Trigger | Purpose | Required on PR? |
|----------|------|---------|---------|-----------------|
| **PR Check** | `.github/workflows/pr-check.yml` | All PRs | Cheap gate: `pnpm ci:light` + lockfile check | **Yes** |
| **CI** | `.github/workflows/ci.yml` | Push `main`, weekly schedule, manual | Full `pnpm quality`, Postgres smoke; E2E on schedule/manual only | No |
| **Security** | `.github/workflows/security.yml` | Weekly Monday, manual | Audit + security tests (secret scan also in PR via `ci:light`) | No |
| **Docs Check** | `.github/workflows/docs-check.yml` | Push `main` (docs paths), manual | Supplemental link scan | No |
| **Cursor Agent** | `.github/workflows/cursor-agent.yml` | Manual | Agent jobs from Studio admin | No |
| **Deploy** | `.github/workflows/deploy.yml` | `workflow_run` after CI success on `main` | Self-hosted runner (`uwe-deploy`) on the host → `uwe-cd-trigger.sh` → git pull + setup --quick | No |

> The former `windows-installer.yml` workflow was removed together with the
> Docker + Windows-installer runtime (see
> [removed-legacy-runtime.md](../removed-legacy-runtime.md)).

### Branch protection (recommended)

**Required status checks** — only these should block merges:

- `fast-checks` (job in `pr-check.yml`)

**Do not mark as required** (path-filtered, expensive, or post-merge gates):

- `quality`, `e2e`, `postgres-smoke` (CI on `main` / scheduled)
- `security-scan`, `security-tests` (Security — weekly/manual only)
- `docs` (Docs Check)

Configure in GitHub: **Settings → Branches → Branch protection rules → `main` → Require status checks**.

### PR Check (`pr-check.yml`)

The only automatic workflow on pull requests:

1. Path filter — docs-only PRs (markdown, `docs/**`, `.cursor/**`) skip the heavy gate; job `fast-checks` still completes successfully for branch protection
2. `pnpm install --frozen-lockfile` (code changes only)
3. Lockfile in sync (`git diff --exit-code pnpm-lock.yaml`)
4. Restore Turbo cache (`actions/cache`)
5. `pnpm ci:light` — db:generate, lint, typecheck, test:ci, secret scan, docs:check

No `pnpm quality`, no E2E, no security tests, no release build.

### CI (`ci.yml`)

Runs on push to `main`, weekly schedule (Sunday 03:00 UTC), or `workflow_dispatch`:

1. Install with frozen lockfile
2. Restore Turbo + Next.js build caches (`actions/cache`)
3. `pnpm quality` — full gate:
   - Prisma client generate
   - Lint (zero warnings)
   - Secret scan
   - Typecheck
   - Unit + integration tests
   - Security tests
   - Production dependency audit (high+)
   - Release build
3. **PostgreSQL smoke** (`pnpm test:postgres-smoke`) — migrate deploy + smoke tests against a Postgres 16 service container; runs after quality when `packages/database/**` or `**/*postgres*` changed, or on schedule / manual dispatch
4. **E2E tests + performance budget** (`pnpm test:e2e`, `pnpm test:e2e:perf`, `perf-budget-check.mjs`) — Playwright; runs only on `workflow_dispatch` or `schedule`, **not** on every push to `main`

Concurrency cancels superseded `main` pushes to avoid duplicate full-gate runs.

### Security (`security.yml`)

- `pnpm secret:scan`
- `pnpm security:audit` (alias for `pnpm audit:prod`)
- `pnpm test:security`

Triggers: **weekly Monday 06:00 UTC** and `workflow_dispatch` only. No longer runs on every push to `main` — `pnpm quality` in `ci.yml` already covers secret scan, security tests, and prod audit on main.

### Docs Check (`docs-check.yml`)

Supplemental only — PRs already run `pnpm docs:check` in `pr-check.yml`.

- `node scripts/docs-check.mjs` — required files, Markdown structure (no monorepo install; script uses only Node built-ins)
- Basic internal link scan (warnings only for broken relative links)

Triggers: push `main` when docs-related paths change, `workflow_dispatch`.

### Cursor Agent (`cursor-agent.yml`)

- Pushes branch and opens draft PR — does **not** run `ci:light` (PR gate `pr-check.yml` validates the opened PR, avoiding duplicate ~9 min runs)
- Full gate runs after merge to `main` via `ci.yml`
- Agents run in the GitHub Cloud; there is no self-hosted runner requirement

## Local commands

| Script | Equivalent CI step |
|--------|-------------------|
| `pnpm ci:light` | PR gate: db:generate → lint → typecheck → test:ci → secret scan → docs |
| `pnpm ci:check` | Local fast path with release build: lint → typecheck → test:ci → build:release |
| `pnpm quality` | Full CI quality job (main gate) |
| `pnpm quality:quiet` | Same as quality; writes full log to temp file, prints tail on failure (for agents) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Turbo typecheck |
| `pnpm test` | Unit + integration smoke |
| `pnpm test:ci` | PR test subset (no security tests) |
| `pnpm test:security` | Authz, leaks, route guards |
| `pnpm test:postgres-smoke` | PostgreSQL migrate + auth smoke (needs `POSTGRES_TEST_URL`) |
| `pnpm build:release` | Prisma generate + turbo build |
| `pnpm secret:scan` | Repository secret patterns |
| `pnpm security:audit` | `pnpm audit --prod --audit-level high` |
| `pnpm docs:check` | Required docs + Markdown scan |

### Recommended developer flow

```bash
pnpm install --frozen-lockfile

# During development (faster)
pnpm lint && pnpm typecheck

# Before PR (matches GitHub PR gate)
pnpm ci:light

# Optional full pre-check (matches main gate)
pnpm quality

# Agents: prefer quiet mode — avoids dumping thousands of lines into context on failure
pnpm quality:quiet
```

**Note:** Use `pnpm ci:check` when you also want a local release build. Use `pnpm ci:light` to mirror the PR workflow exactly.

## Debugging common failures

### Lint: unused imports

```
@typescript-eslint/no-unused-vars
```

Remove unused imports or prefix with `_`. Run `pnpm lint` after each edit pass.

### Typecheck: Prisma client missing

```bash
pnpm --filter @uwe/database db:generate
pnpm typecheck
```

### Typecheck: wrong auth import

Import `SESSION_COOKIE_NAME` from `@uwe/auth` or `packages/auth/src/session`, not `runtime-config`.

### Lockfile out of sync

```bash
pnpm install
git add pnpm-lock.yaml
```

CI uses `--frozen-lockfile` — local install must match committed lockfile.

### Secret scan false positive

Remove the hardcoded value or add a justified entry to `ALLOWLIST_PATHS` in `scripts/secret-scan.mjs`.

### Audit failures

```bash
pnpm audit --prod
```

Fix or document accepted risks. Audit level is **high** and above for production deps.

## What is blocking?

Only **`fast-checks`** in `pr-check.yml` should block PR merges.

Post-merge gates on `main` (CI, Security) catch issues after merge — run `pnpm quality` locally before merging when possible.

## Related

- `docs/engineering/self-hosted-ci.md` — historical / optional reference (self-hosted runner, hardware) — **not** the active gate
- `AGENTS.md` — agent gate (GitHub Cloud CI authoritative; local `pnpm quality` optional pre-check)
- `.cursor/skills/ci-quality-gate/SKILL.md` — detailed failure patterns
- `docs/AGENT_JOBS.md` — Cursor agent GitHub Actions integration
