# Life Brain Privacy

Persönliches Life-Brain (`PersonalBrainDocument`, `PersonalBrainFact`) ist **strikt getrennt** vom DnD-Brain (`BrainDocument`, `BrainFact`).

## Regeln

| Kontextmodus | Cloud erlaubt | RTX erforderlich |
|--------------|---------------|------------------|
| `general_chat` | Ja | Nein (Auto fällt auf Cloud zurück) |
| `brain` (DnD) | Nein | Ja |
| `current_object` | Nein | Ja |
| `current_object_plus_brain` | Nein | Ja |
| `personal_brain` | **Nein** | **Ja** |

## Implementierung

- Router: `packages/ai-brain/src/router/types.ts` — `personal_brain` in `LOCAL_ONLY_CONTEXT_MODES`
- Privacy Guard: `validateProviderContextCombination`, `validateResolvedRouteForContext`
- Kontext-Lader: `loadPersonalBrainPromptContext` in `@uwe/database/server` — mit Retrieval wenn Prompt/Query gesetzt
- Chunks: `PersonalBrainChunk` + `createPersonalBrainService` — Embeddings via RTX (`indexPersonalBrainDocument`)
- Studio UI: KI-Prompt Modus „Persönliches Life-Brain“ — nur lokal, deaktiviert bei Cloud-Provider

## RTX offline

Wenn RTX offline und ein lokaler Kontextmodus gewählt ist:

1. Anfrage wird als `ai_run`-Job mit `deferredAiPrompt: true` vorgemerkt
2. Antwort HTTP 202 mit `jobId`
3. **Kein** Cloud-Fallback
4. Ausführung beim nächsten Job-Lauf, sobald RTX erreichbar ist

## Was nicht passiert

- Keine Übertragung privater Brain-Daten an OpenAI/Anthropic/Gemini
- Keine Vermischung mit DnD-Brain-Embeddings oder Portal-Inhalten
- Keine automatische Übernahme von KI-Outputs in Life-Brain ohne Review
