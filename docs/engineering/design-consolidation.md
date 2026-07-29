# Design-Konsolidierung — Arbeitsplan & Regeln

> Stand: 2026-07-10 · Grundlage: [UI-Assessment](ui-assessment.md) (181 Seiten, häufigste Schwäche: Mix aus drei Styling-Generationen) · Verbindliche Ziel-Referenz: [docs/design/new-ui-stack.md](../design/new-ui-stack.md)

## Ziel

Jede Seite nutzt **eine** Styling-Generation: Tailwind-Utilities + Kit-Komponenten aus
`apps/<app>/src/components/ui/*` (shadcn-Stil, Radix, Lucide). Die Generationen
Legacy-`uwe-*` (uwe.css/uwe-components.css), `uwe-v2-*` (design-v2) und Portal-`auth-*`/`portal-*`
werden **seitenweise** abgelöst — niemals CSS global löschen, bevor alle Nutzer migriert sind
(Migrationsregel 7 in new-ui-stack.md).

## Ist-Stand messen

```bash
node scripts/design-consolidation-inventory.mjs            # Zusammenfassung
node scripts/design-consolidation-inventory.mjs --json     # pro Seite
node scripts/design-consolidation-inventory.mjs --app portal
```

Stand heute: Studio 148 Seiten (88 gemischt, 27 legacy, 6 v2), Portal 33 Seiten (21 legacy).
Achtung: Das Script zählt nur `page.tsx` — Seiten, deren UI in Komponenten lebt
(`apps/*/components/**`), zählen erst als fertig, wenn auch diese Komponenten migriert sind.

## Definition of Done (pro Seite)

1. Keine `uwe-*`-, `uwe-v2-*`-, `auth-*`-, `portal-*`-Klassen mehr in page.tsx **und** ihren
   seitenspezifischen Komponenten (geteilte Shell-Komponenten ausgenommen, solange sie nicht dran sind).
2. Höchstens 2 `style={{…}}`-Inline-Styles (nur für echt dynamische Werte wie Prozentbreiten).
3. Komponenten aus dem Kit (`Button`, `Card`, `Badge`, `Input`, `Select`, `Tabs`, `EmptyState`,
   `ErrorState`, `LoadingState`, `DataTable` …) — keine neuen Bespoke-Elemente.
4. Icons über Lucide (`icon.tsx`-Resolver), keine Emoji/Unicode-Glyphen.
5. Farben/Abstände über Tailwind-Tokens (bridged auf `--uwe-*`) — keine Hex/RGBA-Literale.
6. Verhalten unverändert: Server Actions, Datenzugriffe, dm_only-/RBAC-Logik nicht anfassen.
7. `pnpm ci:light` grün; Seite im Dev-Server gegen mindestens 1 Theme gesichtet (hell + dunkel wenn möglich).

## Mapping-Spickzettel

| Alt | Neu |
|---|---|
| `uwe-panel`, `uwe-v2-card`, `uwe-today-card` | `<Card><CardHeader><CardTitle>…</CardTitle></CardHeader><CardContent>…` |
| `uwe-v2-btn[-primary/-secondary/-ghost/-sm/-danger]` | `<Button variant="default/secondary/ghost/destructive" size="sm">` |
| `uwe-badge[-published/-secret/-draft]` | `<Badge variant="…">` (Varianten in badge.tsx prüfen/ergänzen) |
| `uwe-page-table`, `uwe-table` | kleine Tabellen: semantisches `<table>` mit Tailwind; große Listen: `DataTable` |
| `uwe-form-grid`, `uwe-brain-create-form`, `uwe-v2-form` | Kit-`Input`/`Label`/`Select` + `grid gap-3` Utilities |
| `uwe-dashboard-muted`, `uwe-hint`, `auth-muted` | `text-muted-foreground text-sm` |
| `uwe-form-error` | `ErrorState` bzw. `text-destructive` + `role="alert"` |
| `uwe-flash uwe-flash-success` | Toast (Sonner) wo client-seitig; sonst `Alert`-Pattern aus states.tsx |
| `uwe-list-cards`/`uwe-list-card` (Übergangs-CSS) | `<ul className="grid gap-2">` + `Card`-basierte Zeilen |
| `style={{ marginTop: "1rem" }}` u. ä. | `mt-4` etc. |
| Portal `auth-block`, `portal-content-card` | Kit-`Card` im Portal (`apps/portal/src/components/ui`) |

Fehlt dem Kit etwas (z. B. eine Badge-Variante), wird es **im Kit ergänzt** (copy-in, klein),
nicht per Ad-hoc-CSS gelöst.

## Arbeitspakete & Ownership

Parallelarbeit nur mit **disjunkten Datei-Scopes**. Aktuelle Aufteilung:

