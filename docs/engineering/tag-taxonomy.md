# Tag taxonomy and cleanup

UWE stores tags as **JSON string arrays** on entities (no central `Tag` table yet). The tag service aggregates, normalizes, and merges tags across domains.

## Supported entities

| Entity | Schema field | Studio UI |
|--------|--------------|-----------|
| Pages | `Page.tags` | Edit form, graph filter, search |
| Assets | `Asset.tags` | API/actions (UI gap) |
| Soundboard | `SoundboardButton.tags` | Button form |
| Life Brain docs | `PersonalBrainDocument.tags` | Service layer |
| Life Brain facts | `PersonalBrainFact.tags` | Service layer |

Capture and Workshop entries do not have tag columns yet.

## Service API (`@uwe/database/server`)

```typescript
import { createTagService, suggestTagMerges, mergeTags } from "@uwe/database/server";

const tags = createTagService(db);
const inventory = await tags.collectInventory({ worldId });
const suggestions = tags.suggestMerges(inventory);
const unused = tags.findUnused(inventory); // draft-only or dm_only only

await tags.merge({
  worldId,
  fromTags: ["Stadt", "STADT"],
  toTag: "stadt",
});
```

### Normalization

- `normalizeTagKey()` — comparison key (lowercase, umlaut fold, whitespace)
- `canonicalizeTag()` — display form (trimmed lowercase)

### Similar tag detection

1. **Normalized match** — `Stadt` and `STADT` share the same key
2. **Near duplicate** — Levenshtein distance ≤ 1 on normalized keys (min length 3)

`suggestTagMerges()` ranks groups by total reference count.

## Stress world tag variants

`pnpm db:seed:stress` seeds intentional duplicates for manual QA and `tag-service.test.ts`.

## Future work

- Studio admin UI at `/admin/tags` or world-scoped `/worlds/[slug]/tags`
- Optional normalized `Tag` Prisma model if cross-world taxonomy is needed
- Asset and Life Brain tag inputs in Studio forms

## Related

- `packages/database/src/tag-service.ts`
- `docs/FEATURE_MATURITY_MATRIX.md` §13
