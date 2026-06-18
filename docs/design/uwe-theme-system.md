# UWE Theme System

## Overview

UWE uses a shared token-driven theme layer in `@uwe/shared-ui`:

```
packages/shared-ui/src/theme/
  tokens.ts          # CSS variable names, font/density maps
  themes.ts          # Preset definitions
  storage.ts         # localStorage per app scope
  applyTheme.ts      # Runtime application to DOM
  bootstrapScript.ts # Inline no-flash bootstrap
  ThemeProvider.tsx  # React context + persistence
  ThemeSettingsPanel.tsx
  BackgroundEffect.tsx
```

CSS consumes tokens via `packages/shared-ui/src/uwe.css` (`--uwe-*` variables).

## App scopes

| App | Storage key | Default theme |
|-----|-------------|---------------|
| Studio | `uwe-theme-preferences-studio` | `uwe-default` |
| Portal | `uwe-theme-preferences-portal` | `uwe-portal-purple` |

Studio and Portal can diverge — a player can use purple Portal while Studio stays slate/indigo.

## Presets

| ID | Use case |
|----|----------|
| `uwe-default` | Studio baseline (slate / indigo) |
| `uwe-dark-fantasy` | Deep fantasy workspace |
| `uwe-portal-purple` | Player portal default |
| `uwe-charcoal-desk` | Muted charcoal editing shell |
| `uwe-night-observatory` | Deep blue-black + starfield |
| `uwe-parchment-study` | Light parchment reading |
| `uwe-phosphor-console` | Green-on-black console |
| `terra` | Earthy campaign green |
| `hells` | Infernal red |

## User preferences shape

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

## SSR / hydration

1. `ThemeBootstrapScript` runs synchronously as the first child of `<body>`.
2. Reads `localStorage` and sets CSS variables on `:root` before React paints.
3. `ThemeProvider` re-loads preferences on mount and keeps DOM in sync.

`suppressHydrationWarning` is set on `<html>` because client theme may differ from server defaults.

## Studio UI

**Settings → Erscheinungsbild** (`/settings?tab=appearance`) hosts `ThemeSettingsPanel`.

Server-side `settings.app.theme` (`dark` / `light` / `system`) remains in the database for a future sync path; client appearance is local-first today.

## Semantic CSS utilities

| Class / token | Purpose |
|---------------|---------|
| `--uwe-surface`, `.uwe-surface` | Cards, panels |
| `--uwe-panel` | Topbar, sidebars |
| `--uwe-accent` | Primary actions |
| `--uwe-wiki-link` | Wiki links |
| `--uwe-dm-only` | GM-only emphasis |
| `--uwe-player-visible` | Player-safe emphasis |
| `body.uwe-theme-frosted` | Glass blur on shell surfaces |

## Creating a new theme

1. Add a `ThemeId` union member in `themes.ts`.
2. Define `UweThemeDefinition` with full `ThemeColorTokens` (no partial palettes).
3. Optional `defaults` for background, font, frosted glass.
4. Register in `UWE_THEMES` — automatically appears in picker and bootstrap map.
5. Add test id to `theme.test.ts` required list.
6. Document in this file.

Example:

```typescript
"my-campaign": {
  id: "my-campaign",
  label: "My Campaign",
  description: "Short player-facing description.",
  colors: { /* all ThemeColorTokens fields */ },
  defaults: { background: "dots" },
},
```

## API for components

```tsx
import { useUweTheme, ThemeProvider } from "@uwe/shared-ui";

function MyPanel() {
  const { preferences, updatePreferences } = useUweTheme();
  // ...
}
```

## Background effects

| Pattern | Implementation |
|---------|----------------|
| dots, parchment, noise | Pure CSS |
| synapse, constellation | CSS grid + `BackgroundEffect` canvas |

Intensity controlled via `--uwe-bg-effect-intensity` and preference slider.

## Related docs

- [odysseus-ui-audit.md](./odysseus-ui-audit.md)
- [odysseus-license-risk.md](./odysseus-license-risk.md)
- [theme-migration-notes.md](./theme-migration-notes.md)
