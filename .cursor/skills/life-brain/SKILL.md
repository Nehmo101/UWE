---
name: life-brain
description: Work with UWE Life Brain — personal local knowledge store (documents, facts, captures), search/filter, capture promotion, and local-only agent context. Use when implementing or reviewing Life Brain features, privacy gating, or RTX context loading.
---

# Life Brain

Persönliches Life-Brain (`PersonalBrainDocument`, `PersonalBrainFact`) ist **strikt getrennt** vom DnD-Brain.

## Datenmodell

| Entity | Tabelle | Felder |
|--------|---------|--------|
| Dokument | `personal_brain_documents` | title, content, category, tags (JSON), metadata |
| Fakt | `personal_brain_facts` | title, content, factType, tags (JSON), metadata |
| Verknüpfung | `admin_entity_links` | capture → personal_brain_* (`promoted_to`) |

Kategorien: `PERSONAL_BRAIN_CATEGORIES` in `@uwe/database/server`.

## Suche & Retrieval

Domain-Logik in `packages/database/src/personal-brain-search.ts`:

- Stichwort-Suche (title, content, tags, category/factType)
- Filter: `category`, `factType`, `tag`
- Keine Embeddings für Life Brain — Keyword/Filter only (DnD-Brain-Embeddings bleiben getrennt)

Service-API: `LifeAdminService.searchPersonalBrain()`, `listPersonalBrainTags()`, `getPersonalBrain*Detail()`.

Studio:

- UI: `/life-brain` (Suche + Filter)
- Details: `/life-brain/documents/[id]`, `/life-brain/facts/[id]`
- API: `GET /api/life-brain/search`, `GET|POST /api/life-brain/context`

## Capture → Life Brain

`LifeAdminService.promoteCaptureToLifeBrain()`:

1. Erstellt Dokument (oder Fakt mit `asFact: true`)
2. Verknüpft Capture via `AdminEntityLink`
3. Setzt Capture-Status auf `linked`

UI: Capture-Inbox → „Ins Life Brain“.

## Lokaler Agent-Kontext

```typescript
import { loadPersonalBrainAgentContext, createLifeAdminService } from "@uwe/database/server";

const service = createLifeAdminService(prisma);
const context = await loadPersonalBrainAgentContext(
  (q, limit) => service.searchPersonalBrainDocumentsForContext(q, limit),
  (q, limit) => service.searchPersonalBrainFactsForContext(q, limit),
  { query: userPrompt, limit: 12 },
);
```

KI-Prompt-Handler nutzt query-fokussierten Kontext für `personal_brain`-Modus.

## Privacy (hart)

| Kontext | Cloud | RTX |
|---------|-------|-----|
| `general_chat` | Ja | optional |
| `personal_brain` | **Nein** | **Ja** |

- `LOCAL_ONLY_CONTEXT_MODES` in `packages/ai-brain/src/router/types.ts`
- `assertPersonalBrainLocalOnly()` für Context-API
- RTX offline → Job-Queue, **kein** Cloud-Fallback

Details: [docs/life-brain-privacy.md](../../../docs/life-brain-privacy.md)

## Tests

```bash
pnpm --filter @uwe/database test
pnpm --filter @uwe/ai-brain test
```

Relevante Dateien:

- `packages/database/src/personal-brain-search.test.ts`
- `packages/database/src/personal-brain-privacy.test.ts`
- `packages/database/src/life-admin-service.test.ts`
- `packages/ai-brain/src/router/personal-brain-privacy.test.ts`

## Quality gate

```bash
pnpm quality
```
