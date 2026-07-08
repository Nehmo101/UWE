# Atlas — Follow-ups

Offene oder geplante Erweiterungen nach dem initialen Atlas-Merge (W0–P7).

> Stand: 2026-07-07 nach Parallel-Batch 2 „RTX-Assets renderbar · Settlement-Tuning + Goldens · Gouache-Batch 4“. Dieser Stand ist auf `main`.
>
> **Beschlossene nächste Welle:** [atlas-editor-roadmap.md](atlas-editor-roadmap.md) — 13 Editor-Design-/Tool-Punkte (Vertex-Editing, Küstensaum, Themes, Spray-Pinsel, Asset-Browser, Ebenen-Panel, Werkstatt-Layout …) + Reiseplaner, vom Owner bestätigt.
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
- **Genehmigte RTX-Assets renderbar (Editor/Portal/Export):** Genehmigte `rtx_asset`-Items (nur `json-recipe`, immer erneut durch `validateRtxAtlasAssetProposal`) erscheinen im eingebetteten Editor als Palette-Buttons mit Mini-Preview und werden als reguläre `AtlasObject`s platziert/gerendert (neues read-only Doc-Feld `rtxPaletteItems`, fährt nie über den Save-Pfad zurück). Portal-Viewer und Static Viewer rendern über denselben Rezept-Renderer; der Static Export nimmt für genehmigte Items exakt `{source, builtinGlyphKey, recipe}` auf — Prompt/Rationale/Metadaten nie (Security-Leak- und Static-Export-Assertions inkl. expliziter Custom-/AI-Stempel-Checks ergänzt, `test:security` 214 Tests). Nebenbei geschlossen: Portal-Palette-Query filtert jetzt `reviewStatus=approved`.
- **Settlement-Feintuning + Golden-Tests:** Gebäudeplatzierung nach `settlement-layout.ts` extrahiert und getunt — Mauer-Clearance (wandklebende Häuser 9,4 % → 0), Waterfront-Keep-out und Dock-Anker-Kollisionen → 0, Blue-Noise-Verteilung (NN-Distanz-CV 0,455 → 0,247) — deterministisch, Options-Signatur unverändert. Golden-Regressionstests (Digest: Feature-/Objekt-Zählungen + Koordinaten-Checksumme) für 3 Settlement- (inkl. Waterfront) und 2 Plot-Fill-Kombinationen plus Overlap-Regressionstest.
- **Gouache-Asset-Batch 4:** acht neue Stamp-Rezepte (`g_wizard_tower`, `g_dragon_perch` landmark; `g_giant_mushroom` flora; `g_waterfall` landmark; `g_hot_spring`, `g_shrine` prop; `g_shipwreck` vehicle; `g_smithy` structure — statt Signalfeuer, das als `g_signal_tower` existiert). Painting-Toolkit nach `assets-toolkit.ts` extrahiert, Batch in `assets-batch4.ts` (Budget-konform); Registry jetzt 40 Assets.
- **Pending-Asset-Review & Rezept-Preview:** `@uwe/atlas/rtx-asset-preview` (`drawRtxGouacheRecipePreview`) rendert validierte `json-recipe`-Proposals rein datengetrieben (ellipse/rect/polygon/absolute-Pfade, Hex-Re-Check, Skip statt Throw bei unbekannten Befehlen; deterministisch, getestet). Das RTX-Asset-Modal zeigt die Canvas-Preview zusätzlich zur JSON-Ansicht; die Atlas-Index-Seite listet Pending-`rtx_asset`-Items („Ausstehende RTX-Assets“, serverseitig erneut validiert, ungültige Items delete-only) mit Genehmigen/Löschen über die bestehenden Actions.
- **Settlement-Wasserfront-UI-Parameter:** Das Settlement-Ghost-Panel in `atlas.html` bietet einen Hafen/Wasserfront-Toggle (Default aus) plus die drei realen Engine-Optionen (`edgeFraction`, `pierCount` 1–4, `includeDock`); Werte fließen deterministisch in `generateSettlement()` und werden bei Übernahme als `style.settlementWaterfront` persistiert. Toggle aus = byte-identisches Inland-Verhalten.
- **Gouache-Asset-Batch 3:** sieben neue Stamp-Rezepte in `assets.ts` (`g_watermill`, `g_lighthouse`, `g_amphitheater`, `g_burial_mound`, `g_caravanserai` als structure; `g_ziggurat`, `g_portal_arch` als landmark; `g_windmill` existierte bereits) — Styleguide-konform (Schatten/Highlight/Pigmentrand, Base-centre), Engine-Bundle neu gebaut.
- **RTX-Asset-Studio — MVP (Studio-Panel + Pending-Persistenz):** `apps/studio/app/atlas-asset-actions.ts` begrenzt den DM-Prompt (max. 500 Zeichen), führt `atlas_generate_asset_proposal` über `runBrainAction` nur auf lokalen/RTX-Providern (`ollama`, `openai_compatible`) aus und re-validiert das Ergebnis serverseitig mit `validateRtxAtlasAssetProposal`. Das Modal `AtlasAssetProposalStudio` (Workspace-Button „✦ RTX-Asset“) zeigt Prompt-Eingabe, Validierungsstatus, JSON-/Metadaten-Preview (Kategorie/Tags/Palette) und Validator-Fehler samt verworfener Rohausgabe. „Als Pending-Asset speichern“ re-validiert das Proposal erneut serverseitig und legt nur ein `AtlasPaletteItem` mit `source=ai`, `reviewStatus=pending` und dem Proposal-JSON in `styleTags` an — kein Auto-Apply, kein `AtlasObject`, keine Builtin-Promotion; Pending-Items bleiben wie bisher aus Portal und Static Export ausgeschlossen.

