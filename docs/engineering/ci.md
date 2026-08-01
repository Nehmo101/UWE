# CI — Workflows, Scripts, and Debugging

Stand: 2026-07-05

UWE uses **pnpm** (lockfile: `pnpm-lock.yaml`, `packageManager: pnpm@10.12.1`) and **Turbo** for the monorepo. CI runs on **Node 22** in GitHub Actions.

## Caching and job timeouts

Hosted jobs restore **pnpm store**, **Turbo** (`.turbo/`), **Next.js build** caches (`.next/cache`), and **Playwright browsers** (`~/.cache/ms-playwright`) via `actions/cache`. Cache keys are keyed by **lockfile hash** so PR and main runs reuse caches across commits until dependencies change.

PR gate runs **`file-size:check`** first (~5 s, no install), then a single **`fast-checks`** job (lint + affected gate + optional Studio build). Main gate runs full `pnpm quality`.

| Job | Timeout | Typical warm duration |
|-----|---------|----------------------|
| PR `fast-checks` | 35 min | ~6–18 min |
| Main `quality` | 50 min | ~10–20 min |
| Main `e2e-auth-smoke` | 20 min | ~3–8 min (warm Playwright cache) |
| `postgres-smoke` | 15 min | ~3–5 min |
| `e2e` (scheduled/manual) | 30 min | ~15–25 min |
| `security-*` | 20 min | ~5–10 min |
| `shellcheck` | 5 min | ~1 min (deploy scripts only) |
| `fedora-host-smoke` | 10 min | ~1–3 min (only host/deploy changes; also scheduled/manual on main) |
| `rust` | 20 min | ~2–5 min (nur bei Änderungen am Tauri-Client; `cargo fmt --check` + `clippy -D warnings`) |

## Cost strategy

GitHub-hosted minutes are reserved for **cheap PR feedback**. Expensive checks run on **`main`**, on a **schedule**, or **manually** — not on every pull request.

| Event | Workflow | Gate |
|-------|----------|------|
| **Pull request** | `pr-check.yml` | `file-size:check` + lint + `ci:light:pr:gate` (affected typecheck/test, secret scan, docs) + optional Studio build + Fedora 44 smoke for host/deploy changes |
| **Push `main`** | `ci.yml` | Full `pnpm quality` + PostgreSQL smoke (when DB paths change) |
| **Sunday 03:00 UTC / manual** | `ci.yml` | E2E + performance budget checks |
| **Monday 06:00 UTC / manual** | `security.yml` | Secret scan, prod audit, security tests |
| **Push `main` (docs paths)** | `docs-check.yml` | Supplemental link scan (not a PR gate) |
| **CI success on `main`** | — | Kein automatischer Deploy mehr (Host stillgelegt, Workflow entfernt) |

## Workflows

| Workflow | File | Trigger | Purpose | Required on PR? |
|----------|------|---------|---------|-----------------|
| **PR Check** | `.github/workflows/pr-check.yml` | All PRs | Cheap gate: `pnpm ci:light` + lockfile check | **Yes** |
| **CI** | `.github/workflows/ci.yml` | Push `main`, weekly schedule, manual | Full `pnpm quality`, Postgres smoke; E2E on schedule/manual only | No |
| **Security** | `.github/workflows/security.yml` | Weekly Monday, manual | Audit + security tests (secret scan also in PR via `ci:light`) | No |
| **Docs Check** | `.github/workflows/docs-check.yml` | Push `main` (docs paths), manual | Supplemental link scan | No |
| **UWE Windows Release** | `.github/workflows/uwe-windows-release.yml` | Manual | Build Command Center NSIS/MSI + publish GitHub Release `uwe-v*` | No |

> The former `windows-installer.yml` workflow (Docker/one-click path) was removed
> (see [removed-legacy-runtime.md](../removed-legacy-runtime.md)). Active Windows
> releases are the Command Center installers from **UWE Windows Release**.

### Branch protection (recommended)

**Integration model:** Keep **`main` as the only integration branch**. Do not add a standing `dev` branch or daily batch merges — PRs already provide isolation, and a dev→main promotion adds latency without fixing the real issues (file-size discipline, branch protection). Instead:

- **Block direct pushes to `main`** (Settings → Branches → require pull requests).
- **Require status check:** `fast-checks` only (lint runs inside this job since 2026-07).
- Optional: enable GitHub **merge queue** when many agent PRs land in bursts (reduces cancelled main CI runs).

**Required status checks** — only these should block merges:

- `fast-checks` (lint + affected gate + optional Studio build in `pr-check.yml`)

