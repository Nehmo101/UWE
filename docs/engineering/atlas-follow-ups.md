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

- **KI/RTX-Draft-Bridge-Grundlage:** `@uwe/atlas/draft-proposal` normalisiert prozedurale/RTX-Draft-Features auf erlaubte Atlas-Kinds; Studio-Host und `atlas.html` akzeptieren für Draft-Review nur noch unterstützte Geometrie/Kinds. Angenommene `plot`-Proposals lösen bestehenden deterministischen Plot-Fill aus.
- **KI/RTX-Plot-Fill-Rezept-Grundlage:** `@uwe/atlas/plot-fill-proposal` validiert `atlas_plot_fill`-Rezepte (Gouache-Allowlist, Density/Seed/Style-Grenzen, keine `AtlasObject`-/Code-Payloads); `@uwe/ai-brain` kennt `atlas_fill_area` als Review-only Brain-Action und speichert validierte/ungültige Ausgaben mit `autoApply: false`.
- **KI/RTX-Plot-Fill-Ghost-UI:** `atlas.html` kann für ausgewählte `plot`-Flächen ein validiertes `atlas_plot_fill`-Rezept als transparente Ghost-Objekte anzeigen und erst nach explizitem Übernehmen reguläre `AtlasObject`s schreiben. `AtlasStudioHost` bedient `plot-fill-proposal-request/result/review`; bis zur echten Provider-/Modellauswahl liefert `generateAtlasPlotFillProposalAction` ein serverseitig validiertes, biomabhängiges Default-Rezept.
- **Settlement-Ghost-UI:** `atlas.html` kann für ausgewählte `plot`-Flächen lokal/deterministisch `generateSettlement()` ausführen, Mauern/Straßen/Plaza/Objekte als transparente Ghosts prüfen und erst nach explizitem Übernehmen reguläre Atlas-Features/-Objects schreiben. Bestehende Settlement-Items werden nur für dieselbe Plot-Fläche über `style.settlementSourcePlotKey` ersetzt.
- **KI/RTX-Asset-Proposal-Brain-Action:** `@uwe/ai-brain` kennt `atlas_generate_asset_proposal` als DM-only, Review-only Brain-Action. Der Prompt-Kontext kommt aus `@uwe/atlas/rtx-asset-proposal`, enthält Styleguide-/Katalog-Pflichtauszüge plus existierende Gouache-Assets und validiert Ergebnisse als `atlas_asset_proposal` ohne Auto-Apply.
- **Settlement-Wasserfront-Engine-Hook:** `generateSettlement()` kann optional `waterfront` erzeugen: Wasserfront-Region, Pier-Pfade und optionaler Hafen/Dock-Marker. Der Default bleibt inland/aus, damit bestehende Ghost-Flows unverändert bleiben.

## Noch offen aus dem Gouache-Plan

- **RTX-Asset-Studio in UWE:** Brain-Action, Validator und Styleguide-/Katalog-Kontext sind vorbereitet. Offen bleiben Studio-Panel/Server-Action, Preview/Review-Diff, Pending-`AtlasPaletteItem`-Persistenz und spätere Builtin-Promotion per PR.
- **Gouache-Asset-Bibliothek ausbauen:** Backlog aus `docs/design/atlas-redesign/asset-catalog.md` schrittweise als Rezepte/Custom-Assets umsetzen.
- **Großstadt-/Schloss-Generator:** Kern-Engine, Ghost-Übernahme und optionaler Wasserfront-/Pier-Hook sind umgesetzt; offen bleiben UI-Parameter für Hafen/Werft, Feintuning der Gebäudeverteilung und Golden-Screenshots.
- **Weiche Terrain-Übergänge:** nur noch visuelles Feintuning/Golden-Screenshots für `AtlasTileLayer.blendWidth`, falls der 6px-Default in echten Karten zu weich oder zu hart wirkt.
- **Static-Viewer-Restparität:** Ranke-Details, `style.smooth`/`style.width` und Legenden-Feinschliff sind nachgezogen; explizite Custom-/AI-Stempel-Goldens fehlen dort weiterhin.
- **Optionaler Editor-Layout-Umbau:** Werkstatt-orientiertes Layout erst nach den Kernfeatures entscheiden.
- **Tests & Gates:** RTX-Asset-Validator-Tests sind vorhanden; offen bleiben Plot-/Settlement-Golden-Tests, Security-Leak-Assertions für exportierbare Asset-Proposals, `pnpm test:security`, `pnpm ci:light`.
- **Atlas-Engine-Bundle:** nach Engine-Änderungen `pnpm --filter @uwe/static-export build:atlas-engine` ausführen und den `atlas-engine.js`-Diff mitcommitten.

## Nächster Agent: empfohlener Einstieg

**Priorität 1: RTX-Asset-Studio in UWE.** Plot-Fill und Settlement laufen als Review-only Ghost-Flows; `atlas_generate_asset_proposal` liefert jetzt validierte Asset-Proposals mit Styleguide-/Katalog-Kontext. Der nächste saubere Schnitt ist die Studio-Oberfläche: Ein Panel fragt über den lokalen RTX-Host ein Atlas-Pictogram/Gouache-Asset an, zeigt Validierung/Preview und speichert das Ergebnis erst als Pending-Custom-Asset/PaletteItem.

Betroffene Kernstellen:

- `docs/prompts/atlas-pictogram-styleguide.md` und `docs/design/atlas-redesign/asset-catalog.md` bleiben die verbindlichen Quellen; `packages/atlas/src/rtx-asset-proposal.ts` enthält die serverseitig nutzbaren Pflichtauszüge.
- `packages/atlas/src/rtx-asset-proposal.ts` nur erweitern, wenn Preview-/Persistenzfelder wirklich fehlen; Validator bleibt das finale Gate.
- `packages/ai-brain/src/actions.ts`, `packages/ai-brain/src/tasks.ts` und `packages/ai-brain/src/proposals.ts` kennen `atlas_generate_asset_proposal` bereits.
- `apps/studio/app/atlas-asset-actions.ts` oder ein eng geschnittener Server-Action-Slice für RTX-Aufruf, Re-Validierung und Pending-PaletteItem-Anlage.
- Studio-UI: kleines Panel im Atlas-Kontext für Prompt, Styleguide-Hinweis, Ghost/Preview, Übernehmen/Verwerfen.

Security-Regeln:

- Kein Auto-Apply: Proposal → Ghost → explizite Übernahme.
- AI/RTX darf keine fertigen `AtlasObject`-Payloads und keinen Code liefern; erlaubt sind nur validierte Asset-/PaletteItem-Proposals.
- Styleguide muss serverseitig in den Prompt-Kontext injiziert werden; die UI darf ihn anzeigen/verlinken, aber nicht als freie User-Payload vertrauen.
- Allowlist für Asset-Felder: Name, Kategorie, Gouache-Rezept/Style-Parameter, optional transparente Bildreferenz; keine Dateipfade, Shell-Kommandos oder Remote-URLs ohne Validator.
- Begrenzen: Prompt-Länge, Bild-/SVG-Größe, PaletteItem-Metadaten, Kategorien und Style-Parameter.
- Sichtbarkeit nicht von AI erzwingen lassen; Default/Inheritance serverseitig bestimmen.
- `scripts/security-leaks.test.ts` erweitern, bevor neue Proposal-Payloads exportierbar werden.

Empfohlene Gates:

- `corepack pnpm --filter @uwe/ai-brain test`
- `corepack pnpm --filter @uwe/atlas test`
- `corepack pnpm --filter @uwe/studio typecheck`
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
