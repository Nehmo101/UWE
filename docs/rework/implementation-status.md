# Hard UI/UX Reset — Implementation Status

Living status of the rework. Pairs with `hard-ui-ux-reset-plan.md` (the plan),
`route-feature-inventory.md` (Phase 2 analysis), `agent-start-prompts.md` (handoff),
and `../design/new-ui-stack.md` (stack reference).

## Shipped & verified (Wave 0 foundation + first pages)

All additive: existing UI and its tests are untouched and still pass. Full CI
gate is green (`pnpm lint`, `pnpm typecheck` across 27 packages, `pnpm test:ci`
= 1466 tests, `pnpm build:release` for both apps incl. standalone Prisma checks).

### Central navigation contract

- `@uwe/shared-utils/navigation` — framework-agnostic types + helpers
  (`NavItem`/`NavGroup`, `isNavItemActive`, `resolveNavGroups`,
  `navGroupsToCommands`, `findNavConflicts`).
- Studio IA: `apps/studio/src/navigation/{studio-nav,world-nav,system-nav,organization-nav}.ts`.
- Portal IA (login-first, no public discovery): `apps/portal/src/navigation/portal-nav.ts`.
- RTX IA: `apps/rtx-connector-client/src/navigation/connector-nav.ts`.
- Navigation route-audit (Phase 7 logic): `apps/studio/src/navigation/inspect-navigation.ts`.
- Tests: contract helpers, route-existence (active hrefs map to real routes),
  world stability, portal login-first, icon resolution.

### UI stack (both apps)

- Tailwind CSS v4, additive (theme + utilities, **no preflight reset**), tokens
  bridged to existing `--uwe-*` theme variables in `app/globals.css`.
- shadcn-style primitives in `apps/<app>/src/components/ui/`: Button, Card,
  Input/Textarea, Label, Dialog, DropdownMenu, Tabs, Select, Sheet, ScrollArea,
  Tooltip, Toaster (Sonner), CommandPalette (cmdk, fed from the nav contract),
  Form (React Hook Form), DataTable (TanStack Table), Alert + Empty/Error/Loading
  states, plus a Lucide icon resolver (`NavIcon`).
- Shells (Phase 4): `AppShell` (sidebar + topbar + command + mobile drawer +
  context panel) and wrappers `StudioShell`/`WorldShell`/`SystemShell`/
  `ModuleShell`/`SettingsShell` (Studio) and `PortalShell` (Portal).

### Migrated pages (new shell, browser-verified)

- `/system/navigation` (Phase 7) — owner-only Navigation overview: DataTable of
  all nav entries + warnings (dead links, promotable, routes without nav,
  duplicates). Verified via browser QA.
- `/system/version` (QF8) — Version & Updates: build metadata
  (`apps/studio/src/lib/build-info.ts`) + version label in the shell footer.
  Verified via browser QA.
- `/system/cloudflare` (QF9) — read-only routing/tunnel/access/security status
  via `getProxyStatus()` (no secrets). Build-verified; reuses browser-verified
  components.
- `/system/uwe-knowhow` (QF12) — searchable index of README/CHANGELOG/docs
  (`apps/studio/src/lib/uwe-knowhow.ts`), kept separate from world brain.
  Build-verified.
- `/system/host-control` (QF13) — owner-only read-only system status via
  `getSystemStatus()` (DB/migrations/storage/security/services, no secrets).
  Build-verified.
- Central error UI (QF14) — `ErrorScreen` (Studio diagnostics) + `PortalErrorScreen`
  (player-safe) wired into both `app/error.tsx`. Build-verified.

## Wave 1 — shipped (consolidated orchestrator branch)

Branch: `cursor/uwe-wave1-orchestrator-941c` (merges A1–A4 subagent branches).

### Quick-fix disposition (updated)

| Item | Status | Notes |
|---|---|---|
| QF1 Layout 404 | **done (Wave 0)** | Route + policy + regression test already present |
| QF2 Portal routing | **done** | Login-first Portal; Studio `/portal` redirect shim; legacy `/worlds/*` redirects |
| QF3 Membership/portal access | **done** | `portal-access-service`, admin badges, "Portalzugriff prüfen" API/UI |
| QF4 Sessions create | **done (Wave 0)** | Service + Zod + regression test |
| QF5 Dungeons create | **done (Wave 0)** | Service + validation + regression test |
| QF6 Faction/type filter | **done (Wave 0)** | Mapping complete + empty states |
| QF7 RTX/Ollama CMD | **done (Wave 0)** | `CREATE_NO_WINDOW` + UI error surfacing |
| QF8 Version | **done (Wave 0)** | `/system/version` + build metadata |
| QF9 Cloudflare | **done (Wave 0)** | `/system/cloudflare` + `docs/cloudflare-current-setup.md` |
| QF10 Label print via RTX | **done** | `label_printing` capability, queue service, `/system/printers`, world RTX print UI |
| QF11 Knowledge text | **done (Wave 0)** | `create_knowledge_text` brain action + test |
| QF12 UWE KnowHow | **done (Wave 0)** | `/system/uwe-knowhow` |
| QF13 Host Control | **done (Wave 0)** | `/system/host-control` read-only status |
| QF14 Error UI | **done (Wave 0)** | Studio diagnostics + Portal player-safe error |

### Page migration (Phase 4/5) — partial

| Route | Shell | Status |
|---|---|---|
| `/today` | `StudioShell` | **done** |
| `/worlds` | `StudioShell` | **done** |
| `/worlds/[worldSlug]/dashboard` | `WorldShell` | **done** |
| `/worlds/[worldSlug]` (wiki list) | `WorldShell` | **done** |
| `/worlds/[worldSlug]/[category]/[slug]` | `WorldShell` | **done** |
| `/worlds/[worldSlug]/graph` | `WorldShell` | **done** |
| `/system/printers` | System area | **done** (QF10) |
| Sessions, dungeons, edit, brain, labels (non-print), etc. | `WorldModuleShell` | **open** (Wave 2) |

