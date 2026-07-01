# UWE Atlas — Gap-Analyse & Verbesserungsvorschläge (Benchmark: Canvas of Kings)

> Stand: 2026-07-01 · Analyse-Branch: `claude/atlas-gap-analysis-eqyrbg` · **Keine Implementierung**, nur Bestandsaufnahme + priorisierte Vorschläge.
> Referenzen: [docs/handoffs/atlas-singlefile/README.md](../handoffs/atlas-singlefile/README.md), [docs/engineering/atlas-follow-ups.md](atlas-follow-ups.md), [docs/prompts/atlas-orchestrator.md](../prompts/atlas-orchestrator.md), [docs/prompts/atlas-style-reference.md](../prompts/atlas-style-reference.md), [docs/prompts/atlas-pictogram-styleguide.md](../prompts/atlas-pictogram-styleguide.md)

---

## 1. Executive Summary

**Kernbefund:** Die CoK-inspirierte *Engine-Schicht* ist weitgehend fertig, deterministisch und getestet (`packages/atlas/src/`: `path-attachments.ts`, `stamp-variation.ts`, `export-grid.ts`, `path-smoothing.ts`, `terrain.ts`, `canvas-render.ts` — null Runtime-Dependencies, Golden-Regression-Tests). Die *Workflow-Schicht* fehlt: `generatePathAttachments`, `randomStampVariation`, `buildGridLines` und `sampleTaperedWidths` werden zwar in `packages/static-export/static/atlas-engine.js` gebündelt und exportiert, aber **von keiner UI aufgerufen** (weder `atlas.html` noch `apps/*`). Der Hebel liegt also nicht in neuer Engine-Arbeit, sondern im Verdrahten vorhandener, getesteter Fähigkeiten — plus einer Paritätslücke: Der Terrain-`tileLayer` erreicht Portal und Static Export nicht (`export-atlas.ts` serialisiert ihn nicht, `AtlasViewer.tsx` und `atlas-viewer.js` rendern ihn nicht).

**Score vs. CoK (1–10):**

| Achse | Score | Begründung |
|---|---|---|
| Location-/Battlemap-Erstellung | **4/10** | Werkzeuge (Pfade, Biome, Terrain-Pinsel, Stempel, Messen) vorhanden; keine Auto-Objektplatzierung im UI, keine Gruppierung, kein Undo, keine Interior-Ebene |
| World-Scale-Kartografie | **8/10** | 4-Ebenen-Hierarchie, Drill-down, Eltern-Silhouette, Wiki-Links — über CoK-Niveau |
| Spieler-Erlebnis (Portal) | **5/10** | Server-gefiltert, Drill-down, Relief-Shading; aber ohne tileLayer wirken Karten „nackt", Static-Viewer ohne AI-/Upload-Stempel, keine Legende |
| Export/Print/VTT | **3/10** | Nur Ganz-Canvas-PNG/JSON; Grid-Engine (`export-grid.ts`) ungenutzt; kein Ausschnitt; Handout ist Stub |

---

## 2. Feature-Matrix

Legende Gap-Typ: **UX** = UX-Gap (Engine da, UI fehlt) · **ARCH** = Architektur-Schuld · **DEF** = bewusst deferred · **USP** = UWE-Vorsprung

