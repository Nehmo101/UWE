# Atlas — Follow-ups

Offene oder geplante Erweiterungen nach dem initialen Atlas-Merge (W0–P7).

> Hinweis: Die CoK-Gap-Analyse ([atlas-cok-gap-analysis.md](atlas-cok-gap-analysis.md), Stand 2026-07-01) ist teilweise überholt — Säumen-UI, Stempel-Variation, Undo/Redo, Multi-Select und der Export-Dialog (Ausschnitt + Grid + Deko) sind inzwischen auf `main`.

## Erledigt auf `main`

- **Gebogene Labels** (`curvedLabel`, Shortcut **C**): Pfad zeichnen → **Enter** → Text. Gespeichert als `LabelAnchor.pathCoordinates` (`@uwe/atlas/label-layout`).
- **Gebogene Labels — Pfad umkehren:** Auswahl-Panel „↔ Pfad umkehren“ (`LabelAnchor.pathReversed`).
- **Static Export:** Portal-gefilterte Atlas-Daten als `atlas/data.json` beim Static Export (`writeAtlasStaticBundle` in `@uwe/static-export`).
- **Static HTML Atlas-Viewer:** `atlas/index.html` + `atlas/atlas-viewer.js` — Drill-down, Pan/Zoom, Wiki-Links; Link vom Wiki-Index.
- **Ranke/Weltenwurzel** (`vine`, Shortcut **W**): gigantische Bohnenranke/Wurzel als Pfad-Feature mit statischem Pseudo-3D (getaperter Spiralstamm, Schattenwurf, Ausläufer, Wolken-Aura an der Spitze). Engine `@uwe/atlas/vine` (`buildVineLayout`, deterministisch, getestet) + `drawVine` (`canvas-render.ts`); Panel-Regler Basisbreite/Spitzenbreite/Windung/Ausläufer/Höhe + „↻ Neu würfeln“; Parameter im `style`-JSON; neues `AtlasFeatureKind`-Enum-Mitglied `vine` (SQLite TEXT, Postgres `ALTER TYPE`). Neue Glyphen: `beanstalk`, `giant_root`, `cloud`, `root_knot`.
- **Objekt-Eigenschaften direkt editieren:** Skala/Rotation als Inputs im Auswahl-Panel + „↻ Variieren“ (deterministisches Neu-Würfeln via `stamp-variation.ts`).
- **Scatter-Exclusions überall:** Biom-Glyphen-Streuung hält Straßen-/Fluss-/Ranken-Korridore frei — jetzt auch im Portal-Viewer (`AtlasViewer.tsx`), nicht nur im Editor.
- **Live-Deko im Editor:** Kompassrose + Maßstabsleiste auf der Live-Canvas (vorher nur im PNG-Export).
- **Gouache-Assets** (`@uwe/atlas/assets`): gemalte, gefüllte Canvas-of-Kings-Assets (`drawGouacheAsset`, 20 Starter-Rezepte: Bäume, Bauwerke, Kirche, Bergfried, Ruine, Pyramide, Obelisk, fliegende Insel, Schildkröten-Schloss, Schiff, Flugschiff, Karren, Marktstand …). Ein Objekt rendert gemalt via `style.gouache = <key>`; `paletteItemId` bleibt Builtin-Glyph-FK-Träger. Editor-Palette sowie Rendering in Editor, Portal und Static Viewer sind verdrahtet.
- **Per-Objekt-Renderparameter** (`AtlasObject.style` JSON, neue Spalte): `lineWidth` (Liniendicke) und `blur` (Unschärfe) für **jedes** Objekt — Regler im Auswahl-Panel, gerendert in Editor & Portal.
- **Untergrund-Intensität** (`AtlasTileLayer.intensity`, migrationsfrei im tileLayer-JSON): Sättigung/Tiefe der Biom-Grundfarbe pro Biom (`applyColorIntensity` in `paintTerrainBlobs`); Regler im Editor, gerendert in Editor & Portal.
- **Weiche Terrain-Übergänge** (`AtlasTileLayer.blendWidth`, migrationsfrei im tileLayer-JSON): `paintTerrainBlobs` rendert deterministische Biom-Blends; Editor, Portal und Static Viewer übergeben den Wert zoom-skaliert. Neue Karten starten mit `DEFAULT_TERRAIN_BLEND_WIDTH = 6`, bestehende Daten bekommen denselben Fallback, und der Editor bietet einen globalen Terrain-Blend-Regler.
- **`plot`-Feature-Kind** (Enum + Migration angelegt): Grundlage für „Objektbereich füllen"; Preset-Scatter/Editor-Verdrahtung ist umgesetzt, KI/RTX-Proposal bleibt offen.
- **Objektbereich füllen — Preset-Modus** (`plot`, Shortcut **F**): Polygon zeichnen → Gouache-Objekte werden deterministisch als reguläre `AtlasObject`s gestreut (`fillPlotWithGouacheAssets`); Auswahl-Panel kann refillen/rerollen. KI/RTX-Proposal bleibt Backlog.
- **Static Viewer — Gouache/Intensität-/Legenden-Parität:** Static Export legt `atlas-engine.js` neben `atlas-viewer.js`; der read-only Viewer rendert `style.gouache`, `lineWidth`, `blur` und `AtlasTileLayer.intensity` und zeigt eine node-synchrone Kartenlegende für Untergrund, Kartenzeichen und Objekte.