- **Ink → Gouache komplett (Owner-Entscheid):** Der Gouache-Look ist kanonisch. Batch 5 (`assets-batch5.ts`, 20 Rezepte) liefert gemalte Äquivalente für **alle** Builtin-Ink-Glyphen; `GLYPH_TO_GOUACHE`/`gouacheKeyForGlyph` mappen Ink-Keys auf Gouache. Editor-Palette zeigt nur noch Gouache/RTX (Ink-Grid entfernt); Objekte mit Ink-`paletteItemId`, Biome-Scatter, Ranken-Wolken und die Legenden (Editor-View **und** Static Viewer, inkl. RTX-Zeilen) rendern gemalt. Ink bleibt DB-seitig stabiler FK-Träger; Ink-Rendering nur noch als Fallback für unbekannte Keys. KI-Bild-Stempel erzeugen jetzt Gouache (`ATLAS_STAMP_STYLE_PROMPT` umgestellt, Styleguide §Gouache ist verbindliche Prompt-Quelle).
- **Ranke im Gouache-Look:** `drawVine` hat einen `fill`-Modus (gefüllter, getaperter Ribbon-Stamm mit Pigmentkante, Highlight, Blatt-Blobs an den Ausläufern); Editor, Portal und Static Viewer nutzen ihn mit satter Grün-Palette; Aura-Wolken sind Gouache (`g_cloud`).
- **Skalier-Griff am Auswahlrahmen:** Einzelselektion zeigt einen roten Griff unten rechts; Ziehen skaliert live (0.2–3, Undo-fähig), funktioniert für Gouache-, RTX- und Fallback-Objekte. Headless-funktional getestet (Playwright: Plot-Fill-Flow + Griff-Drag).
- **Editor-Testhook:** `window.__atlasDebug` (doc/state/scaleHandlePt/drawingPoints, selectOnly, draw) für Headless-Smoke-Tests — Grundlage für die geplanten Golden-Screenshots.

## Noch offen aus dem Gouache-Plan

- **RTX-Asset-Studio — Rest:** Der Flow ist end-to-end geschlossen (Prompt → Proposal → Pending → Review → Genehmigen → Palette/Rendering/Export). Offen bleiben nur: Builtin-Promotion als normaler PR-Schritt (Prozess, kein Feature), `png-fallback`-Proposals bewusst ohne Renderpfad, und die namentliche Auflistung von RTX-Assets in der Editor-Legende (kosmetisch).
- **Gouache-Asset-Bibliothek ausbauen:** fortlaufend — Backlog aus `docs/design/atlas-redesign/asset-catalog.md` (nach Batch 4: 40 Assets in der Registry); weitere Batches nach Bedarf.
- **Golden-Screenshots (visuell):** Struktur-Goldens für Settlement/Plot-Fill existieren jetzt als Digest-Tests; echte Render-Screenshots (Editor/Static Viewer, inkl. Custom-/AI-Stempel und RTX-Assets) fehlen weiterhin — braucht eine Screenshot-Infra-Entscheidung (Playwright ist im Repo-Umfeld verfügbar).
- **Weiche Terrain-Übergänge:** nur noch visuelles Feintuning für `AtlasTileLayer.blendWidth`, **falls** der 6px-Default in echten Karten zu weich oder zu hart wirkt — braucht Owner-Feedback aus realer Nutzung.
- **Optionaler Editor-Layout-Umbau:** Werkstatt-orientiertes Layout — Owner-Entscheid.
- **Atlas-Engine-Bundle:** nach Engine-Änderungen `pnpm --filter @uwe/static-export build:atlas-engine` ausführen und den `atlas-engine.js`-Diff mitcommitten.

