# Hard UI/UX Reset — Implementation Status

Living status of the rework. Pairs with `hard-ui-ux-reset-plan.md` (the plan),
`route-feature-inventory.md` (Phase 2 analysis), `agent-start-prompts.md` (handoff),
and `../design/new-ui-stack.md` (stack reference).

## Shipped & verified (Wave 0 foundation + first pages)

All additive: existing UI and its tests are untouched and still pass. Full CI
gate is green (`pnpm lint`, `pnpm typecheck` across 28 packages, `pnpm test:ci`
= 1480 tests, `pnpm build:release` for both apps incl. standalone Prisma checks).

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
  `ModuleShell`/`SettingsShell` (Studio), `PortalShell` (Portal), and
  `ConnectorShell` (RTX Connector Client).

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

## Wave 1 — shipped (merged #298)

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

### Wiki core (Phase 8/9) — initial

- `WikiPageTable` — TanStack Table (type, tags, visibility, status, last changed)
- `WikiTiptapViewer`, `WikiContextPanel` (backlinks, outgoing, related, broken links)
- `WikiFlowGraph` — `@xyflow/react` neighborhood + world graph
- `ConnectionMatrix`, `CampaignSidebar`
- **Deferred → Wave 3:** column visibility toggles on wiki table

## Wave 2 — shipped (consolidated orchestrator branch)

Branch: `cursor/uwe-wave2-orchestrator-2b4c` (merges B1–B4 subagent branches).

### Wave 2 agent deliverables

| Agent | Branch | Scope | Status |
|---|---|---|---|
| **B1** World routes | `cursor/uwe-wave2-world-shells-2b4c` | 28 world pages → `WorldShell` | **done** |
| **B2** Daily Admin OS | `cursor/uwe-wave2-daily-admin-shells-2b4c` | 27 routes → `StudioShell` | **done** |
| **B3** Admin/System + E2E | `cursor/uwe-wave2-admin-e2e-2b4c` | 15 admin/system routes + Portal E2E | **done** |
| **B4** RTX + Docs | `cursor/uwe-wave2-rtx-docs-2b4c` | ConnectorShell, QF10 hardware docs, Phase 13 audit | **done** |

### Page migration (Phase 4/5) — complete

| Route area | Shell | Status |
|---|---|---|
| `/today`, `/worlds` | `StudioShell` | **done (Wave 1)** |
| `/worlds/[worldSlug]/dashboard`, wiki list/detail/graph | `WorldShell` | **done (Wave 1)** |
| Wiki edit, sessions, dungeons, brain, labels, assets, etc. | `WorldShell` | **done (Wave 2 B1)** |
| `/capture`, `/projects`, `/workshop/**`, `/life-brain/**`, `/calendar`, `/mail/**`, `/jobs`, `/image-studio/**`, `/search`, `/templates/**`, `/brain`, `/ai`, `/backup` | `StudioShell` | **done (Wave 2 B2)** |
| `/admin/**`, `/system`, `/system/rtx-connector`, `/system/printers` | `SystemShell` | **done (Wave 2 B3)** |
| `/system/navigation`, `/system/version`, `/system/cloudflare`, `/system/host-control`, `/system/uwe-knowhow` | `SystemShell` | **done (Wave 0/1)** |
| `/settings`, `/account/**` | `StudioAppShell` / `SettingsShell` | **legacy** (Wave 3) |

### Legacy shell retirement (Wave 2 orchestrator)

Deleted (reference count = 0):

- `apps/studio/components/WorldModuleShell.tsx`
- `apps/studio/components/WorldCockpitShell.tsx`
- `apps/studio/components/StudioCockpitAppShell.tsx`
- `apps/studio/components/AdminModuleShell.tsx`

### Phase 11 — ConnectorShell

