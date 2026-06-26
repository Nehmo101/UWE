# Cleanup inventory

Risk-aware list of technical debt and split candidates. **No automatic deletion** — items here are reviewed before action.

## Done in cleanup 2026-06-26

- **Slug utilities centralised** → new package **`@uwe/shared-utils`**
  (`slugifyDe`, `slugifyAscii`, `slugifyKey`, `pickUniqueSlug`,
  `normalizeLookupKey`). `packages/database/src/slug-utils.ts` is now a thin
  re-export. Migrated: `page-templates`, `page-template-service`,
  `dungeon-cockpit`, `queries`, `mail-utils`, `@uwe/backup` `restore`,
  **`@uwe/auth` `content-access`, `@uwe/knoteforge-import` `slug`,
  `@uwe/agent-jobs` `slugifyBranch`**. Behaviour preserved (tests:
  `shared-utils/slug.test.ts`, database `slug-utils`/`page-templates`,
  auth suite, knoteforge parser; `slugifyAscii` proven equal to the legacy
  importer slug).
- **Removed dead code:** `apps/portal/src/components/AuthHeader.tsx` (Legacy auth
  chrome, replaced by `PortalAppShell`); `AdminSidebarBlock` +
  `apps/studio/src/lib/admin-sidebar-nav.ts` (orphaned after the nav refactor).
- **Archived** `deploy/linux/uwe-host.service` → `docs/archive/legacy-uwe-host-service.md`.
  Active systemd path is `deploy/systemd/uwe.service` + `deploy/scripts/setup-uwe-host.sh`.
- **Doc truth pass:** ARCHITECTURE/REPO_AUDIT/PRODUCTION/CI docs no longer present
  Docker or the Windows installer as active paths; RTX-Agent is deprecated in
  favour of the outbound RTX Host Connector. See `docs/removed-legacy-runtime.md`.

## Slug utilities — how the variants map

All slug logic now lives in `@uwe/shared-utils`; the cross-package cycle concern
is gone because the package sits below `auth`/`database` with no dependencies.

| Caller | Shared helper | Why this variant |
|--------|---------------|------------------|
| pages, worlds, templates, dungeons | `slugifyDe` | German display content, umlaut-expanding (`ä→ae`). |
| KnoteForge importer | `slugifyAscii` | ASCII transliteration (`ä→a`); preserves existing import slug stability (verified equal to the legacy function). |
| mail keys, `agent-jobs` branch names | `slugifyKey` | Machine keys; drops non-ASCII. |
| wikilink / lookup targets | `normalizeLookupKey` | Case-insensitive trim+lowercase. |

## Large services (split candidates)

| File | ~Lines | Suggested split |
|------|--------|-----------------|
| `packages/database/src/server.ts` | 1080+ | Domain-specific export modules; keep thin barrel |
| `packages/database/src/life-admin-service.ts` | 1000+ | `capture-service`, `hardware-service`, `personal-brain-service` |
| `packages/database/src/label-service.ts` | 870+ | Print pipeline vs template registry |
| `packages/database/src/repository.ts` | 860+ | Asset/session subgraphs |
| `packages/database/src/ai-review-service.ts` | 760+ | Apply strategies per task type |

Marking only — splits should be incremental PRs with unchanged public APIs.

### Recommended split plan (incremental, one PR each)

Public surface for all of these is the `@uwe/database/server` barrel — keep its
exported names stable so apps/tests do not change.

1. **`life-admin-service.ts`** → extract `capture-service.ts`,
   `hardware-service.ts`, `personal-brain-service.ts`. Keep `createLifeAdminService`
   as a thin facade re-exporting the same methods. Tests: `life-admin-service.test.ts`,
   `today-dashboard.test.ts`.
2. **`label-service.ts`** → split print pipeline (`label-print-*`) from the
   template/registry logic. Tests: `label-service.test.ts`, `label-editor.test.ts`,
   plus `label-safety` leak checks.
3. **`server.ts` barrel** → group re-exports into domain sub-barrels
   (`server/world.ts`, `server/ai.ts`, …) imported by `server.ts`; the public
   `@uwe/database/server` path stays identical. Tests: full `pnpm typecheck` + app build.
