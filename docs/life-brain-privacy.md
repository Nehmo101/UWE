# Life Brain Privacy

Persönliches Life-Brain (`PersonalBrainDocument`, `PersonalBrainFact`) ist **strikt getrennt** vom DnD-Brain (`BrainDocument`, `BrainFact`).

## Suche & UI

| Surface | Zweck |
|---------|--------|
| `/life-brain` | Stichwort-Suche, Kategorie-/Tag-/Fakt-Typ-Filter, neue Einträge |
| `/life-brain/documents/[id]` | Dokument-Detail inkl. verknüpfter Captures |
| `/life-brain/facts/[id]` | Fakt-Detail inkl. verknüpfter Captures |
| `GET /api/life-brain/search` | Studio-auth API für Suche |
| `GET\|POST /api/life-brain/context` | Query-fokussierter Kontext für **lokale** Agenten |

Retrieval: Stichwort + Filter in `packages/database/src/personal-brain-search.ts`; semantische Chunks über RTX in `@uwe/ai-brain` (`indexPersonalBrainDocument`, `semanticSearchPersonalBrainChunks`). Life-Brain-Embeddings sind strikt getrennt vom DnD-Brain (`BrainChunk`).

## Capture → Life Brain

Captures aus `/capture` können per „Ins Life Brain“ als Dokument übernommen werden (`promoteCaptureToLifeBrain`). Quelle bleibt über `AdminEntityLink` sichtbar; Capture-Status wird `linked`.

## Regeln

Maßgeblich ist die
[Cloud-AI-Policy in `SECURITY.md`](../SECURITY.md#cloud-ai-context-boundaries),
architektonisch fixiert durch
[ADR 006](adr/006-ai-privacy-policy.md). D&D-Kontext ist nach der
administrativen Gateway-Policy konfigurierbar; ausschließlich persönlicher
Brain-Kontext bleibt unabhängig von Konfiguration hart local-only.

| Kontextmodus | Cloud erlaubt | RTX erforderlich |
|--------------|---------------|------------------|
| `general_chat` | Ja | Nein (Auto fällt auf Cloud zurück) |
| `brain` (DnD) | **Konfigurierbar**, Default `CLOUD_ALLOWED` | Nein (lokal bevorzugt; Cloud-Fallback nach Policy) |
| `current_object` | **Konfigurierbar**, Default `CLOUD_ALLOWED` | Nein (lokal bevorzugt; Cloud-Fallback nach Policy) |
| `current_object_plus_brain` | **Konfigurierbar**, Default `CLOUD_ALLOWED` | Nein (lokal bevorzugt; Cloud-Fallback nach Policy) |
| `personal_brain` | **Nein** | **Ja** |
| Mail-KI (Triage/Entwürfe) | Nein (nur Allgemeiner Chat-Fallback optional) | Ja |

Mail Center nutzt lokale RTX für Triage und Entwürfe; Cloud-Fallback gilt nur für allgemeinen Chat ohne persönliche Inhalte — siehe `/mail` Einstellungen.

## Implementierung

- Router: `packages/ai-brain/src/router/types.ts` — `personal_brain` in `LOCAL_ONLY_CONTEXT_MODES`
- Privacy Guard: `validateProviderContextCombination`, `validateResolvedRouteForContext`
- Kontext-Lader: `loadPersonalBrainAgentContext` / `loadPersonalBrainPromptContext` in `@uwe/database/server` — mit Retrieval wenn Prompt/Query gesetzt
- Chunks: `PersonalBrainChunk` + `createPersonalBrainService` — Embeddings via RTX (`indexPersonalBrainDocument`)
- Context-API-Gate: `assertPersonalBrainLocalOnly` — Cloud-Provider werden abgewiesen
- Studio UI: KI-Prompt Modus „Persönliches Life-Brain“ — nur lokal, deaktiviert bei Cloud-Provider

## RTX offline

Wenn RTX offline und `personal_brain` gewählt ist:

1. Anfrage wird als `ai_run`-Job mit `deferredAiPrompt: true` vorgemerkt
2. Antwort HTTP 202 mit `jobId`
3. **Kein** Cloud-Fallback
4. Ausführung beim nächsten Job-Lauf, sobald RTX erreichbar ist

Für D&D-Kontext im Auto-Modus ist dagegen ein Cloud-Fallback zulässig, wenn die
Gateway-Policy `CLOUD_ALLOWED` gilt. `dm_only` wird davor immer entfernt; der
Datenschutzmodus oder eine restriktivere Policy blockiert den Cloud-Pfad.

## Was nicht passiert

- Keine Übertragung privater Brain-Daten an OpenAI/Anthropic/Gemini
- Keine Vermischung mit DnD-Brain-Embeddings oder Portal-Inhalten
- Keine automatische Übernahme von KI-Outputs in Life-Brain ohne Review
