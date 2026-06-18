# Code Cleanup Report (2026-06-18)

Scope: safe reduction pass on `apps/studio`, `apps/portal`, and shared packages. No feature removals.

## Entfernt

| Item | Reason |
|------|--------|
| `apps/studio/src/lib/backup-auth.ts` | Superseded by `@uwe/security` (`requireStudioApiAuth`, `guardStudioMutation`) in backup API routes; never imported in production |
| `apps/studio/src/lib/backup-auth.test.ts` | Tests for removed module |
| `apps/studio/src/lib/backup-api-auth.test.ts` | Tests for removed module |
| `studioLegacyBottomNav()` in `mobile-nav.ts` | Deprecated; only referenced by its own test |
| `@uwe/wiki-engine` from `apps/studio` and `apps/portal` `package.json` | No production imports in either app; package retained for its own unit tests |

## Zusammengeführt

| Change | Detail |
|--------|--------|
| Date formatting | Added `formatStudioDateTime()` in `apps/studio/src/lib/format.ts`; replaced duplicate `Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" })` in admin status and security pages |

## Vereinfacht

- Removed unused `transpilePackages` entry for `@uwe/wiki-engine` in both Next.js configs
- Updated `pnpm-lock.yaml` after dependency removal

## Noch riskant (nicht umgesetzt)

| Area | Notes |
|------|-------|
| Phase-1 in-memory wiki stack | `packages/database/src/store.ts`, `queries.ts`, `repository.ts` (866 lines) still used by tests and `packages/wiki-engine`; production uses Prisma |
| `@uwe/wiki-engine` package | Orphaned from apps but kept as test-only package; full removal needs migration plan |
| Slugify helpers | 6+ independent implementations across database, knoteforge-import, agent-jobs |
| Large service files | `life-admin-service.ts` (1007), `label-service.ts` (877), `LabelEditor.tsx` (827), `server.ts` barrel (1082 lines) |
| Inline `Intl.DateTimeFormat` | ~7 Studio pages still use local formatters with slightly different presets (short/medium/full) |

## Späterer Refactor

1. Extract shared `slugifyDe()` + `pickUniqueSlug()` into `@uwe/database` or a small shared util package
2. Extend `format.ts` presets and migrate remaining inline date formatters
3. Split `packages/database/src/server.ts` barrel by domain
4. Split `life-admin-service.ts` and `label-service.ts` when next touched for features
5. Decide fate of Phase-1 wiki stack: delete with test migration to Prisma fixtures, or document as test-only

## Analyse-Highlights (unverändert)

- No `TODO`/`FIXME`/`HACK` in TypeScript source (only in docs)
- No debug `console.*` in Studio/Portal app code
- No commented-out production code blocks found
- All 31 Studio components and 1 Portal component are imported in production code
- No temporary `.tmp`/`.bak` files in repo

## Tests

`pnpm quality` passed (lint, typecheck, unit tests, security tests, prod audit, release build).