| File | Action |
|---|---|
| `apps/rtx-connector-client/src/components/shell/ConnectorShell.tsx` | **created** — sidebar shell driven by connector-nav IA |
| `apps/rtx-connector-client/src/components/shell/NavIcon.tsx` | **created** — Lucide icon resolver for nav items |
| `apps/rtx-connector-client/src/components/PrintersPanel.tsx` | **created** — `/printers` route panel |
| `apps/rtx-connector-client/src/App.tsx` | **updated** — `ConnectorShell` + `connectorSidebar()` replace inline nav |

IA routes wired: `/` (Host-Verbindung), `/runner` (Runner/Ollama), `/models` (Modelle),
`/printers` (Drucker), `/jobs` (Jobs), `/logs` (Logs), `/diagnostics` (Diagnose).

### QF10 — Hardware Printer Documentation

| File | Action |
|---|---|
| `tools/uwe-rtx-connector/.env.example` | **updated** — `UWE_CONNECTOR_PRINTERS` + `UWE_CONNECTOR_PRINT_CMD` with examples |
| `docs/rtx-connector.md` | **updated** — "Label printing (CUPS / local printers)" section added |

### Phase 12 — Tests on new IA

| Test area | File(s) | Status |
|---|---|---|
| Studio central nav contract | `apps/studio/src/navigation/navigation.test.ts` | **done** |
| Studio nav audit | `apps/studio/src/navigation/inspect-navigation.test.ts` | **done** |
| Studio mobile nav | `apps/studio/src/lib/mobile-nav.test.ts` | **done** |
| Portal login-first nav | `apps/portal/src/navigation/portal-nav.test.ts` | **done** |
| Portal mobile nav | `apps/portal/src/lib/mobile-nav.test.ts` | **done** |
| Shared nav helpers | `packages/shared-utils/src/navigation.test.ts` | **done** |
| Integration smoke | `scripts/integration-smoke.test.ts` | **done** |
| Security leaks | `scripts/security-leaks.test.ts` | **done** |
| Portal access | `packages/database/src/portal-access.test.ts` | **done** |
| Label print queue | `label-print-queue-service.test.ts`, `capabilities.test.ts` | **done** |
| Route policy login-first | `route-policy.test.ts` | **done (Wave 2 B3)** — 5 Portal login-first assertions |
| Portal E2E login-first | `e2e/portal-auth.spec.ts` | **done (Wave 2 B3)** — unauthenticated redirect + Studio `/portal` shim |
| Studio shell E2E | `e2e/studio-shell.spec.ts` | **updated (Wave 2)** — new AppShell selectors |

### Phase 13 — Documentation

| Doc | Status |
|---|---|
| `docs/rework/implementation-status.md` | **updated** (this file) |
| `docs/cloudflare-current-setup.md` | **updated** (Wave 1) |
| `README.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_MATURITY_MATRIX.md`, `docs/ROADMAP.md`, `docs/design/new-ui-stack.md` | **updated (Wave 2 B4)** |

## Deferred / Wave 3 recommendations

| Item | Plan ref | Status |
|---|---|---|
| `/settings`, `/account/**` on `SettingsShell` (retire `StudioAppShell`) | Phase 4/5 | open |
| Wiki table column visibility toggles | Phase 8/9 | open |
| Physical printer E2E on RTX host | QF10 | open (CI stubs CUPS) |
| Portal player routes restyle on `PortalShell` | Phase 10 | open |
| Full visual polish (design-v2 CSS retirement) | Phase 14 | open |

### legacy-ui-disconnected (unchanged)

Public Portal discovery routes (`/worlds`, `/worlds/[slug]`, etc.) remain
backend-intact but disconnected from active Portal navigation (QF2). No change
in Wave 2.

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

Consolidated Wave 2 branch (`cursor/uwe-wave2-orchestrator-2b4c`):

- `pnpm lint` (whole repo, `--max-warnings 0`) — pass
- `pnpm typecheck` (turbo, 28 packages) — pass
- `pnpm test:ci` — 1480 tests across 16 suites, pass
- `pnpm test:security` — pass
- `pnpm docs:check` — pass
- `pnpm build:release` — both apps build incl. standalone Prisma checks — pass

Wave 1 baseline was 1480 tests; route-policy login-first regressions added in B3 (same suite count).