## Noch offen aus dem Gouache-Plan

- **Objektbereich füllen (Plot):** KI/RTX-Proposal-Flow mit Ghost-Overlay und Review vor Übernahme; Preset-Scatter ist umgesetzt.
- **RTX-Asset-Studio in UWE:** Assets direkt in UWE mit lokaler RTX erstellen; Styleguide + Asset-Katalog als Prompt-Kontext; Ergebnis als validiertes Custom-Asset/PaletteItem-Proposal, Promotion zu Builtins per PR.
- **Gouache-Asset-Bibliothek ausbauen:** Backlog aus `docs/design/atlas-redesign/asset-catalog.md` schrittweise als Rezepte/Custom-Assets umsetzen.
- **Großstadt-/Schloss-Generator:** deterministisches `settlement.ts` mit Mauern, Straßen, Türmen, Häusern, Kirche, Marktständen, Brunnen, Bergfried und Werft.
- **Weiche Terrain-Übergänge:** nur noch visuelles Feintuning/Golden-Screenshots für `AtlasTileLayer.blendWidth`, falls der 6px-Default in echten Karten zu weich oder zu hart wirkt.
- **Static-Viewer-Restparität:** Ranke-Details, `style.smooth`/`style.width` und Legenden-Feinschliff sind nachgezogen; explizite Custom-/AI-Stempel-Goldens fehlen dort weiterhin.
- **Optionaler Editor-Layout-Umbau:** Werkstatt-orientiertes Layout erst nach den Kernfeatures entscheiden.
- **Tests & Gates:** Plot-/Settlement-Golden-Tests, RTX-Asset-Validator-Tests, `scripts/security-leaks.test.ts`, `pnpm test:security`, `pnpm ci:light`.
- **Atlas-Engine-Bundle:** nach Engine-Änderungen `pnpm --filter @uwe/static-export build:atlas-engine` ausführen und den `atlas-engine.js`-Diff mitcommitten.

## Nächster Agent: empfohlener Einstieg

**Priorität 1: KI/RTX-Plot-Fill als Review-Flow.** Der Preset-Scatter ist fertig; der nächste kleine, saubere Schnitt ist `atlas_fill_area` als Rezept-Proposal, nicht als direktes Object-Payload. AI/RTX liefert nur validierte Parameter, UWE erzeugt daraus mit `fillPlotWithGouacheAssets` sichere Ghost-Objects.

Betroffene Kernstellen:

- `packages/ai-brain/src/actions.ts`, `types.ts`, `tasks.ts`, `proposals.ts`, `brain-actions.test.ts`
- `packages/ai-brain/src/router/providers/connectorQueueProvider.ts`
- optional `packages/ai-brain/src/atlas-plot-fill-proposal.ts` als Parser/Guard
- `packages/atlas/src/bridge.ts` + `bridge.test.ts` für `plot-fill-proposal-request/result/review`
- `apps/studio/app/atlas-actions.ts` für Authz, Node-Zugehörigkeit und Rezept → Objects
- `apps/studio/src/components/atlas/AtlasStudioHost.tsx` für Bridge-Handling
- `packages/static-export/static/atlas.html` für KI/RTX-Button, Ghost-Overlay, Übernehmen/Verwerfen

Security-Regeln:

- Kein Auto-Apply: Proposal → Ghost → explizite Übernahme.
- AI/RTX darf keine fertigen `AtlasObject`-Payloads und keinen Code liefern.
- Allowlist für Object-Style: `gouache`, `lineWidth`, `blur`, optional `plotKey`.
- Begrenzen: Polygonpunkte, Exclusions, Density, maximale Objektzahl, Scale/Rotation/LineWidth/Blur.
- Sichtbarkeit nicht von AI erzwingen lassen; Default/Inheritance serverseitig bestimmen.
- `scripts/security-leaks.test.ts` erweitern, bevor neue Proposal-Payloads exportierbar werden.

Empfohlene Gates:

- `corepack pnpm --filter @uwe/ai-brain test`
- `corepack pnpm --filter @uwe/atlas test`
- `corepack pnpm --filter @uwe/static-export build:atlas-engine`
- `corepack pnpm --filter @uwe/static-export typecheck`
- `node --import tsx --test packages/static-export/src/static-export.test.ts`
- `corepack pnpm test:security`

## Bewusst zurückgestellt

### Cursor / Agent-Job als Text-Provider

`agent_job` / `dev_agent_job` bleibt für **Repository-Entwicklung** (GitHub Actions, Cursor Cloud Agents), nicht für In-App-Lore.

`packages/ai-brain/src/providers/agentJobTextProvider.ts` ist inzwischen an die reguläre Job-Queue angebunden: `enqueueAgentJobTextDraft` reiht einen `ai_run`-Job (deferredAiPrompt) ein, der auf die lokale RTX wartet und sein Ergebnis als KI-Resultat zur Review liefert — nie Auto-Apply in den Kanon.

Atlas-Lore nutzt weiterhin primär: `runBrainAction`, prozeduraler Entwurf, RTX/Cloud über AI Gateway.

### Fog of War

Bewusst nicht im MVP (Owner-Entscheidung).

## Weitere Ideen

- Mehrere Atlanten pro Welt
- Gebogene Labels: Letter-Spacing pro Zoom (Feintuning)
- **Ranke als Drill-down-Portal:** `childNodeId` auf einem `vine`-Feature → Klick auf die Bohnenranke führt in einen „Wolkenreich“-Node (Mechanik existiert, reines Nutzungs-/Seed-Pattern)
- **Mythische-Landmarken-Glyph-Set:** schwebende Insel, Portalbogen, Riesenpilz, Kristallturm (additiv in `glyphs.ts`, auto-seeded)
- **Static-Viewer-Parität:** `atlas-viewer.js` nutzt für Ranken jetzt `atlas-engine.js` (`buildVineLayout`/`drawVine`) und respektiert `style.width`/`smooth`; explizite Custom-/AI-Stempel-Goldens fehlen dort weiterhin
- **Höhen-Aura generisch:** Schattenwurf + Wolkenkranz als optionales `style`-Flag auch für Berge/Türme („schwebende Zitadelle“)
- **Preset-Strichbreiten:** `decorations.lineWeightScale` wird von keinem Pfad-Renderer angewendet
- **Region-Namen-AI-Panel:** `atlas_name_regions`-Proposal-Flow existiert ohne UI (Gap-Analyse #9)
- **Persistente Gruppen** (`groupId` auf `AtlasObject`) — Owner-Entscheid ausstehend
- **Atmosphäre light** (statische Vignette/Tönung als Preset-Variante) — Owner-Entscheid ausstehend
- **Site-Level für Interior/Battlemaps** — Owner-Entscheid ausstehend (einzige große Schema-Erweiterung)
