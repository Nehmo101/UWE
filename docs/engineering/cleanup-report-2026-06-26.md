# UWE Cleanup Report — 2026-06-26

Branch: `claude/uwe-repo-cleanup-kgjf1k`

Goal: bring the repo to a tidy, consistent, production-near state — correct stale
docs, remove safe legacy remnants, start centralising slug logic, and document
follow-ups — without big-bang refactors and without breaking the active product
path (Linux Host + `pnpm`/`systemd` + optional outbound RTX Host Connector).

---

## 1. Summary

- **Docs now tell the truth about the runtime.** ARCHITECTURE, REPO_AUDIT,
  PRODUCTION, the host startup doc and the CI engineering docs no longer present
  Docker or the Windows one-click installer as active paths. The canonical path is
  Linux Host + `systemd` (`deploy/systemd/uwe.service`,
  `deploy/scripts/setup-uwe-host.sh`), optionally fronted by a Cloudflare Tunnel.
- **RTX framing is consistent.** The outbound **RTX Host Connector** is the
  go-forward inference path everywhere; the old inbound **RTX-Agent**
  (`RTX_AGENT_URL`) appears only as deprecated compatibility. (README and
  `.env.example` already said this; ARCHITECTURE/REPO_AUDIT now match.)
- **Safe dead code removed:** legacy `AuthHeader` portal component, the orphaned
  `AdminSidebarBlock` + `admin-sidebar-nav.ts`, and the deprecated
  `deploy/linux/uwe-host.service` (archived, not just deleted).
- **Slug logic centralised** into `packages/database/src/slug-utils.ts` and the
  low-risk call sites migrated, with behaviour preserved (verified by tests).
- **Follow-ups documented** for shell V1/V2 consolidation, `@uwe/wiki-engine`
  disposition, large-service splits, and the riskier slug call sites.

---

## 2. Changed files

| File | Change |
|------|--------|
| `docs/ARCHITECTURE.md` | Deployment flow rewritten to Linux Host + systemd (no Docker/Windows branches); repo-hierarchy shows `uwe-rtx-connector`/`uwe-rtx-agent`/`deploy/` instead of `windows-installer`; RTX-Agent → RTX Host Connector throughout; date bumped. |
| `docs/REPO_AUDIT.md` | "Historical snapshot" banner + current sources of truth; project structure fixed (no `docker-compose.yml`/`windows-installer`); Image Studio & Calendar corrected from "not implemented" to existing Phase-2 features; CI workflow table corrected (no `windows-installer.yml`); feature list + RTX section corrected. |
| `docs/PRODUCTION.md` | Deprecation banner; Linux host is the recommended path; "Voraussetzungen" → Node 22 + pnpm + systemd; Windows/Docker quickstart marked historical. |
| `docs/UWE_HOST_LINUX_STARTUP.md` | Tech-ref row points to the archived service; removed stale `docker compose up -d` line. |
| `docs/backup-restore.md` | Removed Windows-installer CLI (`tools/windows-installer/dist/cli.js`) and `pnpm backup`; now Studio/`pnpm backup:create`/`deploy/scripts/uwe-backup.sh` + Linux paths. |
| `docs/engineering/ci.md` | Removed the non-existent `windows-installer.yml` workflow rows/section. |
| `docs/engineering/self-hosted-ci.md` | Removed `windows-installer.yml` / `build-exe` references. |
| `docs/engineering/migration-from-copilot.md` | Workflow list corrected (no windows packaging; added `deploy.yml`). |
| `docs/engineering/cleanup-inventory.md` | Added: done-list, slug follow-ups, large-service split plan, shell V1/V2 follow-up, wiki-engine disposition. |
| `packages/database/src/slug-utils.ts` | **New** central slug module. |
| `packages/database/src/slug-utils.test.ts` | **New** tests. |
| `packages/database/src/page-templates.ts` | `slugifyPageTitle` → `slugifyDe`; `pickUniqueSlug` re-exported from slug-utils. |
| `packages/database/src/page-template-service.ts` | Local `slugifyTemplateName` → `slugifyDe`. |
| `packages/database/src/dungeon-cockpit.ts` | Local `slugifyTitle` → `slugifyDe(…, { maxLength: 80, fallback: "entity" })`. |
| `packages/database/src/mail-utils.ts` | `slugifyMailKey` → `slugifyKey(value, fallback, { maxLength: 80 })`. |
| `packages/database/src/queries.ts` | `normalizeLookupKey` now from slug-utils (re-exported). |
| `packages/backup/src/restore.ts` | Local `resolveUniqueSlug` → shared `pickUniqueSlug`. |
| `apps/studio/components/AdminModuleShell.tsx` | Removed `AdminSidebarBlock` + now-unused imports. |
| `packages/shared-ui/src/index.ts` | Documented canonical (V2) vs legacy (V1) shells; `@deprecated` on V1 exports. |
| `packages/wiki-engine/src/index.ts` | Status note: standalone utility; disposition tracked in cleanup-inventory. |
| `scripts/selfhost.test.ts` | Asserts the archived doc instead of the removed service file. |
| `docs/archive/legacy-uwe-host-service.md` | **New** archive of the deprecated unit. |

