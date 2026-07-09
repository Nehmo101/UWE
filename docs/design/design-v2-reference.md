# Design V2 — Referenz

**Stand:** Juni 2026  
**Quelle:** `docs/design/GitHub Repository UWE-Analyse.zip` → `UWE Handoff.dc.html`  
**Handoff-Dokumentation:** `docs/design/parchment-os-handoff.md`

## Visuelle Leitlinien

| Aspekt | Vorgabe |
|--------|---------|
| Standard-Theme | `uwe-parchment-os` (hell, Pergament) |
| Topbar | 54px, ink-bordered |
| Sidebar | 236px, dunkles Ink-Chrome vs. warme Hauptfläche |
| Lesebreite | max. 52rem (`--uwe-v2-reader-max`) |
| Mobile Breakpoint | 390px primär, Bottom-Nav ≤960px |
| Icons | SVG (keine Emoji in Bottom-Nav) |

## Token-Mapping (`packages/shared-ui/src/design-v2/tokens.css`)

| Zone | CSS-Variable |
|------|--------------|
| Chrome (Sidebar/Topbar) | `--uwe-zone-chrome-bg`, `--uwe-zone-chrome-fg` |
| Überschriften | `--uwe-zone-heading-fg`, `--uwe-zone-heading-font` |
| Karten | `--uwe-zone-card-bg`, `--uwe-zone-card-border` |
| Wiki-Lesen | `--uwe-reader-fg`, `--uwe-reader-heading` |
| Layout | `--uwe-v2-sidebar-width` (236px), `--uwe-v2-topbar-height` (54px) |

Benutzer-Overrides: Settings → Erscheinungsbild → Zonen-Farbwähler.

## Abnahme-Screens

Referenzbilder: `docs/design/scraps/today-desktop.png`, `today-mobile.png`

### Studio (Desktop ≥1280px + Mobile 390px)

1. `/today` — Daily Cockpit, Layout-Editor, System-Ampel
2. `/worlds/terra/lore/[slug]` — Wiki-Detail, Graph kompakt
3. `/settings?tab=appearance` — Theme-Presets + Zonen-Overrides

### Portal

1. `/worlds/terra` — Öffentliche Welt
2. `/auth/worlds/terra` — Spieler-Dashboard
3. `/login` — Auth-Flow

### Theme-Presets (alle 10)

`uwe-parchment-os`, `uwe-parchment-teal`, `uwe-default`, `uwe-dark-fantasy`, `uwe-charcoal-desk`, `uwe-night-observatory`, `uwe-parchment-study`, `uwe-phosphor-console`, `terra`, `hells`

Automatisiert: `packages/shared-ui/src/design-v2/design-v2.test.ts`

## CSS-Architektur

```
uwe.css
  ├── design-v2/index.css   (tokens, shell, components, layouts, mobile, wiki, parchment-os-shell)
  ├── design-v2/legacy-bridge.css
  ├── uwe-visual-polish.css
  └── uwe-components.css    (Command Palette, Label Editor, spezialisierte Widgets)
```

App-spezifisch: `globals.css` (Capture FAB, Settings), `wiki-extensions.css` (Studio AI-Panel).
