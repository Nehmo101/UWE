# Atlas — Gouache-Redesign & CoK-Feature-Plan

> Status: **Phase 1 umgesetzt** (Gouache-Asset-Engine, per-Objekt `style` mit
> Liniendicke + Unschärfe, Untergrund-Intensität, Editor- & Portal-Rendering).
> Offen: KI/RTX-`plot`-Proposal-Flow, Settlement-Generator,
> Static-Viewer-Legenden-Feinschliff, größere Asset-Bibliothek, RTX-Asset-Studio in UWE — siehe
> [atlas-follow-ups.md](atlas-follow-ups.md).
> Ursprünglicher Umfang: Umsetzungsplan.
> Kontext: Annäherung des Atlas-Editors an [Canvas of Kings](https://store.steampowered.com/app/2498570/Canvas_of_Kings/) — gemalte Assets, selbstfüllende Flächen, direkte Objektgriffe.
> Verwandt: [atlas-cok-gap-analysis.md](atlas-cok-gap-analysis.md) · [atlas-follow-ups.md](atlas-follow-ups.md)

## Interaktive Mockups (im Repo)

Alle Grafiken sind live in Canvas 2D gerechnet (kein Bild). Im Browser öffnen:

- **[atlas-ui-proposals.html](../design/atlas-redesign/atlas-ui-proposals.html)** — die Redesign-Vorschläge (Malstile, Editor-Layouts, alle Muss-Features als interaktive Demos).
- **[atlas-editor-showcase.html](../design/atlas-redesign/atlas-editor-showcase.html)** — Übersicht des **heutigen** Editor-Funktionsumfangs (inkl. Ranke/Weltenwurzel).
- **[asset-catalog.md](../design/atlas-redesign/asset-catalog.md)** — Gouache-Asset-Backlog (16 Kategorien, Fantasy + Mittelalter).
- **[improvement-ideas.md](../design/atlas-redesign/improvement-ideas.md)** — strategischer Ideen-Vorrat für Atlas-Verbesserungen.

Gehostete Artefakt-Fassungen (default-privat, nur Owner): UI-Vorschläge `claude.ai/code/artifact/f81003cd-79ca-4384-adae-5727f7cd458f`, Editor-Showcase `claude.ai/code/artifact/2872df01-b7cd-4dd1-b26c-4ce58beb1a7a`.

---

## 0 · Kernentscheidung zuerst (Owner)

Drei dokumentierte Leitplanken werden bewusst gelockert — gehört **vor** die erste Zeile Code als Beschluss in [../prompts/atlas-pictogram-styleguide.md](../prompts/atlas-pictogram-styleguide.md) + [atlas-cok-gap-analysis.md §5](atlas-cok-gap-analysis.md):

1. **Stroke-only → Gouache.** Assets bekommen Flächen + Schatten + Highlight + Pigmentrand statt reiner Umrisslinie. **Gewählter Malstil: Gouache** (deckend, matt, kräftig — und ohne Blur am schnellsten zu rendern).
2. **Asset-Herkunft.** Empfehlung: **prozedurale Vektor-Rezepte** (Grundform + Palette + Schattierung, deterministisch, theme-fähig, reines Canvas-2D) statt gemalter PNG-Sprites. Vorteile: kein Urheberrechts-/Produktionsaufwand (keine CoK-Assets kopieren), skaliert scharf, reagiert auf den Untergrund-/Kolorit-Regler. PNG-Upload bleibt für Custom-Assets (Pipeline existiert: `uploadAtlasStampAction`).
3. **Styleguide in UWE.** Der Asset-Styleguide ist nicht nur Doku, sondern die verbindliche Prompt-/Review-Quelle für RTX-gestützte Asset-Erzeugung direkt in UWE. RTX bekommt den Styleguide + Asset-Katalog als Kontext; Ergebnisse landen immer als Proposal und nie als Auto-Apply im Kanon.

---

## 1 · Fundament: Gouache-Asset-System

| Baustein | Wo | Was |
|---|---|---|
| Asset-Typ | neu `packages/atlas/src/assets.ts` | `GouacheAsset = { key, name, category, recipe }`; `recipe` = Schichten (bodyShape, shadow, highlight, edge) + Palette. Gebäude: layered Polygone; Flora: organische Blob-Rezepte. |
| Koexistenz | `packages/atlas/src/glyphs.ts` | `BuiltinGlyph` um `renderKind: "ink" \| "gouache"` erweitern — alte Tusche-Glyphen bleiben gültig, neue Gouache-Assets additiv. |
| Renderer | `packages/atlas/src/canvas-render.ts` | `drawGouacheAsset(ctx, asset, {x,y,scale,rotation,lineWidth,blur})` — reine Canvas-2D-Funktion, deckend, kein Blur nötig (Gouache-Vorteil: schnell). |
| Verdrahtung | **alle drei Render-Pfade** | `packages/static-export/static/atlas.html`, `packages/static-export/static/atlas-viewer.js`, `apps/portal/src/components/atlas/AtlasViewer.tsx` → `drawObject` wählt nach `renderKind` zwischen `drawSvgPath` (alt) und `drawGouacheAsset` (neu). Danach Bundle neu bauen (`pnpm --filter @uwe/static-export build:atlas-engine`). |
| DB | — | **Keine Schema-Änderung** für Builtin-Assets (code-seeded über `ensureBuiltinPaletteItems`). AI/Upload-Gouache reitet in `AtlasPaletteItem.styleTags` (existiert). |

---

> **Asset-Vorrat:** die zu bauende Gouache-Asset-Bibliothek (fliegende Inseln, Schluchten, Weide-/Getreidefelder, Sumpf, Flugschiffe & Schiffe, Pferdekarren, Marktstand-Varianten, Riesenschildkröte mit Schloss, Ruinen, Pyramide, fliegende Zugstrecke u. v. m.) ist in [../design/atlas-redesign/asset-catalog.md](../design/atlas-redesign/asset-catalog.md) katalogisiert — mit Umsetzungs-Tag pro Asset.

## 2 · Feature-Bausteine (akzeptierte Features → reale Ziele)

| Feature | Aufwand | Reale Umsetzung |
|---|---|---|
| **Untergrund-Intensität** | S | `AtlasTileLayer` (`doc.ts`, DB-Feld ist bereits `Json` → migrationsfrei) um optional `intensity: Record<biome, number>` erweitern; `paintTerrainBlobs` (`canvas-render.ts`) passt Sättigung/Deckkraft der Füllfarbe an. UI: Regler pro Biom + globaler „Kolorit". |
| **Liniendicke pro Objekt** | S | ⚠️ `AtlasObject` hat **kein** `style`-Feld → Migration: `style Json?` auf `AtlasObject` (SQLite TEXT no-op + PG). `style.lineWidth` in `drawObject`/`drawGouacheAsset`. Selection-Panel-Input. |
| **Unschärfegrad pro Objekt** | S | Reitet auf dem **gleichen** `AtlasObject.style`-Feld wie die Liniendicke (keine eigene Migration): `style.blur` (0…N px). Renderer setzt `ctx.filter = "blur(px)"` in `drawObject`/`drawGouacheAsset` — nur wenn `> 0`, Default `0`. Nutzen: atmosphärische Tiefe / bewusst „verschwommene" Objekte (Ferne, Nebel, weicher Hintergrund-Bewuchs). Regler neben Liniendicke. ⚠️ Perf: `ctx.filter`-Blur kostet pro Objekt — optional, Default aus. |
| **Skalier-Griff am Rahmen** | S | Reine Editor-UI in `atlas.html` (Auswahlrahmen-Griff unten rechts + Drag → `scale`). Keine Schema-/Engine-Änderung. |
| **Objektbereich füllen (Plot)** | M | Neuer `AtlasFeatureKind` `plot` (Pattern wie `vine`: `constants.ts` + beide Prisma-Enums + PG `ALTER TYPE`). Preset-Modus: `fillPlotWithGouacheAssets` platziert Gouache-Assets als reguläre `AtlasObject`s (Shortcut **F**, Refill/Reroll über Seed im `plot.style`). KI-Modus bleibt offen: neue ai-brain-Action `atlas_fill_area` (Proposal → Ghost → Übernehmen, **nie** Auto-Apply). |
| **RTX-Asset-Studio in UWE** | M–L | In-App-Workflow: DM beschreibt ein Asset, lokale RTX erzeugt anhand von `docs/prompts/atlas-pictogram-styleguide.md` + `asset-catalog.md` einen Gouache-Asset-Vorschlag. Output ist ein validierbares JSON-Rezept oder PNG-Fallback, **kein** frei ausgeführter TS-Code. UWE zeigt Preview + Diff/Metadaten; Übernehmen legt ein Custom-Asset/PaletteItem an, Promotion zu Builtin-Rezepten bleibt ein PR-Schritt. |
| **Großstadt/Schloss-Generator** | M–L | Neues Engine-Modul `packages/atlas/src/settlement.ts` (pur, deterministisch): `generateSettlement(polygon, opts) → { features: [Mauer-Pfad, Straßen], objects: [Türme, Häuser, Kirche, Marktstände, Brunnen, Bergfried, Werft] }`. Wasser-Erkennung: Nachbarschaft zu `river`/`coast`-Features → Werft. Output als **Proposal** (Ghost-Overlay); Übernahme persistiert Features + Objects. Golden-Tests wie `path-attachments`. |
| **Weiche Terrain-Übergänge** | M | `paintTerrainBlobs` besitzt `blendWidth`; `AtlasTileLayer.blendWidth` wird migrationsfrei in Editor, Portal und Static Viewer gerendert. Offen: UI-Regler, Defaults und Feintuning der Wasserfarben-Bleed-Optik. |

---

## 3 · Architektur-Leitplanken (aus [CLAUDE.md](../../CLAUDE.md), nicht verhandelbar)

- Business-Logik in `packages/atlas` bzw. neues Feature-Package — **nicht** in Route Handlers, **nicht** in `packages/database`.
- `server.ts`-Barrel eingefroren → neue Symbole via Subpath-Export (`@uwe/atlas/assets`, `@uwe/atlas/settlement`).
- Neue Dateien < 700 Zeilen (Ziel < 300) — `settlement.ts`/`assets.ts` ggf. splitten.
- Determinismus: alles über `mulberry32`/`hashStringToSeed`; Golden-Regression-Tests pro Generator.
- AI = **Proposal → Review → Übernehmen**, kein Auto-Apply in den Kanon; `personal_brain` bleibt hart lokal (`privacyGuard.ts`).
- RTX-Assets: kein Runtime-`eval`, kein Auto-Commit. Generierte Assets sind validierte Daten/PNG-Artefakte, die im Review-Flow landen; der Styleguide wird explizit als Prompt-Kontext versioniert.
- Jede Payload-Erweiterung (Plot/Settlement/neue Object-Felder): **`scripts/security-leaks.test.ts` zuerst** erweitern, `pnpm test:security` grün.

---

## 4 · Phasenplan (je Phase = eigener Branch, Gate `pnpm ci:light`)

### Phase 1 — Fundament & Quick Wins
Gouache-Asset-Format + `drawGouacheAsset` in allen drei Pfaden · Untergrund-Intensität · Liniendicke **und** Unschärfegrad (gemeinsame `AtlasObject.style`-Migration) · Skalier-Griff.
→ Sofort sichtbarer CoK-Sprung, geringes Risiko.

### Phase 2 — Die CoK-Seele
Plot-Fill (Preset umgesetzt; KI-Proposal offen) · Ausbau der Gouache-Asset-Bibliothek (Bäume/Nadelbäume/Häuser/Kirche/Türme/Marktstände als Rezepte) · RTX-Asset-Studio in UWE (Styleguide-Kontext → Asset-Proposal → Review).
→ Hier entsteht das „das ist CoK"-Gefühl.

### Phase 3 — Generatoren & Feinschliff
Settlement-Generator (`settlement.ts`) · Terrain-Blend-UI/Feinschliff · optional Editor-Layout-Umbau Richtung „Werkstatt".
→ Security-relevant (Payload) ⇒ zusätzlich `pnpm test:security`.

---

## 5 · Migrationen & Tests (konkret)

- **Migrationen:** `AtlasObject.style Json?` (Phase 1, trägt Liniendicke **und** Unschärfe), `AtlasFeatureKind += plot` (Phase 2) — jeweils SQLite-No-op + PG `ALTER TYPE`, `node scripts/migration-check.mjs` als Gate. Untergrund-Intensität & Blend brauchen **keine** Migration (im `tileLayer`-Json).
- **Tests:** `vine.test.ts`-Stil (deepEqual-Determinismus, Clamps, leere Eingaben) für `settlement.ts` + Plot-Scatter; Validator-Tests für RTX-Asset-Rezepte; Security-Leak-Assertions für neue Object-/Feature-/Asset-Felder im Static-Export.
- **Bundle:** nach jeder Engine-Änderung `build:atlas-engine` + eingecheckten `atlas-engine.js`-Diff mitcommitten.

---

## 6 · Offene Owner-Fragen (blockierend für Start)

1. **RTX-MVP-Output:** validiertes JSON-Rezept als Custom-Asset (empfohlen) vs. PNG-Fallback vs. direktes Builtin-Rezept per PR.
2. **Review-Gate:** Owner-only oder Kollaborator-Review für RTX-generierte Assets, bevor sie in Welten/Palette sichtbar werden.
3. **Editor-Layout:** heutiger Aufbau beibehalten oder Umbau auf „Werkstatt" (Richtung A) — betrifft Phase 3.
