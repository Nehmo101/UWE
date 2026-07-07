# Atlas — Follow-ups

Offene oder geplante Erweiterungen nach dem initialen Atlas-Merge (W0–P7).

> Stand: 2026-07-07 nach dem Parallel-Batch „Review-UI + Rezept-Preview · Wasserfront-UI · Gouache-Batch 3“ (drei Slices in einem PR). Dieser Stand ist auf `main`.
>
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
- **Pending-Asset-Review & Rezept-Preview:** `@uwe/atlas/rtx-asset-preview` (`drawRtxGouacheRecipePreview`) rendert validierte `json-recipe`-Proposals rein datengetrieben (ellipse/rect/polygon/absolute-Pfade, Hex-Re-Check, Skip statt Throw bei unbekannten Befehlen; deterministisch, getestet). Das RTX-Asset-Modal zeigt die Canvas-Preview zusätzlich zur JSON-Ansicht; die Atlas-Index-Seite listet Pending-`rtx_asset`-Items („Ausstehende RTX-Assets“, serverseitig erneut validiert, ungültige Items delete-only) mit Genehmigen/Löschen über die bestehenden Actions.
- **Settlement-Wasserfront-UI-Parameter:** Das Settlement-Ghost-Panel in `atlas.html` bietet einen Hafen/Wasserfront-Toggle (Default aus) plus die drei realen Engine-Optionen (`edgeFraction`, `pierCount` 1–4, `includeDock`); Werte fließen deterministisch in `generateSettlement()` und werden bei Übernahme als `style.settlementWaterfront` persistiert. Toggle aus = byte-identisches Inland-Verhalten.
- **Gouache-Asset-Batch 3:** sieben neue Stamp-Rezepte in `assets.ts` (`g_watermill`, `g_lighthouse`, `g_amphitheater`, `g_burial_mound`, `g_caravanserai` als structure; `g_ziggurat`, `g_portal_arch` als landmark; `g_windmill` existierte bereits) — Styleguide-konform (Schatten/Highlight/Pigmentrand, Base-centre), Engine-Bundle neu gebaut.
- **RTX-Asset-Studio — MVP (Studio-Panel + Pending-Persistenz):** `apps/studio/app/atlas-asset-actions.ts` begrenzt den DM-Prompt (max. 500 Zeichen), führt `atlas_generate_asset_proposal` über `runBrainAction` nur auf lokalen/RTX-Providern (`ollama`, `openai_compatible`) aus und re-validiert das Ergebnis serverseitig mit `validateRtxAtlasAssetProposal`. Das Modal `AtlasAssetProposalStudio` (Workspace-Button „✦ RTX-Asset“) zeigt Prompt-Eingabe, Validierungsstatus, JSON-/Metadaten-Preview (Kategorie/Tags/Palette) und Validator-Fehler samt verworfener Rohausgabe. „Als Pending-Asset speichern“ re-validiert das Proposal erneut serverseitig und legt nur ein `AtlasPaletteItem` mit `source=ai`, `reviewStatus=pending` und dem Proposal-JSON in `styleTags` an — kein Auto-Apply, kein `AtlasObject`, keine Builtin-Promotion; Pending-Items bleiben wie bisher aus Portal und Static Export ausgeschlossen.

## Noch offen aus dem Gouache-Plan

- **RTX-Asset-Studio — Restarbeiten:** Panel, Pending-Persistenz, Review-UI und Rezept-Preview sind umgesetzt. Offen bleiben: genehmigte `rtx_asset`-Items tatsächlich in der Editor-Palette platzierbar machen (heute sind sie nach Genehmigung nur Metadaten ohne Renderpfad) und die spätere Builtin-Promotion als normaler PR-Schritt.
- **Gouache-Asset-Bibliothek ausbauen:** Backlog aus `docs/design/atlas-redesign/asset-catalog.md` schrittweise als Rezepte/Custom-Assets umsetzen.
- **Großstadt-/Schloss-Generator:** Kern-Engine, Ghost-Übernahme, Wasserfront-/Pier-Hook und die UI-Parameter für Hafen/Wasserfront sind umgesetzt; offen bleiben Feintuning der Gebäudeverteilung und Golden-Screenshots.
- **Weiche Terrain-Übergänge:** nur noch visuelles Feintuning/Golden-Screenshots für `AtlasTileLayer.blendWidth`, falls der 6px-Default in echten Karten zu weich oder zu hart wirkt.
- **Static-Viewer-Restparität:** Ranke-Details, `style.smooth`/`style.width` und Legenden-Feinschliff sind nachgezogen; explizite Custom-/AI-Stempel-Goldens fehlen dort weiterhin.
- **Optionaler Editor-Layout-Umbau:** Werkstatt-orientiertes Layout erst nach den Kernfeatures entscheiden.
- **Tests & Gates:** RTX-Asset-Validator-Tests sind vorhanden; offen bleiben Plot-/Settlement-Golden-Tests, Security-Leak-Assertions für exportierbare Asset-Proposals, `pnpm test:security`, `pnpm ci:light`.
- **Atlas-Engine-Bundle:** nach Engine-Änderungen `pnpm --filter @uwe/static-export build:atlas-engine` ausführen und den `atlas-engine.js`-Diff mitcommitten.

