# UWE Theme System

## Overview

UWE uses a shared token-driven theme layer in `@uwe/shared-ui`:

```
packages/shared-ui/src/theme/
  tokens.ts              # CSS variable names, font/density maps
  themes.ts              # Preset definitions (10 UWE-native themes)
  storage.ts             # localStorage per app scope + legacy ID map
  applyTheme.ts          # Runtime application to DOM
  bootstrapScript.ts     # Inline no-flash bootstrap
  ThemeProvider.tsx      # React context + persistence
  ThemeSettingsPanel.tsx # Full client appearance settings
  BackgroundEffect.tsx   # Canvas effects (synapse, constellation)

packages/shared-ui/src/
  ThemePicker.tsx        # Accessible dark/light/system radio picker
  visual-theme.ts        # Server SSR data-uwe-* attributes
  VisualThemePreview.tsx # Live preview for server standards
  uwe.css                # Unified entry: design-v2 + legacy bridge + specialized widgets
  uwe-v2.css             # Deprecated alias → design-v2/index.css (use uwe.css)
  design-v2/             # V2 tokens, shell, components, layouts, mobile, wiki
  shells-v2/             # StudioShellV2, PortalShellV2, AdminShellV2
  layout-editor/         # Drag-and-drop dashboard layout editor
```

## App scopes

| App | Storage key | Default theme |
|-----|-------------|---------------|
| Studio | `uwe-theme-preferences-studio` | `uwe-werkbank` |
| Portal | `uwe-theme-preferences-portal` | `uwe-lesesaal` |

`DEFAULT_STUDIO_THEME_ID` is `uwe-werkbank`, `DEFAULT_PORTAL_THEME_ID` is `uwe-lesesaal` (`themes.ts`) — the Tinte-&-Papier rooms. Studio and Portal can still diverge per scope — a player can pick a dark theme for the Portal while Studio stays on Werkbank.

## Presets

| ID | Use case |
|----|----------|
| `uwe-werkbank` | **Studio default** — Tinte & Papier: cool workshop paper, ink sidebar, blueprint accent |
| `uwe-lesesaal` | **Portal default** — Tinte & Papier: bright reading paper, light top chrome, lamp-green accent |
| `uwe-nachtstudie` | **Brain default** — Tinte & Papier inverted: ink ground, paper text, candle-gold accent |
| `uwe-parchment-os` | Light parchment OS (former universal default) |
| `uwe-parchment-teal` | Parchment OS chrome with teal player-visible accent (Portal-Design) |
| `uwe-default` | Slate / indigo dark baseline |
| `uwe-dark-fantasy` | Deep fantasy workspace |
| `uwe-charcoal-desk` | Muted charcoal editing shell |
| `uwe-night-observatory` | Deep blue-black + starfield |
| `uwe-parchment-study` | Light parchment reading |
| `uwe-phosphor-console` | Green-on-black console |
| `terra` | Earthy campaign green |
| `hells` | Infernal red |

**Legacy IDs** are remapped via `LEGACY_THEME_ID_MAP` (no migration needed): the
retired `uwe-cockpit-red` and `uwe-portal-purple` both resolve to
`uwe-parchment-os`; the early `odysseus-*-inspired` preview IDs map to their
UWE-native equivalents.

## User preferences shape (client)

```typescript
interface UweThemePreferences {
  themeId: ThemeId;
  font: "mono" | "sans" | "serif";
  density: "compact" | "comfortable" | "spacious";
  background: "none" | "dots" | "synapse" | "constellation" | "parchment" | "noise";
  frostedGlass: boolean;
  uiScale: number; // 0.9 – 1.1
  bgEffectColor?: string;
  bgEffectIntensity: number; // 0 – 1
}
```

## DB ↔ Client sync

`settings.app.themePreferences` stores full `UweThemePreferences` per scope (`studio`, `portal`).

| Direction | Mechanism |
|-----------|-----------|
| Server → Client | `getSystemSettingsSnapshot()` in layouts; `ThemeBootstrapScript` + `ThemeProvider` merge by `updatedAt` |
| Client → Server | `saveThemePreferencesAction` (Studio, trusted) debounced 800ms from `ThemeProvider` |
| Portal defaults | Editable in Studio Settings → Erscheinungsbild → Portal-Standard |

Legacy fields (`theme`, `backgroundPattern`, `frostedGlass`) stay in sync for SSR `data-uwe-*` attributes.

## Server settings (SSR defaults)

Persisted in `settings.app` and exposed via `buildVisualThemeHtmlAttributes()`:

| Field | HTML attribute | Purpose |
|-------|----------------|---------|
| `theme` | `data-uwe-theme` | dark / light / system |
| `backgroundPattern` | `data-uwe-bg-pattern` | CSS background pattern |
| `frostedGlass` | `data-uwe-glass` | on / off |
| `motionEnabled` | `data-uwe-motion` | on / off |

Client preferences from `ThemeSettingsPanel` override these in the browser via `localStorage`.

## SSR / hydration

1. `<html>` receives `data-uwe-*` from server settings + `suppressHydrationWarning`.
2. `ThemeBootstrapScript` runs as first child of `<body>`, reads `localStorage`, sets CSS variables before paint.
3. `ThemeProvider` re-loads preferences on mount.
4. `ThemeDocumentSync` applies server `data-theme` for dark/light/system accessibility path.

## Design V2 (UI refresh, 2026-06)

