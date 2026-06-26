# UWE Cleanup Report — 2026-06-26

Branch: `claude/uwe-repo-cleanup-kgjf1k`

Goal: bring the repo to a tidy, consistent, production-near state — correct stale
docs, remove safe legacy remnants, centralise slug logic, and resolve the open
follow-ups — without breaking the active product path (Linux Host + `pnpm`/`systemd`
+ optional outbound RTX Host Connector).

This report covers both the initial cleanup pass and the follow-up pass that
implemented the deferred items.

---

## 1. Summary

- **Docs tell the truth about the runtime.** ARCHITECTURE, REPO_AUDIT, PRODUCTION
  (fully rewritten), the host startup doc, backup-restore and the CI engineering
  docs no longer present Docker or the Windows one-click installer as active paths.
  Canonical path: Linux Host + `systemd` (`deploy/systemd/uwe.service`,
  `deploy/scripts/setup-uwe-host.sh`), optional Cloudflare Tunnel.
- **RTX framing is consistent.** Outbound **RTX Host Connector** is the go-forward
  inference path everywhere; the inbound **RTX-Agent** (`RTX_AGENT_URL`) is
  deprecated compatibility only.
- **Slug logic fully centralised** into a new **`@uwe/shared-utils`** package and
  migrated across `database`, `auth`, `knoteforge-import`, `agent-jobs` and
  `backup` — behaviour preserved (verified).
- **`@uwe/wiki-engine` retired** — it was consumed only by its own tests;
  production wiki-links live in `@uwe/database`.
- **Safe dead code removed:** legacy `AuthHeader`, the orphaned `AdminSidebarBlock`
  + `admin-sidebar-nav.ts`, and the deprecated `deploy/linux/uwe-host.service`
  (archived).

---

## 2. Changed / new files

**New**

| File | Purpose |
|------|---------|
| `packages/shared-utils/*` | New framework-agnostic package: `slugifyDe`, `slugifyAscii`, `slugifyKey`, `pickUniqueSlug`, `normalizeLookupKey` (+ tests). |
| `docs/archive/legacy-uwe-host-service.md` | Archive of the deprecated `uwe-host.service`. |
| `docs/engineering/cleanup-report-2026-06-26.md` | This report. |

**Changed (code)**

| File | Change |
|------|--------|
| `packages/database/src/slug-utils.ts` | Thin re-export of `@uwe/shared-utils` (keeps `@uwe/database/server` surface stable). |
| `packages/database/src/{page-templates,page-template-service,dungeon-cockpit,queries,mail-utils}.ts` | Use the shared slug helpers. |
| `packages/database/src/index.ts` | Phase-1 barrel comment clarified (test-only; apps use `/server`). |
| `packages/backup/src/restore.ts` | Local `resolveUniqueSlug` → shared `pickUniqueSlug`. |
| `packages/auth/src/content-access.ts` | `normalizeLookupKey` from `@uwe/shared-utils`. |
| `packages/knoteforge-import/src/slug.ts` | Re-exports/wraps `slugifyAscii` + `pickUniqueSlug` + `normalizeLookupKey`. |
| `packages/agent-jobs/src/index.ts` | `slugifyBranch` uses shared `slugifyKey`. |
| `apps/studio/components/AdminModuleShell.tsx` | Removed `AdminSidebarBlock` + unused imports. |
| `packages/shared-ui/src/index.ts` | Documented canonical (V2) vs legacy (V1) shells; `@deprecated` on V1. |
| `packages/{database,auth,knoteforge-import,agent-jobs}/package.json`, `pnpm-lock.yaml` | Add `@uwe/shared-utils`; remove `@uwe/wiki-engine`. |
| `scripts/selfhost.test.ts` | Asserts the archived doc instead of the removed service file. |

**Changed (docs)**

`docs/ARCHITECTURE.md`, `docs/REPO_AUDIT.md`, `docs/PRODUCTION.md` (full rewrite),
`docs/UWE_HOST_LINUX_STARTUP.md`, `docs/backup-restore.md`,
`docs/engineering/{ci,self-hosted-ci,migration-from-copilot,cleanup-inventory,TECHNICAL_ROADMAP}.md`,
`CLAUDE.md`, `README.md`.

## 3. Removed files / functions

