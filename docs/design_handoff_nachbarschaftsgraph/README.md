# Handoff: Nachbarschafts-Graph — Redesign (Beziehungsnetz)

## Overview
Redesign des UWE **Nachbarschafts-Graphen** ("Beziehungsnetz") im Portal.
Der bisherige Graph war ein statisches, starres SVG-Layout (radial/Grid) mit
grellen, nicht-markenkonformen Farben und Standard-Flow-Anmutung (harte Rechteck-
Node, sichtbare Connection-Handles, Punkteraster). Das Redesign ersetzt ihn durch
einen **kräftefreien (force-directed), organischen Canvas-Graphen** im
**Parchment-OS**-Stil — Obsidian-artig: Knoten schweben in einem Netz, ziehen sich
an, reagieren fließend auf Interaktion und kommen danach zur Ruhe.

Zwei Kontexte sind abgedeckt:
1. **Vollbild-Explorer** ("Im großen Graph öffnen") — ganze Welt, Suche, Kategorie-
   Filter, Detail-Panel, Minimap, Zoom/Pan.
2. **Dashboard-Widget** — kompaktes Ego-Netz um einen Fokus-Knoten (z. B. die
   letzte Session), eingebettet in eine Portal-Content-Karte.

## About the Design Files
Die Dateien in diesem Bundle sind **Design-Referenzen, erstellt in HTML/Canvas** —
ein Prototyp, der Aussehen und Verhalten zeigt, **kein** Produktionscode zum 1:1-
Kopieren. Aufgabe ist, dieses Design im echten UWE-Codebase (Next.js 15 / React 19,
`packages/shared-ui`) mit den dort etablierten Mustern **nachzubauen**.

Das Redesign hat eine konkrete Entsprechung im Repo (`Nehmo101/UWE`):

| Prototyp | Reale Datei | Rolle |
|---|---|---|
| `graph-engine.js` (Physik + Canvas-Render) | `packages/shared-ui/src/GraphView.tsx` | **ersetzt** das statische SVG-`GraphView` durch Force-Directed-Canvas |
| Daten-/Kategoriemodell in `graph-data.js` | `packages/database/src/graph-types.ts` | Modell existiert bereits — hier nur Farben aktualisieren |
| DC-Wrapper (State, Fetch) | `apps/portal/src/components/PortalGraphView.tsx` | Fetch-/State-Client-Wrapper bleibt, rendert neues GraphView |
| Vollbild-Seite | `apps/portal/app/auth/worlds/[worldSlug]/graph/page.tsx` | Host-Seite |
| Widget/Karte | Dashboard (`PortalWorldDashboardClient.tsx`) | Ego-Netz-Variante (`compact`) |

Der **Datenvertrag ist unverändert**: `GraphNode` / `GraphEdge` /
`GraphNodeCategory` aus `graph-types.ts` werden 1:1 weiterverwendet. Nur die
**Darstellung** (Layout-Algorithmus, Farben, Rendering) wird getauscht.

## Fidelity
**High-fidelity.** Finale Farben, Typografie, Physik-Parameter, Interaktionen und
Layout sind ausgearbeitet und markenkonform (Parchment OS). Pixelgenau nachbauen,
dabei die UWE-Design-Tokens (`--uwe-*`) statt Hardcodes verwenden. Der Graph selbst
wird auf `<canvas>` gezeichnet (Parchment-Farben sind dort als Literale hinterlegt,
weil Canvas keine CSS-Variablen liest — siehe „Canvas-Farben" unten; idealerweise
zur Laufzeit aus `getComputedStyle(document.documentElement)` lesen, damit der Graph
mit dem aktiven Theme mitzieht).

---

## Screens / Views