Design V2 is **enabled by default**. Set `NEXT_PUBLIC_UWE_DESIGN_V2=false` to revert to legacy shells.

| Layer | Path |
|-------|------|
| CSS entry | `@uwe/shared-ui/uwe-v2.css` |
| Shells | `packages/shared-ui/src/shells-v2/` |
| Primitives | `ButtonV2`, `CardV2`, `PageHeaderV2` |
| Feature flag | `isDesignV2Enabled()` in `design-v2-feature.ts` |
| Body marker | `data-uwe-design-v2="true"` on `<body>` |

### Element overrides (per scope)

Beyond preset themes, users can override zone colors in **Settings → Erscheinungsbild**:

| Override | CSS variable |
|----------|--------------|
| Seitenband (Sidebar/Topbar) | `--uwe-zone-chrome-bg`, `--uwe-zone-chrome-fg` |
| Überschriften | `--uwe-zone-heading-fg`, `--uwe-zone-heading-font` |
| Karten | `--uwe-zone-card-bg`, `--uwe-zone-card-border` |

Stored in `UweThemePreferences.elementOverrides` (client + `settings.app.themePreferences`).

### Dashboard layout editor

Overview pages (`/today`, `/studio`, world dashboard, Portal player dashboard) support drag-and-drop widget reordering via **Layout bearbeiten** → **Anwenden**. Layouts persist per user in `DashboardLayout` (Prisma).

## Studio UI

**Settings → Erscheinungsbild** (`/settings?tab=appearance`):

- **Client:** `ThemeSettingsPanel` — presets, font, density, background, glass, scale
- **Server:** form with `ThemePicker` + `VisualThemePreview` for global defaults

### Application shells (workspace cockpit)

Studio and Portal use shared shells from `@uwe/shared-ui` and app wrappers — **no Tailwind/shadcn parallel system**.

| Shell | Location | When to use |
|-------|----------|-------------|
| `StudioShell` + `StudioAppShell` | `packages/shared-ui`, `apps/studio/components` | Studio dashboard, modules, admin |
| `WorldModuleShell` | `apps/studio/components` | World-scoped DM routes — keeps sectioned Studio nav + world nav |
| `AdminModuleShell` | `apps/studio/components` | Thin wrapper over `StudioAppShell variant="module"` |
| `PortalShell` + `PortalGuestShell` | `packages/shared-ui`, `apps/portal/src/components` | Player wiki and share links |
| `PortalAppShell` | `apps/portal/src/components` | Authenticated player hub |

**Rules for feature pages:**

- Use `uwe-*` classes and semantic tokens (`--uwe-accent`, `--uwe-surface`, …) — avoid hardcoded hex in `apps/*/app/**` pages.
- Buttons: `uwe-btn`, `uwe-btn-primary`, `uwe-btn-ghost`
- Cards: `uwe-card`, `uwe-stat-card`, `uwe-dashboard-grid`
- Badges: `VisibilityBadge`, `PublishBadge`, `.uwe-badge-*` via `StatusBadges.tsx`

## Semantic CSS utilities

| Class / token | Purpose |
|---------------|---------|
| `--uwe-surface`, `.uwe-surface` | Cards, panels |
| `--uwe-panel` | Topbar, sidebars |
| `--uwe-accent` | Primary actions |
| `--uwe-wiki-link` | Wiki links |
| `--uwe-dm-only` | GM-only emphasis |
| `--uwe-player-visible` | Player-safe emphasis |
| `--uwe-focus-ring` | Focus-visible outline |
| `--uwe-label-print-bg` | Label print preview iframe (defaults to white) |
| `body.uwe-theme-frosted` | Glass blur on shell surfaces |

## Creating a new theme

1. Add a `ThemeId` union member in `themes.ts`.
2. Define `UweThemeDefinition` with full `ThemeColorTokens`.
3. Optional `defaults` for background, font, frosted glass.
4. Register in `UWE_THEMES` — automatically appears in picker and bootstrap map.
5. Add test id to `theme.test.ts` required list.
6. Document in this file.

## API for components

```tsx
import { useUweTheme, ThemeProvider, ThemePicker } from "@uwe/shared-ui";

function MyPanel() {
  const { preferences, updatePreferences } = useUweTheme();
  // ...
}
```

## Background effects

| Pattern | Implementation |
|---------|----------------|
| dots, parchment, noise | Pure CSS (`uwe-visual-polish.css`) |
| synapse, constellation | CSS grid + `BackgroundEffect` canvas |

Intensity controlled via `--uwe-bg-effect-intensity` and preference slider.

## Accessibility

- `ThemePicker`: fieldset + radio, labeled swatches, SR “Aktiv ausgewählt”
- Touch targets: `--uwe-touch-min: 2.75rem`
- `prefers-reduced-motion` respected in visual polish CSS
- Checklist: [theme-a11y-checklist.md](./theme-a11y-checklist.md)

## Related docs

- [odysseus-ui-architecture-analysis.md](./odysseus-ui-architecture-analysis.md) — full UI system (Phases 1–5 implemented)
- [theme-orchestration.md](./theme-orchestration.md) — subagent execution order
- [theme-qa-report.md](./theme-qa-report.md) — regression report
- [uwe-current-design-audit.md](./uwe-current-design-audit.md)
- [odysseus-ui-audit.md](./odysseus-ui-audit.md)
- [odysseus-license-risk.md](./odysseus-license-risk.md)
- [theme-migration-notes.md](./theme-migration-notes.md)
