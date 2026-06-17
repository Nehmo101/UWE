# Recurring CI failure patterns (UWE)

Derived from GitHub Actions `quality` job logs on agent PRs (2026-06).

## Pattern A — Lint: unused imports (most common)

**Symptom:** CI fails at `pnpm lint` in ~1 minute.

**Example errors:**

```
error  'emailSchema' is defined but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars
error  'requireStudioApiAuth' is defined but never used ...
```

**Typical files:** new API routes, security tests, server actions.

**Fix:** Delete unused imports or prefix with `_`. Run `pnpm lint` locally.

**Prevention:** Run `pnpm quality` before push; do not stop after `typecheck` alone.

---

## Pattern B — Typecheck: wrong auth import

**Symptom:** CI fails at `pnpm typecheck`, package `@uwe/auth`.

**Example error:**

```
src/security/middleware.ts(5,3): error TS2305: Module '"../runtime-config"' has no exported member 'SESSION_COOKIE_NAME'.
```

**Cause:** Agent imports `SESSION_COOKIE_NAME` from `runtime-config` while editing middleware next to `getUweRuntimeConfig`.

**Fix:** Import from `../session` or `@uwe/auth`.

**Note:** `runtime-config` re-exports cookie names for backward compatibility, but prefer `session` in new code.

---

## Pattern C — Typecheck: missing Prisma generate

**Symptom:** Cannot find module `./generated/prisma/client`.

**Fix:** `pnpm --filter @uwe/database db:generate` — included in `pnpm quality`.

---

## Pattern D — Broken main blocks unrelated PRs

**Symptom:** Docs-only PR fails typecheck on unrelated package.

**Cause:** `main` already has a type error from a prior merge.

**Fix:** Repair `main` first (auth imports, exports), then rebase agent branches.

---

## CI step order (`.github/workflows/ci.yml`)

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @uwe/database db:generate`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm build:release`

Local equivalent: `pnpm quality` (after install).