4. **`ai-review-service.ts`** → one apply-strategy module per task type behind a
   registry. Tests: `ai-review-service.test.ts`, `privacy.test.ts`.
5. **`repository.ts`** → carve out asset and session subgraphs
   (`asset-repository.ts` already exists; move session graph next). Tests:
   `asset.test.ts`, visibility/security suites.

Order rationale: start with the most self-contained domain (life-admin), end with
`repository.ts` which the most code depends on.

## Barrel files

27 `index.ts` / `server.ts` barrels across packages. Apps should import from `@uwe/database/server`, not `@uwe/database` (Phase-1 in-memory wiki).

| Barrel | Notes |
|--------|-------|
| `packages/database/src/server.ts` | Primary app surface — grows with every feature |
| `packages/database/src/index.ts` | Phase-1 in-memory wiki barrel (test-only) |
| `packages/ai-brain/src/index.ts` | Large public API — document subpaths before splitting |

## Legacy / dual-path (not dead)

| Path | Status |
|------|--------|
| `packages/database/src/store.ts`, `seed.ts` | Phase-1 in-memory wiki; test-only |
| `schema.prisma` + `schema.postgresql.prisma` | Intentional dual schema |
| `terra-seed.ts` vs `seed.ts` SEED_PAGES | Terra is canonical rich seed |

## Shell V1/V2 consolidation (follow-up)

Design V2 is **default-on** (`isDesignV2Enabled`, opt-out via
`NEXT_PUBLIC_UWE_DESIGN_V2=false`). The V1 shells are legacy/compatibility only.

- **Canonical:** `*V2` shells (`AppShellV2`, `StudioShellV2`, `PortalShellV2`,
  `AdminShellV2`, …) — exported from `@uwe/shared-ui`.
- **Legacy:** `StudioShell`, `PortalShell`, `AdminShell`, `AppShell` — JSDoc
  `@deprecated`; still rendered when Design V2 is disabled.
- App-level wrappers (`StudioAppShell` vs `StudioAppShellV2`,
  `AdminModuleShell`, `WorldModuleShell`, `PortalAppShell`) currently branch on
  `isDesignV2Enabled()`.

**Follow-up (not done here — too broad for a safe single PR):** extract shared
logic (breadcrumb/header rendering, world-section building, campaign-link
adjustment, default-open sections, bottom-nav key resolution) into helpers so V1/V2
become thin renderers; then retire V1 once Design V2 has soaked. Must not regress
the reduced IA (Heute · Welten · Erstellen · Medien & KI · System).

## wiki-engine — retired (2026-06-26)

`@uwe/wiki-engine` was **removed**. It was a standalone wiki-link utility consumed
**only by its own tests**; production wiki-link handling lives in `@uwe/database`
(`world-inspector`, `graph-service`, `inspector-fix-service`, …) and apps render
via `@uwe/database/server`. No app, build config or other package imported it.

Remaining Phase-1 follow-up: the in-memory `@uwe/database` layer
(`index.ts` / `store.ts` / `queries.ts`) is still test-only and imported by no app.
Retire or migrate its tests to Prisma fixtures in a later pass.

## Config duplicates (resolved / watch)

| Item | Status |
|------|--------|
| Duplicate `pnpm.overrides` in root `package.json` | **Merged** (single `nodemailer` override) |
| 26 `tsconfig.json` files | Expected monorepo pattern |

## Dead file detection

Run before major cleanup:

```bash
# Orphan source (manual review — not all unused exports are dead)
rg -l "from \"./" packages/database/src | head

# Tests inventory-guard critical security modules
pnpm test:leaks
```

Do not delete files only because they lack importers — CLI scripts and seeds may be entry points.

## Performance / tags (this batch)

| Added | Purpose |
|-------|---------|
| `stress-seed.ts`, `db:seed:stress` | Realistic scale data |
| `tag-service.ts` | Merge, unused, suggestions |
| `perf-smoke.test.ts` | CI performance gate |
| `migration-check.mjs` | Prisma migration folder sanity |

## Related

- `docs/REPO_AUDIT.md`
- `docs/FEATURE_MATURITY_MATRIX.md`
- `docs/engineering/performance.md`
