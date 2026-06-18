# UWE Theme System

## Overview

UWE uses a shared token-driven theme layer in `@uwe/shared-ui`:

```
packages/shared-ui/src/theme/
  tokens.ts              # CSS variable names, font/density maps
  themes.ts              # Preset definitions (9 UWE-native themes)
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
  uwe.css                # Token layer + component styles
  uwe-visual-polish.css  # Patterns, glass, scrollbars, motion
```

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

## Studio UI

**Settings → Erscheinungsbild** (`/settings?tab=appearance`):

- **Client:** `ThemeSettingsPanel` — presets, font, density, background, glass, scale
- **Server:** form with `ThemePicker` + `VisualThemePreview` for global defaults

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

- [theme-orchestration.md](./theme-orchestration.md) — subagent execution order
- [theme-qa-report.md](./theme-qa-report.md) — regression report
- [uwe-current-design-audit.md](./uwe-current-design-audit.md)
- [odysseus-ui-audit.md](./odysseus-ui-audit.md)
- [odysseus-license-risk.md](./odysseus-license-risk.md)
- [theme-migration-notes.md](./theme-migration-notes.md)
