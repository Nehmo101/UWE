# New UI Stack

The Hard UI/UX Reset introduces a single, modern component system. This document is the binding reference for the chosen stack, why it was chosen, what it replaces, and the migration rules.

## Chosen stack

### Core UI

- **Tailwind CSS v4** — central styling system. Design tokens via CSS variables, bridged to the existing `--uwe-*` theme tokens (see "Token bridge"). One spacing/radius/color/typography/shadow scale.
- **shadcn/ui-style primitives** — copy-in components built on Radix, living in each app under `src/components/ui/*`: Button, Card, Dialog, Dropdown, Tabs, Form, Input, Select, Sheet/Drawer, Command, Toast, Table, Alert/Empty/Error states.
- **Radix UI primitives** — accessible behavior for Dialog, Dropdown Menu, Tabs, Popover, Tooltip, Select, Scroll Area, Navigation Menu.
- **Lucide React** — single icon set. Replaces mixed emoji/text/inline-SVG icons. Central navigation stores icon names as strings; a resolver maps them to Lucide components at render time.
- **class-variance-authority + clsx + tailwind-merge** — component variants and a `cn()` helper. No ad-hoc className chains.

### Data & interaction

- **TanStack Table** — all larger tables (pages, users, sessions, dungeons, jobs, logs, navigation overview, print queue). Sorting, filtering, pagination, column visibility.
- **React Hook Form + Zod** (`@hookform/resolvers`) — all important forms (users, create world/page/session/dungeon, system/RTX/Cloudflare/printer settings).
- **cmdk** — global command palette, fed from the central navigation contract.
- **dnd-kit** — drag-and-drop (navigation editing, dashboard/widget layout, page block sorting, print queue). Already present in `packages/shared-ui`.
- **Sonner** — unified toasts (success/error/save/load/retry).

### Specialized

- **React Flow / @xyflow/react** — knowledge graph, page connections, broken-link visualization.
- **Tiptap** — kept (already integrated); embedded cleanly into the new page editor with wiki-link UX.
- **TanStack Query** — client-side fetch/mutate where it is currently ad-hoc: RTX status, Cloudflare status, printer queue, jobs, health checks, layout save.

## Why this stack

- Tailwind + shadcn + Radix is the de-facto modern Next.js/React component baseline: accessible, composable, copy-in (no heavyweight UI dependency lock-in), and themeable via CSS variables — which lets us reuse the existing `--uwe-*` theme tokens instead of throwing them away.
- TanStack Table/Query, React Hook Form + Zod, cmdk, dnd-kit, Sonner, and React Flow each replace a category of bespoke, inconsistent in-repo solutions with a well-supported standard.
- Zod and dnd-kit are already in the repo; Tiptap is already integrated — so we keep them and standardize their usage.

## What it replaces

| Old | New |
|---|---|
| Bespoke shells in `packages/shared-ui/src/shells/*`, `shells-v2/*` | New shells consuming the central navigation contract |
| Scattered nav arrays (`apps/studio/src/lib/studio-navigation.ts`, `world-nav.ts`, `global-nav.ts`, `apps/portal/src/lib/portal-navigation.ts`) | `@uwe/shared-utils/navigation` contract + `apps/*/src/navigation/*` |
| Hand-rolled command palette (`packages/shared-ui/src/CommandPalette.tsx`) | cmdk fed from navigation |
| Mixed emoji/text/SVG icons | Lucide React |
| Hand-written tables | TanStack Table |
| Ad-hoc fetch/loading state | TanStack Query |
| Custom graph SVG sizing (`GraphView.tsx`) | React Flow |
| Large hand-maintained CSS (`uwe.css`, `uwe-components.css`, `uwe-visual-polish.css`) | Tailwind utilities + tokens; legacy CSS retired progressively |

The legacy CSS and `--uwe-*` theme system are **not deleted up front**. They remain the source of truth for colors/spacing during the migration and are retired file-by-file as pages move to the new components.

## Token bridge

Tailwind's theme is mapped onto the existing `--uwe-*` variables so both systems render with one palette. Defined via `@theme` in each app's `globals.css`:

| Tailwind token | Source variable |
|---|---|
| `--color-background` | `--uwe-bg` |
| `--color-foreground` | `--uwe-fg` |
| `--color-card` | `--uwe-card` (fallback `--uwe-card-bg`) |
| `--color-muted` | `--uwe-muted` |
| `--color-muted-foreground` | `--uwe-fg-muted` |
| `--color-border` | `--uwe-border` |
| `--color-input` | `--uwe-input-bg` |
| `--color-ring` | `--uwe-focus-ring` |
| `--color-primary` | `--uwe-accent` |
| `--color-primary-foreground` | `--uwe-on-accent` |
| `--color-destructive` | `--uwe-danger` |
| `--color-accent` | `--uwe-accent-muted` |
| `--color-sidebar` | `--uwe-sidebar-bg` |
| `--color-sidebar-foreground` | `--uwe-sidebar-fg` |
| `--radius` | `--uwe-radius-md` |

Because tokens reference the existing theme variables, all 9 existing theme presets keep working without per-component theming.

## Migration rules

1. **Preflight is disabled / not imported.** Tailwind utilities are additive only; there is no global CSS reset, so existing bespoke CSS and markup render unchanged. (Import `tailwindcss/theme.css` + `tailwindcss/utilities.css`, not the full `tailwindcss` base.)
2. **No new hardcoded hex/rgba** in components — use Tailwind tokens (which resolve to `--uwe-*`) or `color-mix()` on them.
3. **One component source.** New UI uses `src/components/ui/*`; do not reintroduce bespoke buttons/cards/tables/forms.
4. **Icons via Lucide** only; navigation stores Lucide icon names as strings.
5. **Navigation is declarative and central** (`@uwe/shared-utils/navigation` + `apps/*/src/navigation`). Sidebar, mobile nav, breadcrumbs, command palette, and the System → Navigation overview all read from it.
6. **Cross-app boundaries respected.** Framework-agnostic contracts live in `packages/shared-utils`; React primitives may live in `packages/shared-ui` or per app, but `apps/studio` must not import from `apps/portal` and vice versa.
7. **Retire legacy CSS only after** a page is fully migrated and verified; never break a page to remove CSS.
8. **Every PR keeps `pnpm quality` green.**

## When a tool is not used

- **TanStack Query** is only introduced where client fetching is currently ad-hoc/chaotic; server components that already fetch on the server do not need it. Documented per-feature rather than applied blanket.
- **dnd-kit** stays limited to genuine drag-and-drop surfaces; ordering that can be done with simple controls should not pull in DnD.
- If any tool cannot be integrated sensibly in a given area, the reason and the chosen alternative are documented in that area's PR and reflected here.
