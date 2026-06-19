# Capture 2.0 Patterns

UWE Capture is the universal mobile inbox for Studio — text, links, files, DnD ideas, todos, hardware, contracts, workshop notes, and Life-Brain facts.

## Architecture

| Layer | Location |
|-------|----------|
| Schema | `CaptureEntry` in `packages/database/prisma/schema.prisma` |
| Triage logic | `packages/database/src/capture-triage-service.ts` |
| UI constants (client-safe) | `packages/database/src/capture-constants.ts` |
| Studio UI | `apps/studio/app/capture/`, `apps/studio/components/capture/` |
| Upload API | `apps/studio/app/api/capture/upload/route.ts` |

## Capture types (`CaptureType` enum)

Existing DB types cover all quick-capture chips. Life-Brain uses `quick_note` + `metadata.captureIntent = "life_brain"`.

Fields used on `CaptureEntry`:

- `storageKey` — inbox file under `_capture/{uuid}.ext` (not a world `Asset` yet)
- `worldId` / `pageId` — set when promoting to DnD
- `metadata` — `captureIntent`, `aiProposal`, `mimeType`, `originalFilename`

## AI proposals (review only)

`buildCaptureAiProposal()` runs **heuristic** classification (no RTX, no auto-apply).

Proposal stored at `metadata.aiProposal` with `status: "draft" | "accepted" | "rejected"`.

User must explicitly:

1. Review proposal (accept/reject)
2. Run a **triage action** to promote into another module

## Triage actions

`CaptureTriageService.executeTriage()` promotes captures and creates `AdminEntityLink` rows (`relationType: "promoted_to"`).

| Action | Target module |
|--------|----------------|
| `to_personal_project` | `/projects` |
| `to_workshop_project` | `/workshop` |
| `to_dnd_page` | world/page link |
| `to_hardware_device` | `/hardware` |
| `to_contract` | `/contracts` |
| `to_life_brain` | `/life-brain` |
| `archive` | status `archived` |
| `delete` | removes capture + links |

## Implementation checklist

1. Domain logic in `capture-triage-service.ts` — not in route handlers
2. Server actions in `capture-actions.ts` with `assertStudioTrusted()`
3. Client quick form imports `@uwe/database/capture-constants` only
4. File uploads via `/api/capture/upload` + `guardStudioMutation`
5. Tests in `capture-triage-service.test.ts`

## Quality

```bash
pnpm --filter @uwe/database test
pnpm quality
```
