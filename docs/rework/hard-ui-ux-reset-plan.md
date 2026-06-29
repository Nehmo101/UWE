# UWE Hard UI/UX Reset — Implementation Plan

## Executive Summary

UWE soll funktional erhalten bleiben, aber die aktive Oberfläche wird hart neu strukturiert: alte Shells, verstreute Navigationen, wechselnde Welt-Menübänder und Portal/Studio-Verwirrung werden durch eine klare Produktarchitektur ersetzt.

Wichtig: Das ist kein kleines CSS-Polish. Der aktuelle Code nutzt ein eigenes CSS-/Theme-System (`packages/shared-ui/src/uwe.css`, `design-v2`, `shells-v2`) und **keinen** Tailwind-/shadcn-/Radix-/Lucide-/TanStack-Stack. Die gewünschte neue UI-Basis ist daher ein echter neuer Frontend-Stack mit Migrationsbrücke, nicht nur ein Komponenten-Austausch.

Empfehlung: Umsetzung als mehrphasiges Programm auf einem Feature-Branch, mit stabilen Akzeptanzpunkten je Phase. Backend, Prisma, Services, Auth, AI/Brain/RTX/Labels/Sessions/Dungeons bleiben erhalten. Nicht sofort migrierte Feature-UIs werden aktiv aus der neuen Navigation entfernt, aber als `legacy-ui-disconnected` dokumentiert.

## Current Findings

### Apps

- `apps/studio` — Next.js Studio, DM/Admin, viele Routen direkt unter `app/`.
- `apps/portal` — Next.js Portal, player-facing, aktuell noch öffentliche `/worlds`-/„Welten entdecken“-Navigation vorhanden.
- `apps/rtx-connector-client` — Tauri Desktop Client.
- `tools/uwe-rtx-connector` — Node-based outbound RTX host connector.

### Current UI/Styling

- Kein Tailwind, kein shadcn/ui, keine Radix Packages, kein Lucide, kein TanStack Table/Query, kein cmdk, kein Sonner, kein React Hook Form, kein React Flow.
- Vorhanden:
  - Tiptap + Zod in Studio.
  - `@dnd-kit/*` in `packages/shared-ui`.
  - Eigenes Theme/CSS-System in `packages/shared-ui/src/uwe.css`, `uwe-v2.css`, `design-v2`, `shells`, `shells-v2`.
- Bestehende Shells/Nav:
  - `packages/shared-ui/src/shells/*`
  - `packages/shared-ui/src/shells-v2/*`
  - `apps/studio/src/lib/studio-navigation.ts`
  - `apps/studio/src/lib/world-nav.ts`
  - `apps/studio/src/lib/global-nav.ts`
  - `apps/portal/src/lib/portal-navigation.ts`

### Notable Quick-Fix Findings

- `/api/dashboard-layout/[pageKey]` exists and route policy already includes `/api/dashboard-layout/*`; 404 is likely deployment/path-prefix/auth-policy interaction and needs regression coverage.
- Studio has no `/portal` route, so `/portal` on the Studio origin will produce Studio NotFound. Cloudflare/link routing must stop sending Portal paths to Studio.
- Portal currently redirects `/` and `/portal` to login/`/auth/worlds`, but still has public „Welten entdecken“ IA.
- RTX Tauri Rust code defines `CREATE_NO_WINDOW`, but at least one `node` command path appears to spawn without using that flag.
- Version UI is minimal (`VERSION` only), no full build metadata.
- Tests currently assert old/partial IA exactly, especially `apps/studio/src/lib/studio-navigation.test.ts`.

## Guiding Principles

1. Functions stay; old UI goes.
2. Business logic stays in packages, not route handlers/components.
3. Portal remains player-safe; no `dm_only` leaks.
4. Studio APIs stay guarded by `requireStudioApiAuth`, `guardStudioMutation`, or stricter owner guards.
5. New UI components come from a single component system.
6. Navigation is declarative and central.
7. Tests must assert the new IA, not preserve old shell behavior.
8. Anything not migrated is documented and disconnected from active navigation, not deleted from backend.

## Phase 0 — Branch, Baseline, and Safety Setup

### Tasks

- Create/confirm working branch name for the rework.
- Confirm current `pnpm install --frozen-lockfile` state after async setup finishes.
- Run a baseline read-only inventory:
  - `pnpm lint`
  - `pnpm typecheck`
  - targeted existing tests for route policy/navigation, if practical.