### 1. Vollbild-Explorer (`data-screen-label="Vollbild-Graph"`)
- **Purpose:** Ganze Welt als Beziehungsnetz erkunden, filtern, Knoten inspizieren.
- **Layout:** Vollflächiges `<canvas>` (position:absolute, inset:0) füllt den
  Viewport. Darüber schweben Overlay-Elemente (`pointer-events:none` am Container,
  `auto` an interaktiven Kindern):
  - **Titelblock** oben links (24px/22px Abstand): Eyebrow `BEZIEHUNGSNETZ`
    (11px, UPPERCASE, letter-spacing 0.12em, `--uwe-fg-subtle`) → Weltname
    `Die Aschelande` (Newsreader/serif, 30px, line-height 1.1, tracking -0.02em,
    `--uwe-fg`) → Hinweiszeile (12px, `--uwe-fg-muted`): „N Knoten · M Kanten ·
    Ziehen · scrollen zum Zoomen · Knoten antippen".
  - **Ansicht-Umschalter** oben rechts: Button „Widget-Ansicht" (frosted, 38px hoch,
    Icon Layout/Panel + Text).
  - **Such-/Filterleiste** oben rechts unter dem Umschalter: frosted Card (Breite
    340px, blur(12px) saturate(1.05), `--uwe-bg-elevated` @80% + 1px `--uwe-border`,
    Radius 14px, shadow-md, padding 12px). Enthält Suchfeld (38px, Lupen-Icon,
    Placeholder „Knoten suchen…") + eine **Chip-Reihe** (9 Kategorie-Chips,
    umbrechend, gap 7px).
  - **Zoom-Steuerung** unten links: vertikaler, gerundeter (12px) frosted Container,
    4 quadratische 44×44px-Buttons mit Hairline-Trennern: Plus / Minus / Einpassen
    (maximize-corners) / Sperren (lock). „Sperren" aktiv = `--uwe-accent-muted` BG +
    `--uwe-accent` Icon.
  - **Minimap** unten rechts: frosted Card 220×150px, Radius 12px, Label „ÜBERSICHT"
    (10px UPPERCASE), enthält ein zweites `<canvas>` mit Miniatur des Netzes +
    Viewport-Rechteck (Terracotta `#c2622b`, 1.2px).
  - **Detail-Panel** rechts (nur wenn Knoten selektiert): Slide-in-Rail, Breite
    312px (max 88vw), volle Höhe, frosted (`--uwe-bg-elevated` @92%, blur(14px)),
    `border-left:1px --uwe-border`, shadow-lg. Inhalt: Badge-Zeile (Farbpunkt +
    `PageTypeBadge` + `VisibilityBadge`) + Schließen-Button; Titel (Newsreader 24px,
    600); Meta „<Typ> · N Verknüpfungen"; Button `accent` „Seite öffnen →" (full
    width); Abschnitt „VERKNÜPFUNGEN" (10px UPPERCASE) → Liste klickbarer Zeilen
    (Farbpunkt + Richtung/Label 11px subtle + Zieltitel 13px + Kategorie-Kürzel).
- **Chips (Kategorie-Filter + Legende in einem):** pill (border-radius 999px),
  padding 0.32rem 0.7rem 0.32rem 0.55rem, 1px border, Space Mono 12px. Aktiv: BG
  `--uwe-bg-elevated`, border `--uwe-border`, Text `--uwe-fg`, gefüllter Farbpunkt
  (10px). Inaktiv (Kategorie ausgeblendet): transparent, border `--uwe-border-muted`,
  Text `--uwe-fg-subtle`, opacity 0.6, Farbpunkt nur als 1px-Ring.

### 2. Dashboard-Widget (`data-screen-label="Dashboard-Widget"`)
- **Purpose:** Kompakter Einstieg im Welt-Dashboard; Fokus auf letzte Session.
- **Layout:** Portal-Frame:
  - **Topbar** 54px, BG `--uwe-panel`, **2px solid `--uwe-fg` unten** (Parchment-OS-
    Signatur). Brand: boxed ◆ (26px, 2px ink border, Radius 6px) + „UWE Portal" (700,
    15px) · Trenner · Weltname · rechts Status-Dot (`--uwe-player-visible`) +
    „Spieler-Ansicht".
  - **Content** (max-width 960px, zentriert): Breadcrumb „Meine Welten › Die
    Aschelande › Beziehungsnetz" (12px subtle).
  - **Graph-Karte:** `--uwe-card-bg`, **1.5px `--uwe-border`**, Radius 14px,
    shadow-sm. Header: Titel „Nachbarschafts-Graph" (Newsreader 700, 24px) +
    Textlink „Im großen Graph öffnen →" (Space Mono 14px, `--uwe-wiki-link`,
    underline offset 3px, arrow-right Icon). Graph-Fläche: 400px hoch, 1px
    `--uwe-border-muted`, Radius 12px, enthält Canvas + kompakte Legende oben links
    (Farbpunkt + Label, 11px muted) + Mini-Zoom unten links (34px-Buttons). Fußnote
    (12px muted): „Zeigt **2025-01-14 · Session FTKJ** und direkt verknüpfte Seiten
    — nur für Spieler freigegebene Inhalte."
  - Ego-Netz = Fokus-Knoten + Nachbarn (Tiefe 1), `compact`-Modus (kleinere Radien,
    engere Ruhelänge).

---

## Interactions & Behavior
- **Force-Directed-Layout (Physik):** jeder Frame: Abstoßung (Coulomb, alle Paare),
  Feder entlang Kanten (Hooke), sanfte Zentrierung, Dämpfung. System klingt aus und
  **ruht** (Motion = ruhig; Bewegung nur bei Interaktion). rAF-Loop schläft ein, wenn
  kinetische Energie < Schwelle **und** keine Hover-/Fokus-Transition läuft **und**
  nicht gezogen wird; jede Interaktion (`wake()`) weckt ihn.