| Paket | Scope | Owner | Branch |
|---|---|---|---|
| P1 Portal komplett | `apps/portal/**` (21 Legacy-Seiten + Portal-Kit) | Cursor-Agent | `cursor/design-portal` |
| S1 Studio Daily-Admin | `apps/studio/app/{finance,household,contracts,documents,ideas,bugs,jobs,projects}/**` | Claude-Session | `claude/site-ui-assessment-5ay1ow` |
| S2 Studio Kitchen+Workshop | `apps/studio/app/{kitchen,workshop,miniatures}/**` | Claude-Session | dito |
| S3 Studio Admin/System | `apps/studio/app/{admin,system}/**` | Claude-Session | dito |
| S4 Studio Worlds | `apps/studio/app/worlds/**` | Claude-Session | dito |
| S5 Studio Rest + geteilte Komponenten | `apps/studio/{components,src/components}/**`, Top-Level-Seiten | Claude-Session, zuletzt | dito |

Regeln für alle Owner:
- **Nie** Dateien außerhalb des eigenen Scopes ändern. Gemeinsame Dateien
  (`packages/shared-ui/**`, `packages/**` allgemein) ändert in dieser Phase **niemand** —
  Bedarf wird als TODO im PR/Commit-Text notiert.
- Kleine Commits pro Seitengruppe, Commit-Message-Präfix `style(scope): …`.
- Vor jedem Push: `pnpm ci:light`.
- Fortschritt messbar machen: Inventar-Script vorher/nachher in die Commit-Message.

## Reihenfolge / Risiko

1. Zuerst flächige, in sich geschlossene Seiten (Daily Admin, Kitchen, Admin) — mechanisch, wenig Risiko.
2. Danach Worlds (viele geteilte Komponenten unter `apps/studio/components/**`).
3. Geteilte Shell/`packages/shared-ui` zuletzt und als eigener, reviewter Schritt.
4. Legacy-CSS-Dateien (`uwe.css` & Co.) erst schrumpfen, wenn das Inventar für alle Nutzer-Seiten 0 meldet.

## Shell-Phase: Stand & dokumentierte Ausnahmen (2026-07)

Die Blätter von `packages/shared-ui` (StatusBadges, GraphView-Chrome, Soundboard,
Mobile-/CommandPalette-Chrome, Feedback, Theme-Panels, Shells-Widgets, Auth-Widgets)
sind auf Tailwind-Utilities migriert; beide Apps laden dafür
`@source "../../../packages/shared-ui/src"` in ihrer `globals.css`.

**Rückbau (2026-07):** Der Legacy-App-Rahmen (`AppShell`, `SidebarNav`,
`TopBarBrand`, `SearchField`, `Breadcrumb`, `PageHeader` in shared-ui) wurde
**entfernt** — beide Apps rendern seit PR 766 ihren eigenen Kit-Shell
(`apps/<app>/src/components/shell/`). Ebenfalls entfernt (tote Exporte ohne
Importe): `navigation/*`, die Gen-1-Primitives (`Card`, `Input`, `Textarea`,
`Select`, `Badge`, `Dialog`, `Table`, `Toast`, `ErrorState`, `SidebarItem`,
`RailButton`, `BackLink`; `Button` bleibt nur intern für
`CopyToClipboardButton`), `AdminShell`, `StudioStatusFooter`, `PageHeaderV2`,
`MobileContextPanel`, `MobileSidebarContent`, `PageListCards` sowie
`apps/studio/src/lib/cockpit-status.ts`.

**Dauerhafte bzw. bis zum Theme-Rebuild bestehende Ausnahmen:**

| Bereich | Klassen | Grund |
|---------|---------|-------|
| **Static-Export** (`packages/static-export`) | `uwe-shell`, `uwe-topbar`, `uwe-sidebar`, `uwe-main`, `uwe-context`, `uwe-brand*`, `uwe-breadcrumb*`, `uwe-page-header/-meta`, `uwe-portal-hero*`, `uwe-search`, `uwe-tag` | Die HTML-Templates des statischen Wiki-Exports/Atlas-Viewers rendern diese Klassen in eigenständige Bundles — inkl. der Parchment-Overrides in uwe.css. |
| Sidebar-Inhalt (`SidebarSection`) | `uwe-sidebar-section` | Parchment-Theme-Skins stylen `.uwe-sidebar-section h3` gezielt (uwe.css); zusätzlich Static-Export-Nutzer. |
| Landing/Login (`auth/UweLandingPage*`) | `uwe-lp-*` | In sich geschlossenes Design mit eigener `uwe-landing.css` (Animationen, Hero). Kein Generationen-Mix — bleibt als bespoke Stylesheet. |
| Frosted-Theme-Hook | `uwe-glass-surface` | Reine Marker-Klasse ohne Basis-Styling; `body.uwe-theme-frosted .uwe-glass-surface` (uwe.css) liefert den Glass-Effekt für bereits migrierte Flächen. |
| Wiki-Render | `uwe-v2-wiki`, `uwe-v2-wiki-content`, `uwe-v2-aside` | Render-Pipeline-Klassen (wiki.css beider Apps). |
| Mobile-Zustands-CSS | `uwe-bottom-nav`, `uwe-sticky-action-bar`, `uwe-filter-sheet-panel/-content`, `uwe-collapsible-sidebar` | Zustands-/Kind-Selektoren + Glass/Motion-Overrides in uwe.css/uwe-visual-polish.css. |
| JS/CSS-Hooks | `uwe-topbar-end`, `uwe-capture-fab`, `uwe-has-sticky-actions`, `uwe-soundboard` (Portal-Spacing-Hook) | Werden per `getElementById`/Selektor angesprochen bzw. extern gestylt — keine Styling-Klassen. |