| Feature | CoK | UWE Atlas (Ist) | Gap | Typ | UWE-relevanter Vorschlag |
|---|---|---|---|---|---|
| Pfad-basierte Auto-Objektplatzierung | Ja (Kern-Feature) | Engine fertig: `packages/atlas/src/path-attachments.ts` (trees/houses/towers, side both/left/right, spacing, jitter, seed, deterministisch) + Tests. **Kein UI-Werkzeug** in `packages/static-export/static/atlas.html`; `scripts/atlas-cok-demo-seed.ts` enthält keine Attachments | **H** | UX | Auswahl-Panel-Aktion für `river`/`road`-Features: „Objekte säumen" → `generatePathAttachments` → als `AtlasObject`s über bestehende Save-Bridge persistieren (Top-10 #3) |
| Plot/Flächen-Auto-Fill mit Kollisionsvermeidung | Ja (Wald-Plot respektiert Straßen) | Biom-Polygon-Streuung vorhanden (`terrain.ts` → `scatterGlyphsInPolygon`, Rejection-Sampling inkl. Polygon-Holes; in allen drei Viewern gerendert). **Keine** Vermeidung von Pfaden/Objekten | **M** | UX | `scatterGlyphsInPolygon` um Exclusion-Korridore (Pfad + Breite) erweitern; Tests in `packages/atlas/src/terrain.test.ts` / `biome-scatter.test.ts` (Top-10 #7) |
| Objekt-Zufallsvariation | Ja (Scale/Rotation/Varianten) | Engine fertig: `stamp-variation.ts` (`randomStampVariation` Scale 0.7–1.3, Rotation ±15°, `stampSeedFromKey` FNV-1a) + Tests. Editor platziert Stempel **ohne** Variation; nur manuelle Skalierung/Rotation im Auswahl-Panel | **M** | UX | Toggle „Zufallsvariation" beim Stempeln in `atlas.html`, Seed aus Objekt-Key (Top-10 #4, Quick Win) |
| Objekt-Gruppierung / Multi-Select | Ja (kombinieren, gemeinsam bewegen) | **Nein** — nur Einzelselektion (`selectedKey` in `atlas.html`), in keinem der drei Pfade | **H** | UX | Multi-Select (Shift-Klick + Rubber-Band) + Batch-Move/-Delete/-Visibility; Persistenz zunächst ohne Schema-Änderung (Top-10 #5, Owner-Frage 5 zu `groupId`) |
| Terrain-Pinsel / Tile-Layer | Ja (fließende Blob-Kanten) | **Editor: ja** — `atlas.html` Terrain-Tool + `canvas-render.ts` `paintTerrainBlobs` (CoK-Blob-Kanten mit Nachbar-Bridging); Schema v2 `tileLayer` (64×40, `doc.ts`); Persistenz via `saveAtlasTileLayerAction` (`apps/studio/app/atlas-actions.ts`) | **L** (Editor) / **H** (Portal+Static) | ARCH | Parität herstellen: `tileLayer` in `AtlasStaticExportPayload` (`packages/static-export/src/export-atlas.ts`), Rendering in `apps/portal/src/components/atlas/AtlasViewer.tsx` + `atlas-viewer.js` (Top-10 #1) |
| Licht/Wetter/Atmosphäre | Ja (Licht, Schatten, Schnee, Nebel) | **Nein.** Nur biome-bewusstes Relief-Shading (`buildReliefShading`), und das **nur im Portal-Viewer**, nicht im Editor/Static | **M** | UX + Stil-Frage | „Atmosphäre light" (statische Vignette/Tages-Tönung) als optionale Preset-Erweiterung in `style-presets.ts` — nur nach Owner-Entscheid (Frage 1); keine animierten Effekte |
| Export-Ausschnitt + Grid | Ja (definierbarer Ausschnitt, Square/Hex) | Engine fertig: `export-grid.ts` (`buildGridLines`, square + pointy-top hex, geclampt) + Tests. **Nirgends genutzt**; `exportPNG()` in `atlas.html` exportiert nur die ganze Canvas | **H** | UX | Export-Dialog in `atlas.html`: Rechteck aufziehen, Grid-Art/Zellgröße, PNG des Ausschnitts (Top-10 #2) |
| Interior-/Cave-Ansichten | Ja (Location-Scale) | **Nein** — `AtlasNodeLevel` endet bei `city` (`packages/atlas/src/constants.ts`, Prisma-Enum) | **M** | DEF/Scope | Optionales Level `site` (Battlemap/Interior) unterhalb `city`; Schema-Migration + Grid-first-Rendering — Phase 3, Owner-Frage 2 |
| Custom Assets / Upload-Stamps | Ja | **Ja** — `uploadAtlasStampAction` + AI-Stempel (5 Varianten, `pending`→`approved`, `AtlasPaletteItem.reviewStatus`). Lücke: `atlas-viewer.js` (Static) rendert nur Builtin-Glyphen, keine PNG-Stempel; Portal preloaded Bilder korrekt | **L/M** | ARCH | Approved-Palette-Bilder in Static-Export-Payload + Preload in `atlas-viewer.js` analog Portal (Top-10 #8) |
| Hierarchischer World-Builder | Nein | **Ja** — Globe→Continent→Landscape→City, Drill-down (`childNodeId`), Eltern-Silhouette, Breadcrumb; in allen drei Viewern | — | **USP** | Ausbauen statt angleichen: Drill-down-Battlemap-Ebene (s.o.), Silhouetten-Qualität halten |
| Portal-Sichtbarkeit | Nein | **Ja** — dreistufig server-seitig (`packages/database/src/atlas-service.ts` → `getAtlasForContext`, `filterAtlasEntities`, `isAtlasEntityAccessible`), abgesichert durch `atlas-service.test.ts` + `scripts/security-leaks.test.ts`; Portal-Seite prüft Silhouette-Feature zusätzlich | — | **USP** | Bei jeder neuen Payload-Erweiterung (tileLayer, Palette-Bilder) Leak-Tests zuerst erweitern |
| AI-Stempel & Lore-Vorschläge | Nein | **Teilweise** — AI-Stempel-Pipeline produktiv (`AtlasStampGenerator.tsx` + `generateAtlasStampVariantsAction`, Review-Workflow); `atlas_describe_region` mit UI (`RegionDescribePanel.tsx`); `atlas_name_regions` als Action/Proposal definiert (`packages/ai-brain/src/actions.ts`, `proposals.ts`) **ohne UI-Panel**; Procedural Draft mit Ghost-Overlay + Accept/Discard in `atlas.html` | **L/M** | USP mit Lücke | Namens-Panel analog `RegionDescribePanel` (Top-10 #9); Proposal-only-Regel beibehalten |
| Einheitliche Runtime (Editor = Viewer) | Eine App | **Drei Render-Pfade**: `atlas.html` (Editor+View), `atlas-viewer.js` (Static), `AtlasViewer.tsx` (Portal). M4 (React-Editor entfernen) ist vollzogen — `AtlasEditor.tsx`/`ProceduralDraftPanel` existieren in `apps/studio` nicht mehr. Divergenz real: Relief-Shading + Ridge-Glyphen (`scatterGlyphsAlongPath`) nur im Portal; tileLayer + Grid nur im Editor | **H** | ARCH | Ziel „ein Runtime, zwei Modi" zu Ende führen: Portal auf `atlas.html?mode=view` (iframe) oder gemeinsamen Render-Core; Entscheidung Owner-Frage 4 (Top-10 #10) |
| Messwerkzeug / Löschen / Layer | Ja | Messen (`measure`-Tool), Eraser, Layer-Feld (`LAYER_Z`) vorhanden in `atlas.html`; kein Layer-*Panel*, keine Reihenfolge-UI | **L** | UX | Layer-Reihenfolge-UI erst bei Bedarf; Messwerkzeug um Maßstabseinheit aus `style-presets.ts` (`scaleUnit: leagues`) ergänzen |
| Gebogene Labels | Teilw. | **Ja** — `label-layout.ts` `layoutCharactersOnPath` + Umkehren; in allen drei Viewern | — | erledigt (W0–P7) | Nur Feintuning: Letter-Spacing pro Zoom (bereits als Idee in `atlas-follow-ups.md`) |
| Voll-Procedural-Maps | Ja (ein Klick, ganze Karte) | Bewusst anders: `procedural.ts` `generateDraft`/`rerollDraft` (deterministisch, lockbare Features) → Ghost-Overlay → manuelle Übernahme | **bewusst** | DEF | Nicht angleichen — Proposal-only ist Sicherheits-/Produktentscheidung (siehe §5) |

---

## 3. Top-10 Verbesserungen (priorisiert: Impact × Machbarkeit, UWE-Stärken zuerst)

### #1 tileLayer-Parität: Portal + Static Export (Phase 0)
- **Nutzen:** Größter sichtbarer Spielerwert — heute sehen Spieler die vom DM gemalte Terrain-Grundschicht überhaupt nicht; Karten wirken im Portal leer. Kein DM-Workaround möglich.
- **Aufwand:** **M**. `packages/static-export/src/export-atlas.ts` (Payload um `tileLayer` erweitern), `apps/portal/app/auth/worlds/[worldSlug]/atlas/[nodeId]/page.tsx` (durchreichen), `apps/portal/src/components/atlas/AtlasViewer.tsx` + `packages/static-export/static/atlas-viewer.js` (Rendering via `paintTerrainBlobs` aus `@uwe/atlas` — Funktion existiert, nur aufrufen).
- **Abhängigkeiten:** Keine. Kann vor Runtime-Konsolidierung passieren (Render-Funktion ist geteilt).
- **Risiko:** `tileLayer` ist map-weit ohne eigene Sichtbarkeit — sichtbar nur, wenn `AtlasMap` selbst portal-sichtbar ist (Filter in `getAtlasForContext` greift auf Map-Ebene). Klären, ob das reicht (Owner-Frage 3).
- **Akzeptanzkriterien:** Portal-Node und Static Export zeigen pixel-äquivalente Terrain-Blobs zum Editor-View-Mode; `packages/database/src/atlas-service.test.ts` prüft, dass `tileLayer` nur bei portal-sichtbarer Map im Kontext-Payload landet; `scripts/security-leaks.test.ts` um Assertion auf `export-atlas.ts` erweitert; `pnpm test:security` grün.

### #2 Export-Dialog: Ausschnitt + Square/Hex-Grid (VTT-tauglich)
- **Nutzen:** DM-Zeitersparnis: Battlemap-Ausschnitt direkt als PNG mit Grid für den Spieltisch/VTT — heute nur Ganz-Canvas-Screenshot mit Nachbearbeitung.
- **Aufwand:** **M**. Nur `packages/static-export/static/atlas.html` (Dialog, Rect-Auswahl-Interaktion, Offscreen-Canvas-Render des Ausschnitts, Grid via vorhandenem `buildGridLines` aus `atlas-engine.js`).
- **Abhängigkeiten:** Keine — `export-grid.ts` ist fertig und getestet (`export-grid.test.ts`).
- **Risiko:** Gering; reine Editor-Funktion, kein Portal-Pfad. Kein VTT-Wall/Light-Export versprechen (nur PNG ± Grid).
- **Akzeptanzkriterien:** Rechteck aufziehen → Vorschau; Grid `square|hex|none` + Zellgröße wählbar; PNG enthält exakt den Ausschnitt; Export-Einstellungen werden im Doc (`settings`) gemerkt („Template"); manueller Test laut `docs/handoffs/atlas-singlefile/README.md`-Gate.

### #3 Pfad-Anhänge als Editor-Werkzeug (CoK-Kern-Workflow)
- **Nutzen:** Der zentrale CoK-Differenzierer: Straße ziehen → Häuser/Bäume säumen automatisch. Spart pro Stadt-/Dorfkarte dutzende manuelle Stempel-Platzierungen.
- **Aufwand:** **M**. `atlas.html` (Auswahl-Panel-Sektion für `river`/`road`: Kind trees/houses/towers, Spacing, Seite, Seed, „Neu würfeln"); Persistenz als reguläre `AtlasObject`s über bestehende Bridge (`splitDocForSave` in `packages/atlas/src/bridge.ts` — unverändert); `scripts/atlas-cok-demo-seed.ts` um Attachment-Beispiel erweitern.
- **Abhängigkeiten:** Empfohlen nach #6 (Undo), da ein Klick viele Objekte erzeugt; ohne Undo mindestens „generierte Gruppe wieder entfernen"-Aktion.
- **Risiko:** Generierte Objekte erben Default-Sichtbarkeit `dm_only` (Schema-Default) — korrekt, kein Leak; Stil-Risiko gering (nutzt Builtin-Glyphen).
- **Akzeptanzkriterien:** Gleicher Seed → identische Platzierung (deckt `path-attachments.test.ts` bereits ab); generierte Objekte sind einzeln selektier-/löschbar; Save-Roundtrip über Bridge verlustfrei; im Portal sichtbar nach Freigabe.

### #4 Stempel-Zufallsvariation beim Platzieren
- **Nutzen:** Organischer CoK-Look ohne Mehrarbeit; verhindert „Stempel-Raster"-Optik.
- **Aufwand:** **S**. `atlas.html` `placeStamp()` + Toolbar-Toggle; `randomStampVariation(stampSeedFromKey(objectKey))` aus vorhandener Engine.
- **Abhängigkeiten:** Keine.
- **Risiko:** Keins — Werte landen in bestehenden Feldern `scale`/`rotation` von `AtlasObject`.
- **Akzeptanzkriterien:** Toggle an → Scale ∈ [0.7, 1.3], Rotation ∈ [−15°, 15°], deterministisch pro Objekt; Toggle aus → exakt 1.0/0°; Auswahl-Panel kann Werte weiterhin manuell überschreiben.

### #5 Multi-Select & Gruppen-Operationen
- **Nutzen:** CoK-Workflow „Kisten auf Türme legen, gemeinsam bewegen"; Voraussetzung für komfortables Aufräumen nach Auto-Fill.
- **Aufwand:** **L**. Nur `atlas.html`: Selektionsmodell `selectedKey` → `Set<key>`, Shift-Klick + Rubber-Band, Batch-Move/-Delete/-Visibility; Bridge/Schema unverändert (Save sendet ohnehin den kompletten Node-Satz — CRITICAL-Semantik in `bridge.ts` beachten).
- **Abhängigkeiten:** Sinnvoll nach #6 (Undo). Persistente Gruppen (`groupId` auf `AtlasObject`) nur nach Owner-Entscheid (Frage 5).
- **Risiko:** Editor-Regression (Hit-Testing, Drag) — manueller Werkzeug-Durchlauf laut Handoff-Gate nötig.
- **Akzeptanzkriterien:** Rahmen-Selektion wählt Features+Objects; gemeinsames Verschieben erhält relative Abstände; Entf löscht alle; Sichtbarkeits-Batch setzt alle; Save-Roundtrip verlustfrei.

### #6 Undo/Redo im Editor
- **Nutzen:** Grundlagen-UX; ohne Undo sind alle Auto-Werkzeuge (#3, #7) riskant und werden nicht benutzt.
- **Aufwand:** **M**. `atlas.html`: Snapshot-Stack des Docs (JSON, z.B. 20 Schritte, nach `migrateDoc`-Shape aus `doc.ts`); Ctrl+Z/Ctrl+Y; Autosave (`persist()`) unverändert.
- **Abhängigkeiten:** Keine; sollte **vor** #3/#7 landen.
- **Risiko:** Speicher (Doc ist klein, JSON-Snapshots ok für 64×40-Tile-Grid); Determinismus der Engine macht Redo stabil.
- **Akzeptanzkriterien:** Zeichnen/Stempeln/Löschen/Terrain-Malen/Auto-Fill sind rückgängig machbar; Stack-Limit greift; Undo über Save-Grenzen hinweg konsistent mit Bridge-Diff-Sync (kompletter Node-Satz wird gesendet).

### #7 Auto-Fill mit Kollisionsvermeidung (Plots respektieren Pfade)
- **Nutzen:** CoK-Verhalten „Wald-Plot lässt Straße frei"; erspart manuelles Freiräumen gestreuter Glyphen.
- **Aufwand:** **M**. `packages/atlas/src/terrain.ts` (`scatterGlyphsInPolygon` um optionale `exclusions: { path, width }[]` erweitern — Rejection-Sampling zusätzlich gegen Korridor via vorhandenem `distToSegment` aus `geometry.ts`); `atlas.html` übergibt River/Road-Pfade des Nodes; Tests in `terrain.test.ts`.
- **Abhängigkeiten:** Keine (Engine-seitig additiv, Signatur rückwärtskompatibel).
- **Risiko:** Determinismus wahren — Exclusions dürfen den PRNG-Stream nur durch Rejection beeinflussen (gleicher Seed + gleiche Exclusions ⇒ gleiches Ergebnis); Golden-Tests ergänzen.
- **Akzeptanzkriterien:** Wald-Polygon mit querender Straße → keine Glyphe näher als `width/2` am Pfad; ohne Exclusions bit-identisch zum heutigen Verhalten (Regressionstest).

### #8 Static-Viewer: AI-/Upload-Stempel rendern
- **Nutzen:** Spieler des Static Exports sehen dieselbe Karte wie im Portal — heute fallen alle Nicht-Builtin-Stempel stumm weg.
- **Aufwand:** **S/M**. `packages/static-export/src/export-atlas.ts` (nur `approved` Palette-Items exportieren, die von sichtbaren Objects referenziert werden — `imageData` aus `styleTags`); `packages/static-export/static/atlas-viewer.js` (Image-Preload analog `AtlasViewer.tsx` `stampImagesRef`).
- **Abhängigkeiten:** Gut kombinierbar mit #1 (gleiche Payload-Erweiterung).
- **Risiko:** Leak-Fläche: niemals `pending`-Items oder unreferenzierte Palette exportieren; Payload-Größe (Base64) — nur referenzierte Items.
- **Akzeptanzkriterien:** Static Export zeigt approved AI-Stempel; `security-leaks.test.ts` prüft `reviewStatus`-Filter im Export; Export ohne Custom-Stempel bleibt byte-stabil.

### #9 `atlas_name_regions` UI-Panel (UWE-USP: AI)
- **Nutzen:** Prozeduraler Entwurf liefert heute `labelHint`-Platzhalter; das Namens-Panel schließt den Loop „Entwurf → stimmige Namen → Übernahme" und ist ein Feature, das CoK nicht hat.
- **Aufwand:** **M**. Neues Host-Panel `apps/studio/src/components/atlas/RegionNamePanel.tsx` analog `RegionDescribePanel.tsx`; Action/Proposal-Flow existiert (`packages/ai-brain/src/actions.ts`, `proposals.ts` → `atlas_draft_names`, Status `pending`); Übernahme schreibt `labelText` pro Feature über bestehende Save-Actions.
- **Abhängigkeiten:** Keine (W0-Policy ist umgesetzt; Routing DnD-Kontext Cloud/RTX erlaubt, `personal_brain` bleibt hart lokal — `privacyGuard.ts`).
- **Risiko:** Proposal-only strikt einhalten: kein Auto-Apply; Namen einzeln übernehmen/ablehnen.
- **Akzeptanzkriterien:** Panel listet Vorschläge pro Feature-ID; Übernahme einzeln; Proposal bleibt `dm_only`; `packages/ai-brain/src/brain-actions.test.ts` um Panel-Flow-Assertions erweitert.

### #10 Runtime-Konsolidierung: Portal-Viewer auf die Single-File-Runtime
- **Nutzen:** Beendet die Dreifach-Pflege (jede Render-Neuerung heute ×3); erst danach sind Features wie Atmosphäre/Relief überall konsistent. M4-Ziel „ein Runtime, zwei Modi" (`docs/handoffs/atlas-singlefile/README.md`) ist studio-seitig erreicht, portal-/static-seitig nicht.
- **Aufwand:** **L**. Variante A (empfohlen): `apps/portal` bettet `atlas.html?mode=view` als iframe ein (wie `AtlasStudioHost.tsx`, nur read-only, Daten server-gefiltert injiziert wie beim Static Export); `AtlasViewer.tsx` entfällt. Vorher Portal-Exklusiv-Features in die Runtime holen (Relief-Shading `buildReliefShading`, Ridge-Glyphen `scatterGlyphsAlongPath` — Engine-Funktionen sind geteilt, nur Aufrufe fehlen in `atlas.html`).
- **Abhängigkeiten:** Owner-Entscheid (Frage 4); #1/#8 vorher (sonst konsolidiert man eine lückenhafte Runtime).
- **Risiko:** Portal-Regression (Wiki-Link-Navigation, Breadcrumb, CSP im Portal für iframe/srcDoc prüfen — CSP nicht ohne Review schwächen, siehe `SECURITY.md`); Übergangsweise Feature-Freeze auf `AtlasViewer.tsx`.
- **Akzeptanzkriterien:** Ein Render-Codepfad für Editor/Portal/Static; Portal-Funktionen (Drill-down, linkedPageId, Breadcrumb) unverändert; `pnpm test:security` + Security-Leak-Tests grün; `AtlasViewer.tsx` gelöscht oder auf dünnen iframe-Wrapper reduziert.

---

## 4. Phasierungs-Vorschlag (PR-Schnitte, orientiert an docs/prompts/atlas-orchestrator.md)

Je Phase: **1 Domain pro Branch, Draft-PR, `pnpm ci:light` als Gate**; security-relevante PRs zusätzlich `pnpm test:security`.

### Phase 0 — Parität & Schulden
| Branch | Inhalt | Gate |
|---|---|---|
| `atlas-p0-tilelayer-parity` | #1: tileLayer in `export-atlas.ts`-Payload, Portal-Page, `AtlasViewer.tsx`, `atlas-viewer.js` | `ci:light` + `test:security` |
| `atlas-p0-static-stamps` | #8: approved Palette-Bilder im Static Export + Viewer-Preload | `ci:light` + `test:security` |
| `atlas-p0-editor-relief` | Quick Win: Relief-Shading + Ridge-Glyphen auch im Editor rendern (Angleich an Portal) | `ci:light` |

### Phase 1 — CoK-Kern-Workflow
| Branch | Inhalt | Gate |
|---|---|---|
| `atlas-p1-undo` | #6: Undo/Redo (Voraussetzung für Auto-Werkzeuge) | `ci:light` |
| `atlas-p1-path-attachments` | #3: Pfad-Anhänge-UI + Demo-Seed-Erweiterung | `ci:light` |
| `atlas-p1-scatter-exclusions` | #7: Kollisionsvermeidung in `terrain.ts` (Engine, additiv) | `ci:light` |
| `atlas-p1-stamp-variation` | #4: Variation-Toggle (klein, separat mergebar) | `ci:light` |

### Phase 2 — Polish
| Branch | Inhalt | Gate |
|---|---|---|
| `atlas-p2-export-dialog` | #2: Ausschnitt + Grid-Export | `ci:light` |
| `atlas-p2-multiselect` | #5: Multi-Select/Gruppen-Ops | `ci:light` |
| `atlas-p2-atmosphere-light` | Nur nach Owner-Frage 1: statische Atmosphäre als Preset-Option | `ci:light` |

### Phase 3 — UWE-USP
| Branch | Inhalt | Gate |
|---|---|---|
| `atlas-p3-region-names` | #9: `atlas_name_regions`-Panel (Proposal-only) | `ci:light` + `test:security` |
| `atlas-p3-handout-pipeline` | Handout: Export-Ausschnitt (#2) → Asset persistieren → `createAtlasHandoutPageAction` befüllt Page statt Stub | `ci:light` |
| `atlas-p3-runtime-unify` | #10: Portal auf Single-File-Runtime (nach Owner-Frage 4) | `ci:light` + `test:security` |
| `atlas-p3-site-level` | Nur nach Owner-Frage 2: Node-Level `site` für Interior/Battlemaps (Schema-Migration ⇒ seriell, Konfliktmatrix beachten) | `ci:light` |

---

## 5. Bewusst NICHT nach CoK bauen

1. **Fog of War** — bereits per Owner-Entscheid deferred (`docs/engineering/atlas-follow-ups.md`); nicht durch die Hintertür wieder einführen.
2. **Voll-prozedurale Ein-Klick-Weltkarten mit Auto-Apply** — widerspricht der Non-negotiable „AI/Generatives = Proposal → Review → Übernehmen" (`docs/prompts/atlas-orchestrator.md`); UWEs Ghost-Overlay-Flow (`generateDraft` → Accept/Discard) ist die richtige Form und bleibt.
3. **3D-Höhe / Perspektiv-Rendering / WebGL-Engine** — der Canvas-2D-Stack ist Self-Hosted-realistisch und deckt den Tolkien-Ink-Stil (Relief-Glyphen + Shading) vollständig ab; ein Engine-Wechsel wäre Rewrite ohne Paritäts-Grund.
4. **CoK-Assets/Artwork übernehmen** — Urheberrecht; Workflows ja, Assets nein. UWEs Weg: Builtin-Glyphen-Registry (`glyphs.ts`, Stil-Regeln im Pictogram-Styleguide) + AI-Stempel-Pipeline mit festem Stil-Prompt (`stamp-prompt.ts`).
5. **VTT-Wall/Light/Dynamic-Lighting-Export** — nicht versprechen; PNG ± Grid (#2) ist der ehrliche, wartbare Umfang.
6. **Animierte Atmosphäre (Wetter-Partikel, Schneefall, Tag/Nacht-Zyklen)** — Stil-Bruch mit dem statischen Pergament-Look und Perf-Risiko; höchstens statische „Atmosphäre light" nach Owner-Entscheid.
7. **Kommerzieller Asset-Marktplatz/Store-Anbindung** — UWE ist self-hosted; Palette-Workflow (upload/ai + Review) deckt den Bedarf.

---

## 6. Quick Wins (je < 1 PR)

1. **Stamp-Variation-Toggle** (= Top-10 #4): `packages/static-export/static/atlas.html` (`placeStamp()`); Engine-Aufruf `randomStampVariation`/`stampSeedFromKey` existiert im Bundle.
2. **CoK-Demo-Seed vervollständigen:** `scripts/atlas-cok-demo-seed.ts` um Stempel-Objekte, ein Path-Attachment-Beispiel und einen kleinen `tileLayer` erweitern — sonst testet die manuelle Benchmark-Session (README-Schritt 3) die CoK-Features gar nicht.
3. **Relief-Shading im Editor:** `atlas.html` ruft `buildReliefShading` (bereits in `atlas-engine.js`) für `mountains/hills/snow`-Biome auf — Angleich an Portal-Rendering, reine Render-Ergänzung.
4. **Pending-Stempel in der Editor-Palette kennzeichnen/filtern:** `listPaletteItems` (`packages/database/src/atlas-service.ts`) liefert auch `pending`; Editor-Palette sollte `pending` ausgrauen oder ausblenden (Anzeige-Logik im Palette-Loader von `apps/studio/app/atlas-actions.ts` bzw. `atlas.html`).
5. **PRNG-Konsolidierung:** lokale `mulberry32`-Kopien in `terrain.ts`, `procedural.ts`, `stamp-variation.ts`, `path-attachments.ts` auf `prng.ts` umstellen — Golden-Regression-Tests (`prng.test.ts`) sichern Stream-Identität; im Code selbst als Follow-up markiert (`prng.ts`).
6. **Legende im Static-Viewer:** `atlas-viewer.js` zeigt keine Objekt-/Glyphen-Legende (Editor-View hat eine) — kleine Render-Ergänzung.
7. **Curved-Label Letter-Spacing pro Zoom:** bereits als Idee in `docs/engineering/atlas-follow-ups.md`; Anpassung in `atlas.html`/`AtlasViewer.tsx` auf Basis `layoutCharactersOnPath`-Parameter.
8. **Maßstabsleiste/Kompassrose rendern:** `style-presets.ts` deklariert `compassRose: true` + `scaleBar` mit `scaleUnit: "leagues"` — im Editor/Viewer wird beides nicht gezeichnet; kleine Deko-Render-Funktion in der Runtime.

---

## 7. Offene Fragen an den Owner (max. 5)

1. **Atmosphäre vs. Tolkien-Ink:** Soll eine optionale, statische „Atmosphäre light" (Vignette, Tages-/Wettertönung als Preset-Variante in `style-presets.ts`) kommen — oder bleibt Tolkien-Ink bewusst pur? (Betrifft Phase 2, Matrix-Zeile Licht/Wetter.)
2. **Battlemap-/Interior-Fokus:** Neues Node-Level `site` unterhalb `city` (Interior/Cave/Battlemap, Grid-first)? Erfordert Prisma-Migration (`AtlasNodeLevel`) und ist die einzige Top-Lücke mit Schema-Änderung.
3. **tileLayer-Sichtbarkeit:** Reicht die heutige map-weite Sichtbarkeit (Spieler sehen den kompletten Terrain-Layer, sobald die Map freigegeben ist), oder braucht der tileLayer mittelfristig eine eigene Maske (z.B. unerforschte Zellen `dm_only`)? Beeinflusst Design von #1.
4. **Runtime-Endzustand Portal:** `AtlasViewer.tsx` durch iframe auf `atlas.html?mode=view` ersetzen (ein Codepfad, empfohlen) — oder React-Viewer bewusst behalten und Dreifach-Parität dauerhaft pflegen?
5. **Gruppierung persistent?** Reicht Editor-seitiges Multi-Select (ohne Schema), oder sollen Gruppen dauerhaft gespeichert werden (`groupId` auf `AtlasObject`, Prisma-Migration)?

---

## Anhang: Einordnung der Befunde

- **UX-Gaps (Engine fertig, UI fehlt):** Pfad-Anhänge, Stamp-Variation, Export-Grid/Ausschnitt, Scatter-Exclusions (Engine additiv), Undo, Multi-Select, Kompass/Maßstab.
- **Architektur-Schulden:** tileLayer-Parität (Export-Payload + zwei Viewer), Custom-Stempel im Static-Viewer, drei Render-Pfade (Portal-Konsolidierung), PRNG-Duplikate, Relief-Shading-Divergenz Editor↔Portal.
- **Bewusst deferred (nicht anfassen ohne Owner):** Fog of War, Agent-Job-Text-Provider (`packages/ai-brain/src/providers/agentJobTextProvider.ts` wirft absichtlich), mehrere Atlanten pro Welt.
- **Hinweis zur Pflichtlektüre-Liste:** `packages/atlas/src/biome-scatter.ts` existiert nicht — die Biome-Scatter-Logik lebt in `terrain.ts` (`scatterGlyphsInPolygon`, `scatterGlyphsAlongPath`); `biome-scatter.test.ts` validiert das `BIOME_SCATTER_GLYPH`-Mapping aus `glyphs.ts`.
- **Sicherheitslage:** dreistufige server-seitige Filterung ist vorbildlich und testgesichert; jede der vorgeschlagenen Payload-Erweiterungen (#1, #8) muss die Leak-Tests **zuerst** erweitern (Test-first), bevor Felder exportiert werden.