### Wiki core (Phase 8/9) — initial

- `WikiPageTable` — TanStack Table (type, tags, visibility, status, last changed)
- `WikiTiptapViewer`, `WikiContextPanel` (backlinks, outgoing, related, broken links)
- `WikiFlowGraph` — `@xyflow/react` neighborhood + world graph
- `ConnectionMatrix`, `CampaignSidebar`
- **Deferred:** wiki edit page on new shell, column visibility toggles

### Wave 1 agent deliverables

| Agent | Branch | Scope | Status |
|---|---|---|---|
| **A1** Portal + Cloudflare | `cursor/uwe-wave1-portal-cloudflare-941c` | QF2, QF3 | **done** |
| **A2** Page migration + Wiki | `cursor/uwe-wave1-page-migration-941c` | Phase 4/5/8/9 | **done** (partial page set) |
| **A3** RTX Label print | `cursor/uwe-wave1-label-print-941c` | QF10 | **done** |
| **A4** Tests + Docs | `cursor/uwe-wave1-tests-docs-941c` | Phase 12/13 | **done** |

### Phase 12 — Tests on new IA

| Test area | File(s) | Status |
|---|---|---|
| Studio central nav contract | `apps/studio/src/navigation/navigation.test.ts` | **done** |
| Studio nav audit | `apps/studio/src/navigation/inspect-navigation.test.ts` | **done** (Wave 0) |
| Studio mobile nav | `apps/studio/src/lib/mobile-nav.test.ts` | **done** |
| Portal login-first nav | `apps/portal/src/navigation/portal-nav.test.ts` | **done** |
| Portal mobile nav | `apps/portal/src/lib/mobile-nav.test.ts` | **done** |
| Shared nav helpers | `packages/shared-utils/src/navigation.test.ts` | **done** (Wave 0) |
| Legacy studio nav tests | ~~`studio-navigation.test.ts`~~ | **removed** → `navigation.test.ts` |
| Legacy portal nav tests | ~~`portal-navigation.test.ts`~~ | **removed** → `portal-nav.test.ts` |
| Integration smoke | `scripts/integration-smoke.test.ts` | **done** |
| Security leaks | `scripts/security-leaks.test.ts` | **done** |
| Portal access | `packages/database/src/portal-access.test.ts` | **done** |
| Label print queue | `label-print-queue-service.test.ts`, `capabilities.test.ts` | **done** |
| Route policy + middleware (login-first) | `route-policy.test.ts`, `middleware.test.ts` | **deferred** — policy unchanged; optional E2E regressions |
| E2E portal login flow | `scripts/e2e-servers.mjs` | **deferred** — recommend before merge to main |

### Phase 13 — Documentation

| Doc | Status |
|---|---|
| `docs/rework/implementation-status.md` | **updated** (this file) |
| `docs/cloudflare-current-setup.md` | **updated** (Studio `/portal` shim) |
| Full `docs/` audit | **deferred → Wave 2** |

## Deferred / not yet done (Wave 2)

| Item | Plan ref | Status |
|---|---|---|
| Retire `WorldModuleShell` on remaining world routes | Phase 4/5 | open |
| Wiki edit page on `WorldShell` | Phase 8/9 | open |
| Portal E2E browser verification | QF2 | open |
| Physical printer E2E on RTX host | QF10 | open (CI stubs CUPS) |
| Route-policy login-first regression tests | Phase 12 | open (optional) |
| Full docs audit (README, ARCHITECTURE, etc.) | Phase 13 | open |

### QF6 note

`packages/database/src/page-types.ts` defines an exhaustive
`Record<PageType, NavCategory>` and the world list page renders an `EmptyState`
for zero results — the conditions for the original "Server Component Error"
appear already handled. A clean runtime reproduction was blocked by local
dev-auth friction (see recipe); no speculative fix was committed.

## Local runtime QA recipe (learnings)

Verifying Studio pages locally is non-obvious; what works:

- The repo root `.env` is loaded and **overrides inline env vars** for the dev
  server — change config there, not via `VAR=… next dev`.
- Dev login needs `'unsafe-eval'` in the CSP; the committed dev branch of
  `packages/auth/src/security-headers.ts` already includes it.
- The session cookie is `Secure` by default (`SESSION_COOKIE_SECURE=true` in
  `.env`), so it is not sent over `http://localhost`. For local http QA set
  `SESSION_COOKIE_SECURE=false` in `.env` (revert afterwards).
- With public-exposure-style env present, Studio enforces auth even in dev; a
  valid session is required. Obtain one via `POST /api/auth/login`
  (`dm@uwe.local` / `uwe-dev`) and pass the cookie jar to subsequent requests.
- The most reliable production-parity harness is `scripts/e2e-servers.mjs`
  (builds + starts both apps with `NODE_ENV=production` and the required
  secrets); prefer it for auth/flow verification. Note `next build` bakes env
  presence for `output: "standalone"`, so set env before building.

Always revert any `.env` changes and leave the tree clean.

## Latest full-gate verification

Consolidated Wave 1 branch (`cursor/uwe-wave1-orchestrator-941c`):

- `pnpm lint` (whole repo, `--max-warnings 0`) — pass
- `pnpm typecheck` (turbo, 27 packages) — pass
- `pnpm test:ci` — 1480 tests across 16 suites, pass
- `pnpm build:release` — both apps build incl. standalone Prisma checks — pass

Wave 0 baseline was 1478 tests; +2 from portal-access and label-print regressions.