- **Entrance:** Knoten starten dicht am Ursprung und „fließen" beim Laden auseinander.
- **Hover (Obsidian-Fokus):** Knoten + direkte Nachbarn + verbindende Kanten werden
  hervorgehoben, **alle anderen auf ~12% gedimmt** (weich interpoliert, `hl`-Lerp
  Faktor 0.16/Frame). Cursor: pointer über Knoten, sonst grab/grabbing.
- **Knoten ziehen:** Pointer-Down auf Knoten fixiert ihn, Nachbarn reagieren elastisch;
  Loslassen gibt ihn frei (außer „gesperrt"), Netz beruhigt sich.
- **Pan:** Ziehen im leeren Bereich. **Zoom:** Mausrad zum Cursor (Faktor 1.12/0.89,
  clamp 0.35–3.2); Buttons zoomen zur Mitte (×1.2 / ×0.83).
- **Klick auf Knoten:** selektiert → Detail-Panel (nur Vollbild). Klick auf Leerraum:
  Auswahl aufheben. **Bewegung < 5px = Klick**, sonst Drag/Pan.
- **Klick auf Verknüpfung im Panel:** selektiert den Zielknoten.
- **Suche:** tippen hebt Titel-Treffer hervor, dimmt Rest (nutzt denselben Fokus-Mechanismus).
- **Filter-Chip:** blendet Kategorie aus (stark gedimmt + nicht mehr klick-/hover-bar);
  Layout bleibt stabil (Knoten werden gedimmt, nicht entfernt).
- **Einpassen (fit):** berechnet Bounds und zentriert/zoomt (padding 80px / 46px compact).
- **Sperren (lock):** friert das Layout ein (alle Knoten fixed), togglebar.
- **Übergänge:** 0.12–0.15s ease auf Chrome (Farbe/Border/BG). Press-Nudge
  `translateY(1px)`. Kein Bounce, keine Endlos-Deko-Animation.

## Knotengröße nach Grad (zentrale Design-Regel)
Der Radius eines Knotens skaliert mit der **Anzahl anliegender Kanten (Grad)** —
wenige Verbindungen → klein, viele → deutlich größer (Hubs stechen hervor):
```
r = clamp(5 + deg^0.72 * 4.6, 6.5, compact ? 20 : 32)   // px im Weltraum, dann * Zoom
```
Damit dicke Knoten nicht überlappen ist die Physik **radius-bewusst**:
- Feder-Ruhelänge = `L + r_source + r_target` (L = 96, compact 78)
- Abstoßung skaliert mit `0.55 + (r_a + r_b)/42`

## State Management
Client-State (im Prototyp im DC-Logic-Class, im Repo in `PortalGraphView`/GraphView):
- `view`: `'full' | 'widget'` (Prototyp-Umschalter; im Repo zwei getrennte Mounts)
- `selected`: aktuell selektierter `GraphNode | null` → Detail-Panel
- `hidden`: Map `category → bool` (ausgeblendete Kategorien)
- `query`: Suchstring
- `locked`: Layout eingefroren
Engine-intern (mutabel, **nicht** in React-State, um 60 fps ohne Re-Render zu halten):
Knoten-`x/y/vx/vy/fixed/hl/r/deg`, `tx/ty/zoom`, `hoverId`, `awake`.
- **Datenbezug:** `GET /api/worlds/[worldSlug]/graph` → `{ nodes, edges }` (bereits
  vorhanden, `buildWorldGraph(...,"portal")`, sichtbarkeitsgefiltert). Kein neues API nötig.
- **Wichtig fürs Rendering-Muster:** Canvas-Knoten an ein React-`ref` binden, das
  React neu erzeugen kann. Der Prototyp nutzt einen **stabilen Callback-Ref**, der die
  Engine (neu) initialisiert, sobald ein Canvas-Node mountet, und **Knotenpositionen
  cached**, damit ein Remount/Ansichtswechsel das Layout nicht zurücksetzt. In React
  entspricht das `useCallback`-Ref + `useRef` für den Positions-Cache (nicht `useState`
  für die Simulation!).

## Design Tokens (Parchment OS — exakt aus `tokens/colors.css` / `spacing.css`)
**Flächen/Text/Linien:** bg `#f1e8d4` · bg-elevated `#fbf6ea` · panel `#ece1c9` ·
card-bg `#fbf6ea` · border `#e0d4ba` · border-muted `rgba(224,212,186,0.7)` ·
fg `#211d17` · fg-muted `#574e40` · fg-subtle `#665d4f`.
**Akzent/Links:** accent (terracotta) `#c2622b` · accent-hover `#d47030` ·
accent-muted `rgba(194,98,43,0.12)` · link `#1a5c4f` · wiki-link `#2f6f63` ·
wiki-link-hover `#3a8878`.
**Semantik (markenkritisch):** dm-only / Nur GM = terracotta `#c2622b` ·
player-visible / Portal sichtbar = teal `#2f6f63`.
**Radien:** sm 6 · md 8 · lg 12 · btn(v2) 9 · card(v2) 14 (px).
**Shadows:** sm `0 1px 2px rgba(0,0,0,.22)` · md `0 4px 14px rgba(0,0,0,.28)` ·
lg `0 16px 40px rgba(0,0,0,.38)`.
**Spacing:** 4/8-Skala (xs 4 → 2xl 32). **Motion:** fast 0.12s / 0.15s ease.
**Touch:** min 44px. **Type:** UI = Space Mono (mono), Headings/Reader = Newsreader
(serif); Skala 10.9 → 52px, Body ~14.4px, Eyebrow 0.12em UPPERCASE, Heading tracking
-0.02em.

### Canvas-Farben (Kategorien) — im Canvas als Literale, erdig/gedämpft auf Pergament
| category | Label | Hex |
|---|---|---|
| npc | NPC | `#c76b52` |
| location | Ort | `#2f7d6e` |
| faction | Fraktion | `#b08322` |
| session | Session | `#4f6d94` |
| dungeon | Dungeon | `#7a5480` |
| item | Item | `#c78a3e` |
| lore | Lore | `#6f7d5c` |
| quest | Quest | `#b8462c` |
| handout | Handout | `#4d8a9e` |
Weitere Canvas-Literale: Grund `#f1e8d4`, Knoten-Trennring `#f1e8d4`,
Tinten-Kontur `#211d17` (Auswahl voll, sonst @0.35 alpha), Label-Halo
`rgba(241,232,212,0.82)`, Label-Text `#3d3832` (Auswahl `#211d17`),
Sichtbarkeits-Dot (dm_only/private) terracotta `#c2622b`, radialer Akzent-Wash
`rgba(194,98,43,0.05)` → `rgba(33,29,23,0.05)`, Punkteraster `rgba(33,29,23,0.08)`.
**Empfehlung:** diese Werte zur Laufzeit aus den `--uwe-*`-Tokens lesen
(`getComputedStyle`), damit der Graph über alle 10 Themes hinweg korrekt umskint.

**Physik-Parameter:** REP 2900 · SPRING 0.018 · GRAV 0.0065 · DAMP 0.86 ·
REST-Schwelle 0.045 · L 96 (compact 78) · hl-Lerp 0.16 · Kantenbiegung 0.12.

## Assets
Keine Bild-Assets. Icons sind **inline-SVG** (16px viewBox, currentColor, ~1.6–1.7px
stroke) im Lucide-Stil: `plus, minus, maximize (fit), lock, search, x, arrow-right,
layout/panel`. Im Repo stattdessen **`lucide-react`** verwenden (bestehendes Icon-
System, `icon.tsx`). Brand-Mark = Unicode ◆. **Keine Emoji.** Kategorie-Punkte =
farbige Dots (Status-Muster des Produkts).

## Files
- `Nachbarschafts-Graph.dc.html` — Prototyp (Template-Chrome + Logic-Class: State,
  Refs, Wiring). Design Component; im Browser direkt lauffähig.
- `graph-engine.js` — **Kern:** `GraphEngine`-Klasse (Physik, Canvas-Render, Hover-
  Fokus, Zoom/Pan, Drag, Minimap, Kategorie-Filter). Framework-agnostisch — direkt als
  Vorlage für das neue `GraphView` verwendbar.
- `graph-data.js` — Beispiel-Weltdaten (Kampagne „Die Aschelande") + `CATEGORIES`
  (Label/Farbe). **Nur Beispiel** — im Repo kommen Knoten/Kanten aus der Graph-API;
  die `CATEGORIES`-Farbtabelle ist der übernehmenswerte Teil.

### Umsetzungshinweis
Der performante Kern ist `graph-engine.js`. Empfohlener Weg: die Engine als
imperative, framework-agnostische Klasse belassen und in `GraphView.tsx` über
`useEffect` + Callback-Ref instanziieren (Simulation außerhalb des React-Render-Zyklus,
`ref`-Positions-Cache), Chrome/Panel/Chips als reguläre React-Komponenten mit den
`--uwe-*`-Tokens. Datenvertrag = `GraphNode`/`GraphEdge` aus `graph-types.ts` (unverändert).