**Paket-D-Ergebnis (2026-07-11):** ThemePicker und VisualThemePreview sind
token-basiert (Zustand steuert Utilities/Inline-Pattern statt
`html[data-uwe-*]`-Selektoren); die Hintergrund-Muster der Apps hängen jetzt an
`body::before` (der alte `.uwe-shell::before`-Layer war seit dem Kit-Shell in
den Live-Apps wirkungslos — Muster waren stumm kaputt). Der CSS-Pruner
(`scripts/legacy-css-usage.mjs`) matcht mit `--precise` token-genau und zählt
Tests/Kommentare nicht mehr als Nutzer.

## Endgame-Phase: Aufteilung (2026-07, nach Shell-Phase)

| Paket | Inhalt | Owner | Abhängigkeit |
|-------|--------|-------|--------------|
| **A** | uwe-btn-Endgame: `CopyToClipboardButton` von `components/Button.tsx` entkoppeln, letzte `uwe-btn`-Nutzer (ThemeScopeSettingsPanel, MobileFilterSheet) auf Utilities, Button.tsx löschen | Session (Sonnet-Agent) | — |
| **B** | Cmd+K-Konsolidierung Studio: Doppel-Mount (Kit-cmdk-Palette im Shell **und** Legacy-`StudioCommandPalette` im Layout) → eine cmdk-Palette mit Aktions-Befehlen, Welten-Switcher, Admin-Zeile | Session (Opus-Agent) | — |
| **C** | Maschinenraum auf Ziel-Stack: Tailwind v4 + copy-in Kit, weg von ButtonV2/CardV2 und `uwe.css`-Bundle-Import | **Cursor** (Brief: `design-connector-cursor-brief.md`, Datei entfernt), Branch `cursor/design-connector` | — |
| **D** | Theme-Skins entrümpeln: Parchment-Override-Block in uwe.css (Selektoren auf gelöschte Legacy-Shell-Klassen) verifizieren, tote Regeln raus, lebende auf Token reduzieren; danach ThemePicker/VisualThemePreview token-basiert | Session (selbst) | Vorsicht: Connector lädt uwe.css noch → erst nach Analyse, final nach C |
| **E** | V2-Layer-Abriss: ButtonV2/CardV2, components-v2/, uwe-v2.css, design-v2-Bundle, design-v2.test.ts, Exporte | Session | **nach C gemergt** |

Bewusst außen vor (eigene Projekte, nicht Teil des Endgames): TanStack
Table/Query, React Hook Form + Zod, Sonner, dnd-kit-Ausbau, React Flow
(new-ui-stack.md „Data & interaction“) sowie Wiki-Render-CSS.

## Abschluss (2026-07-11): V2-Layer-Abriss (Paket E)

Nach dem Merge von PR 767 (Maschinenraum auf Ziel-Stack) war die V2-Schicht
nutzerlos und wurde entfernt: `components-v2/` (ButtonV2, CardV2),
`design-v2/{shell,components,layouts,mobile}.css` samt `--uwe-zone-*`-Konsumenten.
Verblieben im design-v2-Bundle: `tokens.css` (Theme-Engine-Kopplung über
elementOverrides), `wiki.css` (lebende `uwe-v2-wiki*`-Render-Klassen),
`parchment-os-shell.css` (Theme-Skin), `wiki-base.css` (direkter App-Import).
Letzte Migrationslücke dabei gefixt: `CharacterSheetEditPanel`
(uwe-v2-btn/-form/uwe-hint → Kit).

**Damit ist die Design-Konsolidierung abgeschlossen.** Alle vier Oberflächen
(Studio, Portal, Connector, Static-Export-Templates) rendern auf dem
Ziel-Stack bzw. dokumentierten Ausnahmen; das Legacy-CSS ist von ursprünglich
~9.150 auf ~2.980 Zeilen reduziert, ausschließlich mit benannten Konsumenten.
Inventar-/Prune-Werkzeuge: `scripts/design-consolidation-inventory.mjs`,
`scripts/legacy-css-usage.mjs --precise`.