- **Deleted package** `packages/wiki-engine/` (`@uwe/wiki-engine`) — only self-tested;
  production wiki-links live in `@uwe/database`.
- **Deleted files** `apps/portal/src/components/AuthHeader.tsx`,
  `apps/studio/src/lib/admin-sidebar-nav.ts`.
- **Removed export** `AdminSidebarBlock`.
- **Archived (moved)** `deploy/linux/uwe-host.service` → `docs/archive/legacy-uwe-host-service.md`.
- **Inlined into `@uwe/shared-utils`** (per-package duplicates removed): the slug
  bodies in `page-templates`, `page-template-service`, `dungeon-cockpit`, `queries`,
  `mail-utils`, `backup/restore`, `auth/content-access`, `knoteforge-import/slug`,
  `agent-jobs/slugifyBranch`.

## 4. Checks / test results

The repo build runs in a **degraded environment**: `pnpm install --frozen-lockfile`
aborts during the `@prisma/engines` postinstall (`ECONNRESET` — the Prisma engines
download host is reset/blocked by the session egress policy). Without it the
generated Prisma client never exists and the right `node_modules/.bin` shims
(eslint, prisma) are not linked. Workspace packages were linked with
`pnpm install --ignore-scripts` so the new package resolves at runtime.

| Check | Result | Notes |
|-------|--------|-------|
| `@uwe/shared-utils` slug tests | ✅ 6/6 | Incl. `slugifyAscii` == legacy importer slug (proven over 9 inputs). |
| database `slug-utils` + `page-templates` | ✅ 12/12 | Re-export path + behaviour preservation. |
| `@uwe/auth` suite | ✅ 149/149 | Covers the `content-access` migration. |
| `@uwe/knoteforge-import` parser | ✅ 5/5 | (`importer.test.ts` needs the Prisma client → blocked.) |
| `@uwe/agent-jobs` | ✅ 5/5 | `slugifyBranch` migration. |
| `scripts/selfhost.test.ts` | ✅ 11/11 | Archive + active `uwe.service` + host scripts. |
| `docs:check` | ✅ | 112 markdown files, no broken links after the doc rewrites. |
| `secret:scan` | ✅ | Clean. |
| TS transpile (all changed `.ts/.tsx`) | ✅ | Syntax-clean (caught one real bug during the first pass, fixed). |
| `pnpm lint` | ⚠️ blocked | Resolved ESLint 10.1.0 vs `eslint-config-next@15.5.19` (`@rushstack/eslint-patch` cannot patch ESLint 10); `.bin/eslint` not linked by the aborted install. Lockfile pins `eslint@9.39.4`. Not caused by this cleanup. |
| `pnpm typecheck` / `pnpm test` / `build:release` | ⚠️ blocked | Need the generated Prisma client. |

Full gate to run on an unrestricted network:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:security && pnpm build:release
```

## 5. Remaining follow-up tasks

These three are larger refactors that move/integrate runtime code and therefore
need a **runnable `pnpm typecheck` + build** to land safely — which the Prisma
engine block currently prevents (even additive code must pass `tsc`). Precise
plans are in `docs/engineering/cleanup-inventory.md`:

1. **Large-service splits** — incremental, one PR each:
   `life-admin-service` → `label-service` → `server.ts` barrel → `ai-review-service`
   → `repository.ts`, keeping the `@uwe/database/server` surface stable.
2. **Shell V1/V2 consolidation** — extract shared shell logic (breadcrumb/header,
   world-section building, default-open sections, bottom-nav key resolution) so V1/V2
   become thin renderers, then retire V1 once Design V2 has soaked. Must preserve the
   reduced IA (Heute · Welten · Erstellen · Medien & KI · System).
3. **AI-Brain connector queue adapter** — implement `connectorQueueProvider` per
   `docs/ai-brain-connector-migration.md`, then demote `RTX_AGENT_URL`. The inbound
   RTX-Agent stays wired (`localRtxProvider`, `rtxHealthcheck`,
   `/api/inference/hardware`) until this adapter replaces it, so it is intentional
   deprecated compatibility — not dead code.

Phase-1 in-memory `@uwe/database` layer (`index.ts`/`store.ts`/`queries.ts`) remains
test-only (no app imports it); retire or migrate its tests to Prisma fixtures later.
