# Atlas — Follow-ups

Offene oder geplante Erweiterungen nach dem initialen Atlas-Merge (W0–P7).

## Erledigt auf `main`

- **Gebogene Labels** (`curvedLabel`, Shortcut **C**): Pfad zeichnen → **Enter** → Text. Gespeichert als `LabelAnchor.pathCoordinates` (`@uwe/atlas/label-layout`).
- **Static Export:** Portal-gefilterte Atlas-Daten als `atlas/data.json` beim Static Export (`writeAtlasStaticJson` in `@uwe/static-export`).

## Bewusst zurückgestellt

### Cursor / Agent-Job als Text-Provider

`agent_job` / `dev_agent_job` ist für **Repository-Entwicklung** (GitHub Actions, Cursor Cloud Agents), nicht für In-App-Lore.

Stub: `packages/ai-brain/src/providers/agentJobTextProvider.ts` — wirft bewusst, bis ein dedizierter Async-Lore-Worker existiert.

Atlas-Lore nutzt: `runBrainAction`, prozeduraler Entwurf, RTX/Cloud über AI Gateway.

### Fog of War

Bewusst nicht im MVP (Owner-Entscheidung).

## Weitere Ideen

- Statischer **HTML**-Atlas-Viewer im Export-Bundle (JSON liegt bereits vor)
- Mehrere Atlanten pro Welt
- Gebogene Labels: Feintuning (Letter-Spacing pro Zoom, Pfad-Reversal)