- Record baseline failures before any changes.

### Acceptance Criteria

- Clean branch with no unrelated changes.
- Baseline known and documented.

## Phase 1 — New UI Stack Foundation

### Dependencies to Add

Add at workspace/app/package level as appropriate:

- Tailwind CSS
- PostCSS/autoprefixer if required by Next/Tailwind setup
- shadcn-compatible primitives:
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-tabs`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-tooltip`
  - `@radix-ui/react-select`
  - `@radix-ui/react-scroll-area`
  - `@radix-ui/react-navigation-menu`
- `lucide-react`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `@tanstack/react-table`
- `@tanstack/react-query`
- `react-hook-form`
- `@hookform/resolvers`
- `cmdk`
- `sonner`
- `@xyflow/react`
- Keep existing:
  - Tiptap
  - Zod
  - dnd-kit

### Files to Create/Edit

- Root:
  - `tailwind.config.ts`
  - `postcss.config.mjs`
  - `package.json`
  - `pnpm-lock.yaml`
- Studio:
  - `apps/studio/app/globals.css`
  - optional `apps/studio/src/lib/utils.ts` with `cn()`
  - `apps/studio/src/components/ui/*`
- Portal:
  - `apps/portal/app/globals.css`
  - optional `apps/portal/src/lib/utils.ts`
  - `apps/portal/src/components/ui/*`
- Shared:
  - Prefer new common UI primitives in `packages/shared-ui/src/components/ui/*` if imports remain app-safe.
  - Export only framework-safe components via `packages/shared-ui/src/index.ts`.

### Design Token Strategy

- Bridge existing `--uwe-*` and design-v2 variables into Tailwind theme tokens.
- Do not hard-delete the existing CSS immediately; progressively retire it by moving pages to new shell classes/components.
- Tailwind semantic tokens:
  - `background`
  - `foreground`
  - `card`
  - `card-foreground`
  - `popover`
  - `muted`
  - `muted-foreground`
  - `border`
  - `input`
  - `ring`
  - `primary`
  - `secondary`
  - `destructive`
  - `accent`
  - `sidebar`
  - `sidebar-foreground`

### Documentation

Create `docs/design/new-ui-stack.md`:

- selected stack
- why each tool is used
- what is replacing old CSS/shell components
- migration rules
- when not to use a tool and documented alternatives

### Acceptance Criteria

- Tailwind classes compile in Studio and Portal.
- `cn()` utility works.
- shadcn-style Button/Card/Dialog/Dropdown/Tabs/Form/Input/Select/Sheet/Command/Toast/Table/Alert primitives exist.
- No visual app migration yet except minimal shell proof page if needed.

## Phase 2 — Analysis Documentation

### Create

- `docs/rework/hard-ui-ux-reset-plan.md`

### Include

- Active apps:
  - Studio
  - Portal
  - RTX Connector Client
- Active routes:
  - Studio app routes
  - Studio API routes
  - Portal app routes
  - Portal API routes
  - Admin/System routes
  - Legacy/ambiguous routes
- Existing features:
  - worlds
  - wiki/pages
  - sessions
  - dungeons
  - handouts
  - maps/assets
  - labels/print
  - portal
  - users/roles
  - RTX connector
  - AI/Ollama
  - brain/knowledge
  - knowledge text
  - import/conversion
  - graph/connections
  - backup/restore
  - Cloudflare/host
  - logs/diagnostics
  - Daily/Admin/Organisation features
- What remains functional.
- What old UI is replaced.
- Which features are immediately re-bound.
- Which features remain functional but UI-later.
- Tests that enforce old UI and must be changed.

### Acceptance Criteria

- Analysis doc is specific with file/route references.
- Includes `legacy-ui-disconnected` table.

## Phase 3 — Central Navigation Model

### Create

- `apps/studio/src/navigation/studio-nav.ts`
- `apps/studio/src/navigation/world-nav.ts`
- `apps/studio/src/navigation/system-nav.ts`
- `apps/studio/src/navigation/organization-nav.ts`
- `apps/portal/src/navigation/portal-nav.ts`
- `apps/rtx-connector-client/src/navigation/connector-nav.ts`

### Navigation Item Shape

Define a common type, likely in Studio first:

```ts
type NavStatus = "active" | "legacy-ui-disconnected" | "planned" | "hidden";
type NavPermission = "owner" | "admin" | "dm" | "player" | "readonly" | "public";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  group: string;
  section: string;
  permission: NavPermission[];
  status: NavStatus;
  source: "studio" | "world" | "system" | "organization" | "portal" | "connector";
  keywords?: string[];
}
```

