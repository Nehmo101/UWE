# Design V2 — Referenz (Fallback ohne UWE-Analyse.zip)

**Stand:** Juni 2026  
**Quelle:** `docs/design/uwe-ansichten-analyse-und-plan.md`, `docs/design/odysseus-ui-architecture-analysis.md`, Parchment OS Preset

Die Zip-Datei „UWE-Analyse.zip“ war nicht im Repository verfügbar. Dieses Dokument definiert die abgenommenen Design-Tokens und QA-Kriterien für den UI-Refresh.

## Visuelle Leitlinien

| Aspekt | Vorgabe |
|--------|---------|
| Standard-Theme | `uwe-parchment-os` (hell, Pergament) |
| Topbar | 54px, ink-bordered |
| Sidebar | Dunkles Ink-Chrome vs. warme Hauptfläche |
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

Benutzer-Overrides: Settings → Erscheinungsbild → Zonen-Farbwähler.

## Abnahme-Screens (manuell)

### Studio (Desktop ≥1280px + Mobile 390px)

1. `/today` — Daily Cockpit, Layout-Editor, System-Ampel
2. `/worlds/terra/lore/[slug]` — Wiki-Detail, Graph kompakt, keine grauen Fremdkörper
3. `/settings?tab=appearance` — Theme-Presets + Zonen-Overrides

### Portal

1. `/worlds/terra` — Öffentliche Welt, ruhige Lesefläche
2. `/auth/worlds/terra` — Spieler-Dashboard, Layout-Editor
3. `/login` — Auth-Flow

### Theme-Presets (alle 9)

`uwe-parchment-os`, `uwe-default`, `uwe-dark-fantasy`, `uwe-charcoal-desk`, `uwe-night-observatory`, `uwe-parchment-study`, `uwe-phosphor-console`, `terra`, `hells`

Automatisiert: `packages/shared-ui/src/design-v2/design-v2.test.ts`

## CSS-Architektur

```
uwe.css
  ├── design-v2/index.css   (tokens, shell, components, layouts, mobile, wiki)
  ├── design-v2/legacy-bridge.css
  ├── uwe-visual-polish.css
  └── uwe-components.css    (Command Palette, Label Editor, spezialisierte Widgets)
```

App-spezifisch: `globals.css` (Capture FAB, Settings), `wiki-extensions.css` (Studio AI-Panel).