## 3. Removed files / functions

- **Deleted file** `apps/portal/src/components/AuthHeader.tsx` — legacy auth chrome;
  not imported anywhere (auth layouts use `PortalAppShell`).
- **Deleted file** `apps/studio/src/lib/admin-sidebar-nav.ts` — orphaned after the
  navigation refactor; its only consumer was `AdminSidebarBlock`.
- **Removed export/function** `AdminSidebarBlock` in `AdminModuleShell.tsx` (and the
  now-unused `adminSidebarNav` / `SidebarNav` / `SidebarSection` imports).
- **Moved (not lost)** `deploy/linux/uwe-host.service` → `docs/archive/legacy-uwe-host-service.md`.
- **Inlined/removed local helpers** (behaviour folded into `slug-utils.ts`):
  `slugifyPageTitle` body, `pickUniqueSlug` body (page-templates),
  `slugifyTemplateName` (page-template-service), `slugifyTitle` (dungeon-cockpit),
  `slugifyMailKey` body (mail-utils), `normalizeLookupKey` body (queries),
  `resolveUniqueSlug` (backup/restore).

## 4. Checks / test results

Verification ran in a **degraded environment**: `pnpm install --frozen-lockfile`
aborted during the `@prisma/engines` postinstall with `ECONNRESET` (the Prisma
engines download host is reset/blocked by the session egress policy). That left
the dependency tree incomplete — the generated Prisma client was never produced
and several `node_modules/.bin` shims (eslint, prisma) were not linked. This is an
**environment limitation, independent of the cleanup changes.**

| Check | Result | Notes |
|-------|--------|-------|
| `slug-utils.test.ts` | ✅ 5/5 pass | New central slug behaviour. |
| `page-templates.test.ts` | ✅ 7/7 pass | Confirms slug migration is behaviour-preserving. |
| `scripts/selfhost.test.ts` | ✅ 11/11 pass | Confirms `uwe-host.service` archive + active `uwe.service` + host scripts. |
| TS transpile/syntax check (all 10 changed source files) | ✅ clean | Caught and fixed one real bug (see Risks). |
| `pnpm lint` | ⚠️ blocked | Resolved ESLint 10.1.0 vs `eslint-config-next@15.5.19` (`@rushstack/eslint-patch` cannot patch ESLint 10); `.bin/eslint` not linked by the aborted install. Lockfile correctly pins `eslint@9.39.4`. Not caused by this cleanup. |
| `pnpm typecheck` | ⚠️ blocked | Needs `packages/database/src/generated/prisma/*`, which requires `prisma generate`; engine download is blocked. |
| `pnpm test` / `test:ci` / `test:security` | ⚠️ blocked | Most suites import the runtime Prisma client. |
| `pnpm build:release` | ⚠️ blocked | Needs the generated Prisma client. |

To complete the full gate on an unrestricted network:

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:security && pnpm build:release
```

## 5. Remaining follow-up tasks

Tracked in `docs/engineering/cleanup-inventory.md`:

1. **Slug** — migrate the riskier call sites only with guardrails:
   `knoteforge-import/src/slug.ts` (diacritic-strip vs umlaut-expand → re-import
   idempotency), `auth/content-access.ts` `normalizeLookupKey` (would create an
   `@uwe/database`→`@uwe/auth` cycle), `agent-jobs` `slugifyBranch` (git-branch domain).
2. **Shells** — extract shared shell logic so V1/V2 become thin renderers, then
   retire V1 once Design V2 has soaked. Must preserve the reduced IA.
3. **wiki-engine** — wire `@uwe/wiki-engine` into the live render/backlink path, or
   retire it with the Phase-1 in-memory `@uwe/database` layer.
4. **Large services** — incremental splits in this order: `life-admin-service` →
   `label-service` → `server.ts` barrel → `ai-review-service` → `repository.ts`,
   keeping the `@uwe/database/server` surface stable.
5. **AI Brain connector adapter** — implement `connectorQueueProvider` per
   `docs/ai-brain-connector-migration.md`, then demote `RTX_AGENT_URL`.

## 6. Deliberately not done / notes

- **No service deletion of the RTX-Agent or `@uwe/wiki-engine`** — both are still
  wired or intentionally retained; only re-framed/annotated and scheduled as
  follow-ups (avoids breaking existing setups / removing features in use).
- **PRODUCTION.md was banner-corrected, not fully rewritten** — its deeper
  Docker/volume sections remain as clearly-marked historical reference to avoid a
  risky large rewrite. The canonical deployment doc is `UWE_HOST_LINUX_STARTUP.md`.
- **WP8 (portal `/portal` subpath, UX)** — no code change needed: `PORTAL_PATH` /
  `STUDIO_PATH` config + Studio middleware rewrite already exist, and the portal
  already handles a missing world gracefully (`notFound()` + `EmptyState`).
- **One self-inflicted bug was found and fixed during verification**: the scripted
  removal of `resolveUniqueSlug` in `restore.ts` initially left a dangling
  `${index}`;` fragment (a `}` inside a template literal confused the boundary
  search). Caught by the transpile check and corrected before finishing.