### Studio IA

Top-level areas:

1. Start
2. Welten
3. Knowledge & Brain
4. AI & Generatoren
5. Werkzeuge
6. Organisation
7. System

### World IA

Per world:

- Übersicht
- Wiki / Seiten
- Sessions
- Dungeons
- Medien / Assets
- Handouts
- Labels & Print
- Verbindungen / Graph
- Import & Konvertierung
- KI / Generatoren
- Brain / Wissen
- Freigaben / Portal

### Portal IA

Login-first:

- Login
- Meine Welten
- Weltübersicht
- Wiki
- Sessions/Recaps
- Handouts
- Karten/Assets
- Charakter/Spielerprofil if present

Remove public „Welten entdecken“ as active main flow.

### RTX IA

- Host-Verbindung
- Runner/Ollama
- Modelle
- Drucker
- Jobs
- Logs
- Diagnose

### Consumers

Use central nav for:

- Sidebar
- Mobile nav
- Breadcrumbs
- Command palette
- Navigation overview
- Tests

### Replace/Deprecate

- Migrate from:
  - `apps/studio/src/lib/studio-navigation.ts`
  - `apps/studio/src/lib/world-nav.ts`
  - `apps/studio/src/lib/global-nav.ts`
  - `apps/portal/src/lib/portal-navigation.ts`
- Keep compatibility exports temporarily if needed, but mark as deprecated.

### Acceptance Criteria

- One source of truth exists for each app/scope.
- Tests validate nav hrefs and duplicate labels/routes.
- Old scattered arrays are no longer primary.

## Phase 4 — New Shell Architecture

### Create/Replace Shells

Prefer colocating app-specific shell orchestration in apps and low-level UI in shared-ui.

- `apps/studio/src/components/shell/StudioShell.tsx`
- `apps/studio/src/components/shell/WorldShell.tsx`
- `apps/studio/src/components/shell/SystemShell.tsx`
- `apps/studio/src/components/shell/ModuleShell.tsx`
- `apps/studio/src/components/shell/SettingsShell.tsx`
- `apps/portal/src/components/shell/PortalShell.tsx`
- `apps/rtx-connector-client/src/components/shell/ConnectorShell.tsx`

Shared primitives:

- `packages/shared-ui/src/components/ui/sidebar.tsx`
- `packages/shared-ui/src/components/ui/topbar.tsx`
- `packages/shared-ui/src/components/ui/breadcrumbs.tsx`
- `packages/shared-ui/src/components/ui/context-panel.tsx`
- `packages/shared-ui/src/components/ui/mobile-nav.tsx`

### Shell Rules

- Every product page uses one of the central shells.
- No page builds its own main navigation.
- No changing world menu bands.
- Left primary sidebar remains stable.
- Top bar includes breadcrumb + global search/command.
- Right context panel is optional and route-local.
- Mobile navigation uses same nav source.

### Pages to Migrate First

- Studio `/today`
- Studio `/worlds`
- Studio `/worlds/[worldSlug]/dashboard`
- Studio `/worlds/[worldSlug]`
- Studio `/worlds/[worldSlug]/sessions`
- Studio `/worlds/[worldSlug]/dungeons`
- Studio `/system`
- Portal `/`, `/portal`, `/login`, `/auth/worlds`

### Acceptance Criteria

- Stable navigation across migrated pages.
- Old shell components not used by migrated routes.
- No visible Portal links in Studio main IA except intentional app switch/preview.

## Phase 5 — Hard UI Abrisskante

### Remove From Active Flow

Not delete backend/services. Remove/replace active links to:

- old Studio shells
- old Portal public shell as main flow
- old world shell bands
- duplicated topbars
- scattered dashboards
- old command palette structures
- public Portal discovery navigation
- routes with no new IA home

### Legacy Documentation

In `docs/rework/hard-ui-ux-reset-plan.md`, mark:

- route
- feature
- backend status
- UI status
- planned rebind target

### Acceptance Criteria

- Active nav contains only new IA.
- Legacy pages are not discoverable through primary navigation.
- Backend remains intact.

## Phase 6 — Product Area Migration

### Start

Files/routes:

- `apps/studio/app/page.tsx`
- `apps/studio/app/studio/page.tsx`
- `apps/studio/app/today/page.tsx`