**Do not mark as required** (path-filtered, expensive, or post-merge gates):

- `quality`, `e2e`, `postgres-smoke` (CI on `main` / scheduled)
- `security-scan`, `security-tests` (Security — weekly/manual only)
- `docs` (Docs Check)

Configure in GitHub: **Settings → Branches → Branch protection rules → `main` → Require status checks**.

### PR Check (`pr-check.yml`)

The only automatic workflow on pull requests:

1. **`detect-changes`** — path filter (docs-only vs code; Studio build and host/deploy scope)
2. **`fedora-host-smoke`** — Fedora 44 container validates OS/package mapping, exact Node.js 22 RPM names and Bash syntax when host/deploy paths change
3. **`fast-checks`** — required aggregation job; fails when change detection or the
   conditional Fedora smoke fails. Docs-only PRs run `node scripts/docs-check.mjs`
   without installing dependencies; code PRs then run:
   - `node scripts/file-size-budget-check.mjs` — fail in ~5 s before install
   - Restore pnpm store + Turbo caches
   - `pnpm lint` then `pnpm ci:light:pr:gate` — db:generate, **affected** typecheck/test, secret scan, docs:check
   - **Studio production build** only when diff touches `apps/studio/**`, `packages/**`, lockfile, or `turbo.json`

`turbo.json` no longer runs `^build` before `typecheck`/`test` (tsc and node tests do not need compiled package outputs). Main-only `build:release` still builds Studio and Portal.

A third app, **Brain** (`@uwe/brain`, port `:3002`, owner-only/local — see [brain-local-runtime.md](brain-local-runtime.md)), participates automatically in `turbo run typecheck`/`test`/`build` via the generic task graph. The static **product-boundary guard** (`node scripts/product-boundary-check.mjs`, wired into `test`/`test:ci`) fails any app→app or package→app import. Deploy, systemd, firewall and Cloudflare stay Studio+Portal only — Brain is never auto-exposed.

No `pnpm quality`, no E2E, no security tests, no release build on PRs.

### CI (`ci.yml`)

Runs on push to `main`, weekly schedule (Sunday 03:00 UTC), or `workflow_dispatch`:

1. Fedora 44 host smoke when host/deploy paths changed (and on schedule/manual)
2. `file-size:check` (no install)
3. Install with frozen lockfile; restore pnpm store + Turbo + Next.js build caches
4. `pnpm quality` — full gate:
   - Prisma client generate
   - Lint (zero warnings)
   - Secret scan
   - Typecheck
   - Unit + integration tests
   - Security tests
   - Production dependency audit (high+)
   - Release build
5. **PostgreSQL smoke** (`pnpm test:postgres-smoke`) — migrate deploy + smoke tests against a Postgres 16 service container; runs after quality when `packages/database/**` or `**/*postgres*` changed, or on schedule / manual dispatch
6. **E2E tests + performance budget** (`pnpm test:e2e`, `pnpm test:e2e:perf`, `perf-budget-check.mjs`) — Playwright; runs only on `workflow_dispatch` or `schedule`, **not** on every push to `main`

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

## Local commands

| Script | Equivalent CI step |
|--------|-------------------|
| `pnpm ci:light` | Local full PR mirror: db:generate → lint → typecheck → test:ci → secret scan → docs |
| `pnpm ci:light:pr` | Local full PR mirror incl. lint |
| `pnpm ci:light:pr:gate` | Same as CI `fast-checks` job (affected packages, no lint) |
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

## Test coverage (on-demand)

Coverage is **not** part of any CI gate — it is a local analysis tool with zero extra dependencies, built on Node 22's `node --test --experimental-test-coverage` (V8 coverage; tsx source maps are resolved, so the report shows `.ts` files with correct line numbers).

```bash
node scripts/coverage.mjs                          # default: packages/database
node scripts/coverage.mjs packages/calendar        # one package
node scripts/coverage.mjs packages/shared-utils apps/rtx-connector-client   # several
```

The script collects `*.test.ts(x)` files per package (under `src/`, or the package root for packages without `src/` such as `packages/config`), runs them with coverage, prints Node's per-file table, and exits non-zero if any package's tests fail.

**Caveats:**

- V8 only instruments **loaded** modules: a file that no test imports does not appear in the report at all. "all files 100%" therefore does not mean the whole package is covered — check that the files you care about are listed.
- Imported **workspace dependencies** (source exports) also show up in the report (as `../..` paths) and are counted in the "all files" summary — read the per-file rows for the package you are measuring.
- Branch coverage on tsx-transformed code can be slightly stricter than the source suggests (helper branches injected by the transform); line and function coverage are reliable.
- `packages/database` runs its full test suite under coverage — expect it to be slow.

