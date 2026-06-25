# CI — Workflows, Scripts, and Debugging

Stand: 2026-06-25

UWE uses **pnpm** (lockfile: `pnpm-lock.yaml`, `packageManager: pnpm@10.12.1`) and **Turbo** for the monorepo. CI runs on **Node 22** in GitHub Actions.

## Cost strategy

GitHub-hosted minutes are reserved for **cheap PR feedback**. Expensive checks run on **`main`**, on a **schedule**, or **manually** — not on every pull request.

| Event | Workflow | Gate |
|-------|----------|------|
| **Pull request** | `pr-check.yml` | `pnpm ci:light` (lint, typecheck, test:ci, secret scan, docs) |
| **Push `main`** | `ci.yml` | Full `pnpm quality` + E2E + PostgreSQL smoke + conditional Docker |
| **Push `main`** | `security.yml` | Secret scan, prod audit, security tests |
| **Monday 06:00 UTC** | `security.yml` | Weekly dependency monitoring |
| **Push `main` (docs paths)** | `docs-check.yml` | Supplemental link scan (not a PR gate) |
| **Manual / release tags** | `windows-installer.yml` | Windows EXE build |
| **Manual** | `cursor-agent.yml` | Agent branch + draft PR (light gate only) |
| **CI success on `main`** | `deploy.yml` | SSH deploy to self-hosted Linux mini | Production deployment |

## Workflows

| Workflow | File | Trigger | Purpose | Required on PR? |
|----------|------|---------|---------|-----------------|
| **PR Check** | `.github/workflows/pr-check.yml` | All PRs | Cheap gate: `pnpm ci:light` + lockfile check | **Yes** |
| **CI** | `.github/workflows/ci.yml` | Push `main`, manual | Full `pnpm quality`, E2E, Postgres smoke, conditional Docker | No |
| **Security** | `.github/workflows/security.yml` | Push `main`, weekly, manual | Audit + security tests (secret scan also in PR) | No |
| **Docs Check** | `.github/workflows/docs-check.yml` | Push `main` (docs paths), manual | Supplemental link scan | No |
| **Cursor Agent** | `.github/workflows/cursor-agent.yml` | Manual | Agent jobs from Studio admin | No |
| **Windows Installer** | `.github/workflows/windows-installer.yml` | Manual, `v*` tags, `release/**` | Windows installer build/test | No |
| **Deploy** | `.github/workflows/deploy.yml` | `workflow_run` after CI success on `main` | SSH → `uwe-cd-trigger.sh` → git pull + setup --quick | No |

### Branch protection (recommended)

**Required status checks** — only these should block merges:

- `fast-checks` (job in `pr-check.yml`)

**Do not mark as required** (path-filtered, expensive, or post-merge gates):

- `quality`, `e2e`, `postgres-smoke`, `docker-build` (CI on `main`)
- `security-scan`, `security-tests` (Security)
- `docs` (Docs Check)
- `test`, `build-exe` (Windows Installer)

Configure in GitHub: **Settings → Branches → Branch protection rules → `main` → Require status checks**.

### PR Check (`pr-check.yml`)

The only automatic workflow on pull requests:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @uwe/database db:generate`
3. Lockfile in sync (`git diff --exit-code pnpm-lock.yaml`)
4. `pnpm ci:light` — lint, typecheck, test:ci, secret scan, docs:check

No `pnpm quality`, no E2E, no Docker, no Windows build, no security tests, no release build.

### CI (`ci.yml`)

Runs only on push to `main` or `workflow_dispatch`:

1. Install with frozen lockfile
2. `pnpm quality` — full gate:
   - Prisma client generate
   - Lint (zero warnings)
   - Secret scan
   - Typecheck
   - Unit + integration tests
   - Security tests
   - Production dependency audit (high+)
   - Release build
3. **E2E tests** (`pnpm test:e2e`) — Playwright, runs after quality passes
4. **PostgreSQL smoke** (`pnpm test:postgres-smoke`) — migrate deploy + owner setup against a Postgres 16 service container
5. Docker build (studio + portal) — only when Docker-related files changed; cache writes use `mode=min` to reduce GHA cache storage costs

Concurrency cancels superseded `main` pushes to avoid duplicate full-gate runs.

### Security (`security.yml`)

- `pnpm secret:scan`
- `pnpm security:audit` (alias for `pnpm audit:prod`)
- `pnpm test:security`

Triggers: push `main`, weekly Monday 06:00 UTC, `workflow_dispatch`. Secret scan also runs in PR Check.

### Docs Check (`docs-check.yml`)

Supplemental only — PRs already run `pnpm docs:check` in `pr-check.yml`.

- `pnpm docs:check` — required files, Markdown structure
- Basic internal link scan (warnings only for broken relative links)

Triggers: push `main` when docs-related paths change, `workflow_dispatch`.

### Windows Installer (`windows-installer.yml`)

- Linux job: installer package build, typecheck, unit tests, scaffolding tests, dry-run
- Windows job: EXE build + artifact upload (3-day retention)
- Triggers: `workflow_dispatch`, `v*` tags, `release/**` branches — **not** on normal PRs

### Cursor Agent (`cursor-agent.yml`)

- Runs `pnpm ci:light` before push (not full `pnpm quality`)
- PR gate (`pr-check.yml`) validates the opened PR
- Full gate runs after merge to `main` via `ci.yml`
- Prefer `AGENT_JOBS_DEFAULT_PROVIDER=cursor_cli_local` or a self-hosted runner for routine agent work

## Local commands

| Script | Equivalent CI step |
|--------|-------------------|
| `pnpm ci:light` | PR gate: db:generate → lint → typecheck → test:ci → secret scan → docs |
| `pnpm ci:check` | Local fast path with release build: lint → typecheck → test:ci → build:release |
| `pnpm quality` | Full CI quality job (main gate) |
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

# Before merge / after large changes (matches main CI)
pnpm quality
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

### Docker build failures

Reproduce locally:

```bash
pnpm docker:build:ci
```

## What is blocking?

Only **`fast-checks`** in `pr-check.yml` should block PR merges.

Post-merge gates on `main` (CI, Security) catch issues after merge — run `pnpm quality` locally before merging when possible.

## Related

- `docs/engineering/self-hosted-ci.md` — Self-hosted Runner, Hardware, cost alternatives
- `AGENTS.md` — agent quality gate (local `pnpm quality` before push)
- `.cursor/skills/ci-quality-gate/SKILL.md` — detailed failure patterns
- `docs/AGENT_JOBS.md` — Cursor agent GitHub Actions integration