New content:

- worlds open
- recently edited
- quick actions
- compact system status
- open warnings/errors

### Welten

Files/routes:

- `apps/studio/app/worlds/page.tsx`
- `apps/studio/app/worlds/[worldSlug]/dashboard/page.tsx`

New content:

- world list
- create world
- open world
- portal preview link

### Knowledge & Brain

Routes:

- `/brain`
- `/life-brain`
- `/worlds/[worldSlug]/brain`
- `/worlds/[worldSlug]/brain/facts`

Rehome into:

- global Knowledge & Brain
- world Brain/Wissen
- UWE KnowHow separate under System

### AI & Generatoren

Routes:

- `/ai`
- `/worlds/[worldSlug]/ai-runs`
- `/worlds/[worldSlug]/dnd-api`
- DnD generator/API pages

### Werkzeuge

Routes:

- `/capture`
- `/import`
- `/worlds/[worldSlug]/import`
- `/image-studio`
- `/jobs`
- `/admin/reviews`
- print/labels

### Organisation

Routes:

- `/projects`
- `/hardware`
- `/workshop`
- `/contracts`
- `/mail`
- `/calendar`

### System

Routes:

- `/system`
- `/admin`
- `/admin/setup`
- `/admin/users`
- `/admin/security`
- `/admin/audit-log`
- `/backup`
- `/settings`
- `/system/rtx-connector`
- new `/system/navigation`
- new `/system/version`
- new `/system/cloudflare`
- new `/system/host-control`
- new `/system/printers`
- new `/system/uwe-knowhow`

### Acceptance Criteria

- Each major feature has exactly one new IA home or documented legacy status.
- Daily/Admin/Organisation features are not scattered.

## Phase 7 — System Navigation Overview

### Create

- `apps/studio/app/system/navigation/page.tsx`
- supporting service/helper:
  - `apps/studio/src/navigation/inspect-navigation.ts`

### Display

- Bereich
- Gruppe
- Label
- Route
- Icon
- Rolle/Berechtigung
- Status
- Quelle
- Warning: dead link
- Warning: route without navigation
- Warning: legacy route
- Warning: duplicate labels/targets

### Route Existence Check

Static filesystem-based route scanner for app routes:

- scan `apps/studio/app`
- scan `apps/portal/app`
- compare central nav hrefs
- ignore dynamic params with normalized pattern matching

### Acceptance Criteria

- Owner can inspect navigation health.
- Tests validate dead-link detection.

## Phase 8 — Concrete Quick Fixes

### QF1 — Dashboard Layout 404

Files:

- `apps/studio/app/api/dashboard-layout/[pageKey]/route.ts`
- `packages/auth/src/security/route-policy.ts`
- `packages/auth/src/security/route-policy.test.ts`
- `packages/auth/src/security/middleware.test.ts`
- `packages/shared-ui/src/layout-editor/useDashboardLayout.ts`
- relevant Today/dashboard page.

Plan:

- Verify route classification for:
  - `/api/dashboard-layout/studio:today`
  - `/studio/api/dashboard-layout/studio:today` if used by proxy.
- Add explicit `/api/dashboard-layout` and `/api/dashboard-layout/*` entries if base route missing matters.
- Ensure GET with valid session returns JSON, not 404.
- Ensure PUT with valid session saves.
- Ensure unauthenticated returns 401/403, not unknown API 404.
- Improve hook error parsing to show structured errors.

Tests:

- route-policy test
- middleware test
- API handler test if feasible
- layout hook unit test if feasible

### QF2 — Portal Opens Correctly / No Studio NotFound

Files:

- `apps/studio/app/portal/page.tsx` (new redirect/shim if path routing remains supported)
- `apps/portal/app/page.tsx`
- `apps/portal/app/portal/page.tsx`
- `apps/portal/src/navigation/portal-nav.ts`
- `packages/auth/src/security/route-policy.ts`
- Cloudflare docs/config docs

Plan:

- Prefer split hostnames:
  - `studio.uweanddragons.org`
  - `portal.uweanddragons.org`
- Add Studio `/portal` shim only as defensive UX: redirect to configured Portal URL instead of NotFound.
- Portal `/` without session -> `/login`.
- Portal `/portal` without session -> `/login`.
- Authenticated -> `/auth/worlds` („Meine Welten“).
- Remove public „Welten entdecken“ from main nav.
- Empty state for no memberships.

Tests:

- portal nav tests
- middleware tests
- route/link resolver tests

### QF3 — User/World Membership and Portal Access

Files:

- `packages/database/src/*membership*`
- `packages/database/src/*user*`
- `packages/auth/src/*`
- `apps/studio/app/admin/users/*`
- `apps/studio/app/admin/users/[id]/*` if present
- new API/action for portal access check

Plan:

- Define access predicate:
  - active user
  - valid session possible
  - role allowed
  - world membership exists
  - world visible/published enough for portal
- Add user admin UI fields:
  - account status
  - login status/session facts where safe
  - world memberships
  - portal access badge
  - „Portalzugriff prüfen“ action
- Return structured errors, never silent 404.

Tests:

- service tests for access predicate.
- user admin action/API test.

### QF4 — Sessions Create

Files:

- `apps/studio/app/worlds/[worldSlug]/sessions/new/page.tsx`
- `apps/studio/app/session-actions.ts`
- `packages/database/src/game-session*`
- `packages/calendar/*`

Plan:

- Add Zod schema for create input.
- Validate:
  - world exists
  - permission
  - non-empty title
  - date optional/valid
- Wrap calendar sync as optional side-effect.
- If calendar sync fails after DB create, return warning not crash.
- New form uses React Hook Form + Zod.

Tests:

- regression test for `createGameSessionAction`.
- optional calendar failure test.

### QF5 — Dungeons Create

Files:

- `apps/studio/app/worlds/[worldSlug]/dungeons/new/page.tsx`
- `apps/studio/app/dungeon-actions.ts`
- dungeon service/repository in `packages/database`
- page type mappings for `dungeon`, `dungeon_level`, `room`, `encounter`, `trap`, `puzzle`, `loot`, `secret`

Plan:

- Unify Dungeon creation with Wiki/Page system.
- Add wizard:
  - create dungeon
  - create level
  - create room
  - add encounter/loot/trap/puzzle
- Zod schemas.
- Structured errors.

Tests:

- dungeon create action.
- room create action.
- page type mapping.

### QF6 — Factions/Page Type Filters Crash

Files:

- `apps/studio/app/worlds/[worldSlug]/page.tsx`
- `apps/studio/app/worlds/[worldSlug]/[category]/[slug]/page.tsx`
- `apps/studio/app/worlds/[worldSlug]/[category]/[slug]/edit/page.tsx`
- nav/page type mapping utilities
- database page query service

Plan:

- Confirm canonical category mapping for factions/NPCs/locations/sessions/handouts/maps.
- Treat category pages as filters inside Wiki, not separate nav worlds.
- Add empty state for zero results.
- Avoid Server Component Error by guarding invalid categories.

Tests:

- category mapping tests.
- render test or route test for `/worlds/terra/fraktionen`.

### QF7 — RTX/Ollama Test Black CMD

Files:

- `apps/rtx-connector-client/src-tauri/src/lib.rs`
- `apps/rtx-connector-client/src/*`
- `tools/uwe-rtx-connector/src/*`

Plan:

- Ensure all Windows process launches use `CREATE_NO_WINDOW`.
- Capture stdout/stderr.
- Add timeout.
- Return structured diagnostic result:
  - ok
  - status
  - endpoint
  - message
  - stdout
  - stderr
  - triedPaths
- UI never shows only „Unbekannter Fehler“.

Tests:

- Rust unit test where feasible.
- TS UI test for diagnosis rendering.

### QF8 — Version in Interface

Files:

- `VERSION`
- new generated build metadata file, e.g. `packages/env/src/build-info.ts` or `packages/shared-utils/src/build-info.ts`
- `apps/studio/src/components/*Version*`
- `apps/studio/app/system/version/page.tsx`
- `apps/portal/src/components/*Footer*`
- GitHub workflow(s)

Plan:

- Build metadata:
  - version
  - commit
  - branch
  - builtAt
  - deployRunNumber
- Render in:
  - Studio sidebar/footer
  - System → Version & Updates
  - Portal footer
- GH Action writes metadata during build without commit loop.
- If version file is bumped on main, use `[skip ci]` and loop guard.

Tests:

- build-info parser/generator tests.
- UI smoke for version string.

### QF9 — Cloudflare Setup

Files/docs:

- `docs/cloudflare-current-setup.md`
- `docs/deployment.md`
- `.env.example`
- System Cloudflare status page.

Plan:

- Use MCP to inspect Cloudflare routes/tunnel/access during execution.
- Document current setup.
- Prefer stable split-hostname architecture:
  - `studio.uweanddragons.org` → Studio
  - `portal.uweanddragons.org` → Portal
- If path routing is still required:
  - `/studio` → Studio
  - `/portal` → Portal
  - add defensive Studio `/portal` redirect.
- Document env:
  - `PUBLIC_BASE_URL`
  - `STUDIO_PATH`
  - `PORTAL_PATH`
  - `NEXT_PUBLIC_STUDIO_URL`
  - `NEXT_PUBLIC_PORTAL_URL`
  - `AUTH_REQUIRED=true`
  - `PLAYER_PREVIEW_PUBLIC=false`
  - `TRUST_PROXY=true`
  - `CLOUDFLARE_TUNNEL=true`
- Check cookies:
  - Secure
  - SameSite
  - proxy headers

Acceptance:

- `/studio` or studio subdomain opens Studio.
- `/portal` or portal subdomain opens Portal login/My Worlds.
- No Studio NotFound for Portal.

### QF10 — Label Print via RTX Connector

Files/packages:

- `packages/connector`
- `tools/uwe-rtx-connector/src/*`
- `apps/studio/app/worlds/[worldSlug]/labels/*`
- new `apps/studio/app/system/printers/page.tsx`
- print job repository/service in `packages/database` if absent

Plan:

- Add connector capability `label_printing`.
- RTX connector enumerates local printers.
- UWE Host creates print jobs.
- Connector polls/receives jobs and updates status.
- UI:
  - System → Drucker
  - World → Labels & Print
  - printer selection
  - preview
  - queue
  - status/error states

Tests:

- connector capability test.
- print queue service test.

### QF11 — Knowledge Text / Brain Action

Files:

- `packages/ai-brain`
- `apps/studio/app/brain-actions.ts`
- `apps/studio/app/worlds/[worldSlug]/brain/*`
- `apps/studio/app/worlds/[worldSlug]/import/*`
- page detail action UI.

Plan:

- Add action `create_knowledge_text`.
- Optional internal `create_brain_document`.
- Inputs:
  - raw text
  - page/session refs
  - privacy/provider mode
- Output:
  - title
  - summary
  - structured knowledge text
  - recognized NPCs/locations/factions
  - suggested links
  - target page type
- Enforce privacy: private world context not sent to cloud without explicit permission.

Tests:

- action schema test.
- privacy guard test.

### QF12 — UWE KnowHow Wiki

Files:

- `apps/studio/app/system/uwe-knowhow/page.tsx`
- new package/service if needed, e.g. `packages/cookbook` extension or `packages/database/src/system-knowledge*`
- docs indexer script

Plan:

- Sources:
  - README
  - docs
  - CHANGELOG
  - feature matrix
  - setup docs
- Index/search system help separately from world brain.
- Show source paths and update timestamp.

Tests:

- indexer test.
- search test.

### QF13 — Owner Host Control

Files:

- `apps/studio/app/system/host-control/page.tsx`
- `apps/studio/app/admin/setup/*` reuse
- `packages/auth` owner guard
- `packages/database` audit log service

Plan:

- Owner-only page with:
  - public/studio/portal URLs
  - auth required
  - Cloudflare status
  - RTX connector token status (masked)
  - AI/Ollama settings
  - printer settings
  - backup/restore
  - DB migration status
  - logs
  - healthcheck
  - optional restart/update flow
- Never render secret values.
- Audit all sensitive actions.

Tests:

- owner-only route/API tests.
- secret masking tests.

### QF14 — Replace Server Component Error UX

Files:

- `apps/studio/app/error.tsx`
- `apps/studio/app/not-found.tsx`
- `apps/portal/app/error.tsx`
- `apps/portal/app/not-found.tsx`
- shared error components
- API error helper package/module

Plan:

- Central error UI:
  - owner diagnostic version
  - player-safe version
- Owner diagnostics:
  - route
  - user id/email where safe
  - role
  - worldSlug
  - timestamp
  - digest
  - log hint
- APIs return structured error codes.

Tests:

- error component unit/smoke.
- API error helper tests.

## Phase 9 — Obsidian-Like Wiki Core

### Files/Areas

- `apps/studio/app/worlds/[worldSlug]/page.tsx`
- `apps/studio/app/worlds/[worldSlug]/[category]/[slug]/page.tsx`
- `apps/studio/app/worlds/[worldSlug]/[category]/[slug]/edit/page.tsx`
- `apps/studio/components/StudioWikiPageView.tsx`
- `packages/shared-ui/src/GraphView.tsx` or new React Flow graph component
- page/link services in `packages/database`

