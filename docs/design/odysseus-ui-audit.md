# Odysseus UI Audit (UWE)

Audit source: [pewdiepie-archdaemon/odysseus](https://github.com/pewdiepie-archdaemon/odysseus) (AGPL-3.0-or-later).

Date: 2026-06-18

## License constraint

Odysseus is **AGPL-3.0-or-later**. UWE does not adopt AGPL for this integration. **No Odysseus source code was copied** into UWE. This audit informed independent design and architecture only.

## Files reviewed

| File | Focus |
|------|--------|
| `static/js/theme.js` | Preset themes, custom themes, localStorage, font/density/background/frosted glass |
| `static/style.css` | CSS variables (`--bg`, `--fg`, `--panel`, …), density, patterns, frosted glass |
| `static/index.html` | Inline head bootstrap to prevent theme flash |
| `static/js/storage.js` | JSON localStorage wrapper |
| `static/js/ui.js` | Modal/toast patterns (not ported) |
| `static/js/a11y.js` | Focus/ARIA helpers (concept only) |
| `static/js/settings.js` | Settings panel wiring (concept only) |
| `scripts/odysseus-theme` | CLI theme tooling (not ported) |

## Odysseus theme architecture (summary)

### Preset themes

Built-in presets include `dark`, `light`, `midnight`, `paper`, `terminal`, plus decorative sets (`cyberpunk`, `forest`, `ocean`, …). Each preset defines core hex tokens: `bg`, `fg`, `panel`, `border`, `red` (accent).

### Design tokens

- Core: `--bg`, `--fg`, `--panel`, `--border`, `--red`
- Derived syntax highlighting (`--hl-*`) computed from base colors
- Advanced overrides per UI zone (chat bubbles, sidebar, inputs, code blocks)
- Semantic colors (`--color-error`, `--color-success`, …)

### Runtime options

| Option | Values | Application |
|--------|--------|-------------|
| Font | mono / sans / serif (+ custom fonts via API) | `--font-family` |
| Density | compact / comfortable / spacious | Root class + font-size |
| Background | none, dots, synapse, rain, constellations, perlin-flow, petals, sparkles, embers | CSS + canvas |
| Frosted glass | on/off | `body.theme-frosted` |
| Effect color/intensity/size | sliders | `--bg-effect-*` |

### Persistence

- `localStorage` keys: `odysseus-theme`, `odysseus-custom-themes`
- Optional server sync via `/api/prefs/theme`
- Head inline script reads storage before paint

### Theme editor UX

- Draggable theme popup with preset swatches
- Customize tab with color pickers, harmony generator, import/export
- Zone highlight on hover (maps color input → DOM region)
- Peek mode (fade modal while editing)

### Mobile & a11y patterns observed

- `100dvh`, safe-area padding, `format-detection` meta
- Canvas backgrounds marked `aria-hidden="true"`
- Theme-color meta synced to `--bg`
- Density affects touch targets indirectly via font-size

## What UWE adopted (concepts only)

| Concept | UWE implementation |
|---------|-------------------|
| Token-based themes | `packages/shared-ui/src/theme/*` + `--uwe-*` CSS vars |
| Preset + workspace themes | `themes.ts` (UWE-native IDs and palettes) |
| localStorage persistence | `storage.ts` per scope (studio/portal) |
| No-flash bootstrap | `ThemeBootstrapScript` inline at body start |
| Font / density / background / frosted | `ThemeSettingsPanel` + `applyTheme.ts` |
| Animated backgrounds | Simplified `BackgroundEffect` (synapse, constellation) |
| Frosted panels | `body.uwe-theme-frosted` in `uwe.css` |
| Theme picker UI | Studio → Settings → Erscheinungsbild |

## What UWE deliberately did not adopt

- Odysseus chat-specific advanced color keys (bubbles, send button, …)
- Custom theme editor with harmony generator and import/export
- Server-side theme sync API
- Custom font upload pipeline
- Full canvas catalog (rain, petals, embers, perlin-flow, sparkles)
- Draggable theme modal / zone highlighter
- Syntax highlighting derivation (not needed for UWE wiki shell)
- Odysseus `theme.js` code structure or hex values 1:1

## Inspired theme naming

UWE ships **UWE-native theme IDs only**. External AGPL projects may inform mood boards during research; they do not appear in product identifiers or labels.

Retired draft IDs (`odysseus-*-inspired`) are migrated via `LEGACY_THEME_ID_MAP` for any early `localStorage` entries.
