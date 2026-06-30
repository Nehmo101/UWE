# Atlas — Follow-ups

Offene oder geplante Erweiterungen nach dem initialen Atlas-Merge (W0–P7).

## Erledigt auf `main`

- **Gebogene Labels** (`curvedLabel`, Shortcut **C**): Pfad zeichnen → **Enter** → Text. Gespeichert als `LabelAnchor.pathCoordinates` (`@uwe/atlas/label-layout`).
- **Gebogene Labels — Pfad umkehren:** Auswahl-Panel „↔ Pfad umkehren“ (`LabelAnchor.pathReversed`).
- **Static Export:** Portal-gefilterte Atlas-Daten als `atlas/data.json` beim Static Export (`writeAtlasStaticBundle` in `@uwe/static-export`).
- **Static HTML Atlas-Viewer:** `atlas/index.html` + `atlas/atlas-viewer.js` — Drill-down, Pan/Zoom, Wiki-Links; Link vom Wiki-Index.

## Bewusst zurückgestellt

### Cursor / Agent-Job als Text-Provider

`agent_job` / `dev_agent_job` ist für **Repository-Entwicklung** (GitHub Actions, Cursor Cloud Agents), nicht für In-App-Lore.

Stub: `packages/ai-brain/src/providers/agentJobTextProvider.ts` — wirft bewusst, bis ein dedizierter Async-Lore-Worker existiert.

Atlas-Lore nutzt: `runBrainAction`, prozeduraler Entwurf, RTX/Cloud über AI Gateway.

### Fog of War

Bewusst nicht im MVP (Owner-Entscheidung).

## Weitere Ideen

- Mehrere Atlanten pro Welt
- Gebogene Labels: Letter-Spacing pro Zoom (Feintuning)