### Features

- TanStack Table page list:
  - type filter
  - search
  - tags
  - visibility
  - status
  - last changed
  - column visibility
  - sorting/pagination
- Detail page:
  - Tiptap editor embedded in new shell
  - right context panel
  - backlinks
  - outgoing links
  - related pages
  - `[[Wiki Links]]`
  - missing page detection
  - create missing page
  - broken links
  - canon/status/visibility visible
- Graph:
  - React Flow / `@xyflow/react`
  - connection matrix
  - broken-link visualization
- Conversion:
  - markdown/text to page
  - knowledge text to page/brain entry

### Acceptance Criteria

- Wiki feels like a knowledge space, not admin forms.
- Type filters do not create new navigation worlds.
- Links/backlinks are central.

## Phase 10 — Portal Login-First Rework

### Files

- `apps/portal/app/page.tsx`
- `apps/portal/app/portal/page.tsx`
- `apps/portal/app/login/page.tsx`
- `apps/portal/app/auth/worlds/*`
- `apps/portal/app/worlds/*`
- `apps/portal/src/navigation/portal-nav.ts`
- `apps/portal/src/components/shell/PortalShell.tsx`

### Tasks

- Make login-first the default.
- Remove public world discovery from main nav.
- Keep public share links if required, but not as primary portal flow.
- „Meine Welten“ empty state for no membership.
- Ensure membership access failures explain the reason.

### Acceptance Criteria

- Unauthenticated `/` and `/portal` -> login.
- Authenticated -> Meine Welten.
- No public discovery as main flow.

## Phase 11 — RTX Connector Client Rework

### Files

- `apps/rtx-connector-client/src/navigation/connector-nav.ts`
- `apps/rtx-connector-client/src/components/shell/ConnectorShell.tsx`
- `apps/rtx-connector-client/src-tauri/src/lib.rs`

### Areas

- Host-Verbindung
- Runner/Ollama
- Modelle
- Drucker
- Jobs
- Logs
- Diagnose

### Acceptance Criteria

- Stable connector nav.
- Ollama tests are structured and windowless.
- Printer capability visible if implemented.

## Phase 12 — Tests

### Update Existing Tests

- `apps/studio/src/lib/studio-navigation.test.ts`
- `apps/studio/src/lib/mobile-nav.test.ts`
- `apps/portal/src/lib/portal-navigation.test.ts`
- `packages/auth/src/security/route-policy.test.ts`
- `packages/auth/src/security/middleware.test.ts`
- `scripts/studio-route-auth.test.ts`
- security leak tests if route changes affect Portal.

### Add New Tests

- central navigation hrefs point to existing routes.
- central navigation feeds sidebar/breadcrumb/command.
- Portal no login -> login.
- Portal with user -> Meine Welten.
- world cockpit renders.
- wiki pages render.
- type filters work.
- factions does not crash.
- sessions create.
- dungeons create.
- layout API GET/PUT works.
- RTX test error renders real message.
- version visible.
- Cloudflare expected URLs visible.
- no old route is active-linked unless migrated.

### Commands

Run during execution:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm build:release`

Optional/full before PR:

- `pnpm quality`

### Acceptance Criteria

- CI-relevant tests updated to new IA.
- No fake/no-op checks.

## Phase 13 — Documentation

### Create/Update

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_MATURITY_MATRIX.md`
- `docs/design/new-ui-stack.md`
- `docs/rework/hard-ui-ux-reset-plan.md`
- `docs/cloudflare-current-setup.md`
- `docs/ROADMAP.md`

### Docs Audit

Audit every file under `docs/`:

- keep
- update
- archive
- delete

Constraints:

- Required by docs-check:
  - `README.md`
  - `AGENTS.md`
  - `docs/engineering/ci.md`
  - `docs/engineering/cursor-workflow.md`
  - `docs/engineering/migration-from-copilot.md`
  - `docs/engineering/self-hosted-ci.md`
- Every Markdown file must start with `#`.
- No tab characters.

### Acceptance Criteria

- Docs match new product model.
- Old misleading docs are removed/archived/updated.
- New docs pass `pnpm docs:check`.

## Phase 14 — Final Validation and PR

### Required Output Summary

At the end, provide:

1. Branchname
2. new UI stack
3. new shell structure
4. new navigation
5. newly re-bound features
6. features functionally retained but UI-open
7. quick-fix results
8. Cloudflare changes
9. tests/build result
10. known risks
11. next tasks

### Final Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm build:release`
- preferably `pnpm quality`

### PR Notes

- Use draft PR by default.
- Include migration notes and screenshots/videos if GUI QA was performed.

## Major Risks

1. Scope is large enough for multiple PRs. A single massive PR may become unreviewable.
2. Tailwind/shadcn migration conflicts with existing bespoke `--uwe-*` CSS system unless bridged carefully.
3. Cloudflare path routing may be less stable than split hostnames; recent repo history already points toward split-hostname architecture.
4. Portal changes are security-sensitive; must run security tests for visibility/auth.
5. Session/Dungeon fixes touch data/service flows; regression tests are required.
6. Docs deletion can break `docs:check` or remove important historical deployment knowledge if not audited carefully.

## Recommended Execution Order

1. Foundation docs + UI stack.
2. Central nav + shells.
3. Portal route/login-first + Cloudflare docs.
4. Layout API fix.
5. Sessions/Dungeons/Factions fixes.
6. Wiki core.
7. System pages: Navigation, Version, Cloudflare, Host Control.
8. RTX/Ollama + print capability.
9. Knowledge text + UWE KnowHow.
10. Error UI.
11. Docs audit and final CI.

## Parallelization & Agent Cut

Recommended: max 4–5 parallel agents, but in waves. Bottlenecks (central navigation, shells, `packages/auth/src/security/route-policy.ts`, shared test files) must not be edited by multiple agents at once.

### Wave 0 — Foundation (1 agent, serial, blocking)

Builds the shared contract everyone consumes:

- Phase 1: new UI stack (Tailwind/shadcn/Radix/Lucide/cva, `tailwind.config`, `components/ui/*`)
- Phase 3: central navigation (`apps/*/src/navigation/*.ts`)
- Phase 4: shell architecture (`StudioShell`/`WorldShell`/`PortalShell`/`SystemShell`/`ModuleShell`/`SettingsShell`)
- Phase 2: analysis doc

Output: nav types, shell props, UI primitives — the contract for all later agents.

### Wave 1 — Breadth (4–5 agents in parallel)

| Agent | Scope | Main files |
|---|---|---|
| A1 | Portal + Cloudflare (QF2, QF9, Phase 10) | `apps/portal/**`, `route-policy.ts`*, `docs/cloudflare-*` |
| A2 | World content: Sessions/Dungeons/Faction filter + Wiki core (QF4, QF5, QF6, Phase 9) | `apps/studio/app/worlds/**`, `dungeon-actions.ts`, `session-actions.ts` |
| A3 | System area: Navigation overview, Version, Host Control, Error UI, Layout-404 (QF1, QF8, QF13, QF14, Phase 7) | `apps/studio/app/system/**`, `error.tsx`, `route-policy.ts`* |
| A4 | RTX/Connector + label printing (QF7, QF10, Phase 11) | `apps/rtx-connector-client/**`, `tools/uwe-rtx-connector/**`, `packages/connector` |
| A5 (optional) | Knowledge/Brain: create_knowledge_text + UWE KnowHow + Users/Membership (QF3, QF11, QF12) | `packages/ai-brain`, `apps/studio/app/brain*`, `apps/studio/app/admin/users` |

\* Conflict zone: A1 and A3 both touch `route-policy.ts`. Give that file a single owner (A3); A1 submits its policy delta as a small increment, or fold both policy changes into Wave 0.

### Wave 2 — Integration & close (1–2 agents)

- Phase 12 tests onto new IA, Phase 13 docs audit, `pnpm quality`, final PR consolidation.

### Rule of thumb

`1 → 4(5) → 1–2`. More than 5 agents adds no speed because the bottlenecks (nav, shells, route-policy, test files) serialize anyway and only create conflicts. Optimum is 4 parallel agents in Wave 1.

## Approval Needed Before Execution

Please confirm:

- Use Tailwind/shadcn as the new standard while bridging existing `--uwe-*` tokens.
- Prefer split hostnames for Cloudflare (`studio.uweanddragons.org`, `portal.uweanddragons.org`) and keep `/portal` as defensive redirect/shim.
- Execute as a phased rework on this branch, accepting that some features may be marked `legacy-ui-disconnected` temporarily while backend remains intact.