## Turbo task graph (typecheck/test)

Workspace packages consume each other **directly from TypeScript source** (`"main"`/`"exports"` point at `./src/index.ts`); there is no `dist/` build step between packages. Two consequences for `turbo.json`:

- **No `^build` needed for `typecheck`/`test`** — there is nothing to build first.
- **But dependency sources must be part of the task hash.** Turbo does *not* automatically include an internal dependency's files in a task's cache hash; without a topological edge, editing `packages/shared-utils/src/*` would produce a **stale cache hit** for dependents' `test`/`typecheck`. This was verified empirically with `turbo run test --dry=json` (task hash unchanged after editing a dependency) on Turbo 2.9.
- Therefore `turbo.json` uses the standard synthetic **`topo` pattern**: `"topo": { "dependsOn": ["^topo"] }` plus `"typecheck"/"test": { "dependsOn": ["topo"] }`. `topo` matches no real script (it is a free no-op) and only propagates dependency file hashes into the cache key.

**Prisma:** `turbo run test` does **not** model the Prisma client generation. The generated client (`packages/database/src/generated/prisma*`) is gitignored and thus not hashed, but it is deterministic from `prisma/schema*.prisma`, which *is* hashed. All root scripts (`test`, `test:ci`, `ci:*`, `quality`) run `pnpm --filter @uwe/database db:generate` **before** `turbo run test` — keep that ordering when adding new root scripts; a bare `turbo run test` on a fresh checkout fails until `db:generate` has run once.

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

### Observed cost drivers (2026-07)

From GitHub Actions usage on a busy agent day (~200 runs):

| Workflow | Share of minutes | Notes |
|----------|------------------|-------|
| **PR Check** | ~57% | ~10–16 min/run; ~40% failure/cancel rate wastes minutes |
| **CI (main)** | ~30% | Full `pnpm quality`; build failures after ~10 min are costly |
| **Copilot review** | ~12% | Runs on many PRs in parallel with PR Check |
| **Deploy / Docs** | ~1% | Deploy is self-hosted; Docs Check is cheap |

**Mitigations in place:** lint fail-fast job, affected-package PR gate, Turbo cache keyed by lockfile, no `^build` before typecheck/test, shellcheck only when deploy scripts change, Rust checks only when the Tauri client changes, concurrency cancel on PR pushes (avoids duplicate green runs but wastes minutes when agents push faster than CI finishes).

**Manual levers:** reduce agent push frequency per branch; disable Copilot auto-review on `cursor/*` branches if not needed; batch merges to `main` to avoid duplicate full gates.

## Related

- `docs/engineering/self-hosted-ci.md` — historical / optional reference (self-hosted runner, hardware) — **not** the active gate
- `AGENTS.md` — agent gate (GitHub Cloud CI authoritative; local `pnpm quality` optional pre-check)
- `.cursor/skills/ci-quality-gate/SKILL.md` — detailed failure patterns

## `turbo.json` → `globalPassThroughEnv`

turbo läuft seit v2 im **strikten Umgebungsmodus**: an einen Task gehen nur
Variablen, die in `env` oder `globalPassThroughEnv` stehen. Alles andere wird
weggefiltert, auch wenn es in der Shell gesetzt ist.

Hinter einem TLS-terminierenden Proxy — so laufen die Cloud-Sitzungen dieses
Projekts — kostet das den Build: `next/font` holt Space Mono und Newsreader zur
Bauzeit von Google Fonts, verliert unter turbo die Zertifikatseinstellung und
bricht mit `SELF_SIGNED_CERT_IN_CHAIN` ab. Derselbe Build läuft einzeln über
`pnpm --filter @uwe/studio build` fehlerfrei durch, was die Ursache gut
versteckt.

Diese Namen gehen deshalb durch:

```
NODE_EXTRA_CA_CERTS  SSL_CERT_FILE  SSL_CERT_DIR  REQUESTS_CA_BUNDLE
HTTPS_PROXY  https_proxy  NO_PROXY  no_proxy
```

Zwei Eigenschaften, die den Eintrag unbedenklich machen: `globalPassThroughEnv`
fließt **nicht** in den Cache-Schlüssel ein (das tut nur `env`), und wo die
Variablen nicht gesetzt sind — GitHub Actions, lokale Entwicklung ohne Proxy —
ändert er nichts.