## Nächster Agent: empfohlener Einstieg

**Priorität 1: Visuelle Golden-Screenshots für Editor/Static Viewer.** Alle funktionalen Gouache-/RTX-Slices sind auf `main`; als letztes substanzielles Engineering-Thema fehlt eine Screenshot-Regressionsstrecke: deterministische Beispielkarte (fester Seed) im Static Viewer per Playwright/Chromium rendern, PNG-Goldens für Kernszenen (Terrain-Blend, Gouache-Stamps inkl. Batch 3/4, Settlement mit Waterfront, platzierte RTX-Assets, Custom-/AI-Stempel) einchecken und einen toleranten Pixel-Diff-Test als optionales Gate anbieten. Vorher klären/entscheiden: Speicherort der Goldens, Toleranzschwelle, ob der Test Teil von `pnpm test` oder ein separates Script wird (CI-Kosten).

Security-Regeln:

- Testdaten nur aus deterministischen Fixtures; keine echten Weltdaten in eingecheckte Goldens.
- Der Static-Export-Testpfad bleibt die Quelle — keine neuen Export-Felder ohne vorherige `security-leaks.test.ts`-Erweiterung.

Empfohlene Gates:

- `corepack pnpm --filter @uwe/atlas test`
- `node --import tsx --test packages/static-export/src/static-export.test.ts`
- `corepack pnpm test:security`
- `node scripts/file-size-budget-check.mjs`
- neues Screenshot-Script dokumentieren (`docs/engineering/ci.md`), falls es nicht ins Standard-Gate kommt

Danach verbleiben nur Owner-Entscheidungen (Terrain-Blend-Feintuning nach realem Karteneindruck, Editor-Layout-Umbau, Fog of War) und fortlaufende Asset-Batches.

## Follow-up Prompt für den nächsten Agent

Kopierbarer Einstieg für einen neuen Codex-Agenten:

```text
Arbeite im Repo `Nehmo101/UWE` auf aktuellem `main`. Bitte lies zuerst `docs/engineering/atlas-follow-ups.md` (Abschnitt "Nächster Agent") und `packages/static-export/src/static-export.test.ts`.

Ziel: Setze den Roadmap-Slice "Visuelle Golden-Screenshots für den Static Viewer" um.

Aktueller Stand:
- Struktur-Goldens (Digest-Tests) für Settlement und Plot-Fill existieren in packages/atlas.
- Der Static Export erzeugt atlas/index.html + atlas-viewer.js + atlas-engine.js + data.json; Chromium/Playwright ist in der Dev-Umgebung verfügbar (PLAYWRIGHT_BROWSERS_PATH beachten).
- Gouache-Assets (40 Rezepte), Settlement inkl. Waterfront und genehmigte RTX-Assets (json-recipe) rendern deterministisch.

Implementiere bitte nur einen reviewbaren MVP-Slice:
1. Ein deterministisches Fixture-Bundle (fester Seed, keine echten Weltdaten) über den bestehenden Static-Export-Testpfad erzeugen.
2. Ein Playwright-Script, das den Static Viewer headless rendert und 3-5 Kernszenen als PNG-Goldens aufnimmt (Terrain-Blend, Gouache-Stamps, Settlement mit Waterfront, RTX-Asset, AI-Stempel).
3. Ein Vergleichs-Script mit toleranter Pixel-Diff-Schwelle; als separates pnpm-Script anlegen und in docs/engineering/ci.md dokumentieren (nicht ungefragt ins Standard-Gate hängen).

Empfohlene Checks:
- `corepack pnpm --filter @uwe/atlas test`
- `node --import tsx --test packages/static-export/src/static-export.test.ts`
- `corepack pnpm test:security`
- `node scripts/file-size-budget-check.mjs`
- `corepack pnpm docs:check`
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
