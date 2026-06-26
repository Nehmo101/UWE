# UWE KI-Erweiterung — Implementierungsfortschritt (Orchestrator)

Stand: **P18 abgeschlossen** (Durchlauf 2–8). Baut auf P00–P13 (`docs/ai-brain-mail/PROGRESS.md`) auf.

## Paket-Status

| Paket | Status | Notizen |
|-------|--------|---------|
| **P14** AI Router + Privacy Hardening | ✅ done | Zentraler `routeAiRequest`, Cloud = nur User-Prompt, `allowDmOnly` serverseitig |
| **P15** RTX-Agent Health + Status | ✅ done | `RTX_AGENT_URL`, `checkRtxHealth`, Admin-Status, Mobile-Chips |
| **P16** KI-Prompt UI (Unified API) | ✅ done | `/api/ai/prompt` → Router, Brain-Retrieval, Mobile Panel |
| **P17** RTX-Agent Provider | ✅ done | `RtxAgentProvider`, `chatViaRtxAgent`, bevorzugt vor direktem Ollama |
| **P18** QA + Doku | ✅ done | `privacy.test.ts`, UI-Tests, PROGRESS, Label-AI nur lokal |

## Architektur-Invariante (unverändert)

```txt
UWE ist der alleinige Besitzer aller Daten und allen Brain-Wissens.
Der RTX-Rechner ist nur ein austauschbarer Inference Worker.
Cloud-KI erhält niemals Brain-/World-/Objekt-Kontext — nur allgemeinen User-Prompt.
```

## Wichtige Pfade

| Bereich | Pfad |
|---------|------|
| AI Router | `packages/ai-brain/src/router/aiRouter.ts` |
| Privacy Guard | `packages/ai-brain/src/router/privacyGuard.ts` |
| RTX Agent Client (deprecated shim) | `packages/ai-brain/src/rtx-agent-client.ts` |
| RTX Host Connector (active; legacy `tools/uwe-rtx-agent` removed) | `tools/uwe-rtx-connector/` |
| Prompt API | `apps/studio/app/api/ai/prompt/route.ts` |
| Mobile UI | `apps/studio/components/MobileAiPromptPanel.tsx` |

## ENV (neu/ relevant)

- `RTX_AGENT_URL`, `RTX_AGENT_TOKEN` — bevorzugter lokaler Pfad
- `CLOUD_AI_PROVIDER`, `CLOUD_AI_API_KEY`, `CLOUD_AI_MODEL` — nur Allgemeiner Chat
- `RTX_TIMEOUT_MS`, `PREFERRED_LOCAL_MODEL`

## Tests

```bash
pnpm --filter @uwe/ai-brain test
node --import tsx --test apps/studio/src/lib/ai-prompt-ui.test.ts
```

## Nächste optionale Schritte

- E2E mit laufendem RTX-Agent + Ollama
- Semantic Brain-Search in Brain-Kontextmodus
- Windows-Tray in Installer-Paket einbinden
