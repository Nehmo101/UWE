# Atlas — Follow-ups

Offene oder geplante Erweiterungen nach dem initialen Atlas-Merge (W0–P7).

## Erledigt auf `main`

- Gebogene Labels (`curvedLabel`-Werkzeug, Shortcut **C**): Pfad zeichnen → **Enter** → Text eingeben. Gespeichert als `LabelAnchor.pathCoordinates` in `@uwe/atlas/label-layout`.

## Geplant: Cursor / Agent-Job Text-Provider

Asynchroner Text-Provider über den bestehenden `agent_job`-Mechanismus (`docs/AGENT_JOBS.md`).

**Nicht geeignet für:** Bild-/Stempel-Generierung (weiter RTX/Cloud Image Studio).

**Integrationspunkt (Entwurf):**

```typescript
// packages/ai-brain/src/providers/agentJobTextProvider.ts (Stub)
export interface AgentJobTextRequest {
  prompt: string;
  taskType: string;
  worldSlug?: string;
}

export async function enqueueAgentJobTextDraft(
  request: AgentJobTextRequest,
): Promise<{ jobId: string }> {
  // Enqueue type: "agent_job" with Atlas/Lore payload; result → AiRun proposal
  throw new Error("Agent-Job text provider not wired yet");
}
```

**Voraussetzungen:** GitHub Agent Job konfiguriert, Proposal-Workflow (`runBrainAction` / `AiProposal`), kein Auto-Apply.

## Weitere Ideen

- Statischer Export: Atlas-Karten in `packages/static-export`
- Fog of War via `revealState` / `SessionUnlock` (bewusst nicht im MVP)
- Mehrere Atlanten pro Welt