## Nächster Agent: empfohlener Einstieg

**Priorität 1: Genehmigte RTX-Assets in der Editor-Palette.** Der RTX-Flow ist bis zur Genehmigung geschlossen (Prompt → validiertes Proposal → Pending-Item → Review-UI mit Rezept-Preview → Genehmigen). Was fehlt, ist der letzte Schritt: Ein genehmigtes `rtx_asset`-Item (json-recipe) muss in der Editor-Palette auftauchen und als `AtlasObject` platzierbar/renderbar sein — analog zu genehmigten `ai_stamp`-Items, aber gezeichnet über den deterministischen Rezept-Renderer `drawRtxGouacheRecipePreview` (`@uwe/atlas/rtx-asset-preview`) statt über `imageData`.

Betroffene Kernstellen:

- `packages/static-export/static/atlas.html` + Engine-Bundle: prüfen, wie genehmigte `ai_stamp`-PaletteItems heute in Palette/Rendering gelangen, und denselben Pfad für `rtx_asset` mit Rezept-Rendering erweitern (`rtx-asset-preview` ggf. ins Engine-Bundle aufnehmen, danach `build:atlas-engine`).
- `apps/portal/src/components/atlas/AtlasViewer.tsx` und Static Viewer: Render-Parität für platzierte, genehmigte RTX-Assets.
- `packages/static-export/src/export-atlas.ts`: Wenn Rezept-Daten exportiert werden müssen, NUR das validierte Rezept (nicht Prompt/Rationale) — **zuerst** `scripts/security-leaks.test.ts` und `static-export.test.ts` erweitern.

Security-Regeln:

- Rendern ausschließlich nach erneuter `validateRtxAtlasAssetProposal`-Prüfung; niemals rohe `styleTags` in Export oder Client-Rendering durchreichen.
- Pending-Items bleiben unsichtbar; nur `reviewStatus=approved` erreicht Palette/Portal/Export.
- Kein eval, keine neuen Payload-Formate — der bestehende Rezept-Renderer ist die einzige Zeichenlogik.

Empfohlene Gates:

- `corepack pnpm --filter @uwe/atlas test`
- `corepack pnpm --filter @uwe/studio typecheck`
- `node --import tsx --test packages/static-export/src/static-export.test.ts`
- `corepack pnpm test:security`
- `node scripts/file-size-budget-check.mjs`
- nach Engine-Änderung: `corepack pnpm --filter @uwe/static-export build:atlas-engine` + Bundle-Diff committen

## Follow-up Prompt für den nächsten Agent

Kopierbarer Einstieg für einen neuen Codex-Agenten:

```text
Arbeite im Repo `Nehmo101/UWE` auf aktuellem `main`. Bitte lies zuerst `docs/engineering/atlas-follow-ups.md` (Abschnitt "Nächster Agent"), `docs/prompts/atlas-pictogram-styleguide.md` und `packages/atlas/src/rtx-asset-preview.ts`.

Ziel: Setze den nächsten kleinen Roadmap-Slice "Genehmigte RTX-Assets in der Editor-Palette" um.

Aktueller Stand:
- RTX-Flow bis Genehmigung komplett: Proposal-Generierung, Pending-AtlasPaletteItem (kind=rtx_asset, styleTags.rtxAssetProposal), Review-UI mit deterministischer Rezept-Preview (drawRtxGouacheRecipePreview aus @uwe/atlas/rtx-asset-preview).
- Genehmigte rtx_asset-Items haben aber noch keinen Palette-/Renderpfad im Editor, Portal oder Static Viewer.
- Genehmigte ai_stamp-Items (imageData in styleTags) sind das Vorbild dafür, wie Custom-Items in Palette und Rendering gelangen.

Implementiere bitte nur einen reviewbaren MVP-Slice:
1. Genehmigte rtx_asset-Items (nur reviewStatus=approved, nur outputType json-recipe) erscheinen in der Editor-Palette und sind als reguläre AtlasObjects platzierbar; gezeichnet wird ausschließlich über drawRtxGouacheRecipePreview nach erneuter Validator-Prüfung.
2. Render-Parität in Portal-Viewer und Static Viewer für platzierte RTX-Assets; export-atlas.ts darf dabei NUR das validierte Rezept exportieren (nie Prompt/Rationale) — erweitere zuerst scripts/security-leaks.test.ts und packages/static-export/src/static-export.test.ts.
3. Nach Engine-Änderungen das Bundle neu bauen (build:atlas-engine) und den atlas-engine.js-Diff mitcommitten.

Empfohlene Checks:
- `corepack pnpm --filter @uwe/atlas test`
- `corepack pnpm --filter @uwe/studio typecheck`
- `node --import tsx --test packages/static-export/src/static-export.test.ts`
- `node scripts/file-size-budget-check.mjs`
- `corepack pnpm docs:check`
- `corepack pnpm test:security`
- `git diff --check`

Bitte Roadmap danach aktualisieren, PR erstellen und erst nach grünen Checks mergen.
```

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
