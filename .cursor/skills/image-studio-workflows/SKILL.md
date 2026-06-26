---
name: image-studio-workflows
description: Implement Image Studio jobs, RTX/cloud provider routing, asset linking, and Capture pipeline in UWE. Use for generate/variant/inpaint, dm_only assets, and label workflows.
---

# Image Studio Workflows

## Status

Phase 2 — generate/variant/inpaint work; no full canvas editor yet.

Docs: `docs/IMAGE_STUDIO.md`, `docs/FEATURE_MATURITY_MATRIX.md` §1.

## Architecture

| Layer | Location |
|-------|----------|
| Package | `packages/image-studio/` — `runImageStudioTask` |
| DB | `ImageStudioProject`, `ImageStudioVersion`, `ImageStudioLink` |
| Service | `packages/database/src/image-studio-service.ts` |
| Studio UI | `apps/studio/app/image-studio/` |
| API | `apps/studio/app/api/image-studio/` |
| Assets | `packages/assets/` — storage keys, MIME validation |
| RTX | `tools/uwe-rtx-connector` (active) — `/v1/images`; legacy inbound `RTX_AGENT_URL` deprecated |

## Provider routing

| Provider | Allowed operations | Context |
|----------|-------------------|---------|
| `local_rtx` | generate, variant, inpaint, edit | Full prompts (user responsibility) |
| `cloud` | generate, variant only (policy) | **No** auto brain/world injection |
| `auto` | Prefer RTX, fallback per ENV | Respect `IMAGE_STUDIO_ALLOW_CLOUD` |

ENV: `IMAGE_STUDIO_ALLOW_CLOUD`, RTX endpoint in inference settings.

## Security rules

1. Generated images → `dm_only` visibility by default.
2. Cloud prompts: user can type world data manually — document policy risk; no auto-leak from retrieval.
3. Provider output bypasses upload magic-byte check — trust provider or validate post-download.
4. Studio API requires `requireStudioApiAuth`.

## Common tasks

### Job failure handling

Set `ImageStudioProject.status = failed` on job error; surface in UI.

### Capture → Image Studio

From Capture `file_image` entry: create `ImageStudioProject` with source asset link.

### Labels integration

`docs/LABELS.md` — `LabelTemplate`, `PrintList`; link generated assets to label print flows.

### Phase 2 gaps

- Canvas editor / `ImageEditorDraft`
- Cloud edit/inpaint restrictions in UI
- Source image upload for edit modes

## Tests

```bash
pnpm --filter @uwe/image-studio test
pnpm test:security  # route authz
```

## Orchestrator

Subagent 10 — after Capture 2.0 upload (Subagent 3). Coordinate on `packages/assets` if both touch upload paths.
