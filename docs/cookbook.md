# UWE Cookbook

Native local model management for UWE Studio — **not** an Odysseus sidecar. The Cookbook helps admins choose, fit, and operate local LLM backends while respecting UWE privacy rules (RTX/local-only, no cloud for private context).

## Overview

| Component | Package / path | Purpose |
|-----------|----------------|---------|
| Model registry | `packages/cookbook/src/model-registry.ts` | Curated catalog with VRAM estimates and use-case tags |
| Engine registry | `packages/cookbook/src/engine-registry.ts` | Ollama, OpenAI-compatible, RTX Agent, Docker, LM Studio |
| Hardware profile | `packages/cookbook/src/hardware-profile.ts` | RAM/CPU/GPU probe (`nvidia-smi` or `COOKBOOK_GPU_*` env) |
| Model fit score | `packages/cookbook/src/model-fit.ts` | 0–100 score from VRAM/RAM vs model size |
| Runtime health | `packages/cookbook/src/runtime-health.ts` | Ollama tags, Docker probe, engine status |
| Diagnostics | `packages/cookbook/src/diagnostics.ts` | OOM, port conflict, auth, exposure patterns |
| AI routing hints | `packages/cookbook/src/routing-hints.ts` | Task → use case → recommended model |
| Admin UI | `apps/studio/app/admin/cookbook` | Dashboard |
| API | `GET /api/admin/cookbook` | JSON dashboard (auth required) |

## License note

[Odysseus](https://github.com/pewdiepie-archdaemon/odysseus) is **AGPL-3.0**. UWE Cookbook re-implements the *ideas* (hardware fit, serve diagnostics, recommendations) in TypeScript with UWE-specific use cases — **no Odysseus code was copied**.

## Use cases

| ID | UWE feature |
|----|-------------|
| `dnd_generator` | NPC / location / encounter / dungeon room generation |
| `deep_research` | Brain links, open threads, lore analysis |
| `editor_rewrite` | Wiki lore improvement |
| `image_prompting` | Image Studio prompt drafting |
| `session_prep` | Next session preparation |
| `canon_check` | Canon conflict detection |
| `player_safe_rewrite` | Player handouts and recaps |

## Privacy / routing integration

Cookbook feeds `@uwe/ai-brain` routing via `buildCookbookRuntimeProbe()` (`packages/ai-brain/src/cookbook-bridge.ts`):

1. **Private context modes** (`brain`, `current_object*`, `personal_brain`) → cloud blocked (unchanged server rules).
2. **Local-only mode** (`settings.ai.localOnlyMode` or `AI_LOCAL_ONLY`) → cloud blocked.
3. **Auto mode + local route** → `resolveCookbookModelForRequest()` picks a model by task/use case when no explicit model is set.
4. **Installed Ollama models** are preferred when they match the recommendation.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AI_INFERENCE_PROVIDER` | `ollama` or `openai_compatible` |
| `AI_INFERENCE_BASE_URL` | Local inference endpoint |
| `RTX_AGENT_URL` / `RTX_AGENT_TOKEN` | Remote GPU via `tools/uwe-rtx-agent` |
| `AI_LOCAL_ONLY` / `AI_DATENSCHUTZ_MODE` | Force local-only |
| `COOKBOOK_GPU_VRAM_GB` | Override detected VRAM (CI / headless hosts) |
| `COOKBOOK_GPU_NAME` | GPU label for override profile |
| `AI_USE_MOCK` | Mock inference for tests / dev without Ollama |

## Setup quick start

### Ollama (same host)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
```

`.env`:

```env
AI_INFERENCE_ENABLED=true
AI_INFERENCE_PROVIDER=ollama
AI_INFERENCE_BASE_URL=http://localhost:11434
```

### Docker Ollama (GPU host)

```bash
docker run -d --gpus all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
docker exec -it ollama ollama pull llama3.1:8b
```

### RTX Agent (UWE host → GPU PC)

On the GPU machine, run `tools/uwe-rtx-agent` (see `tools/uwe-rtx-agent/README.md`).

On UWE Studio:

```env
RTX_AGENT_URL=http://192.168.x.x:8787
RTX_AGENT_TOKEN=your-secret-token
PREFERRED_LOCAL_MODEL=llama3.1:8b
```

Use **private LAN IPs only** — public RTX URLs are blocked by `@uwe/security` and Cookbook warnings.

## Admin UI

Open **Cookbook** in the Studio admin sidebar (`/admin/cookbook`):

- Hardware fit (RAM, VRAM, backend)
- Installed local models
- Per-engine online status
- Recommendations per use case with fit score
- Runtime diagnoses and setup hints

## Tests

```bash
pnpm --filter @uwe/cookbook test
pnpm --filter @uwe/ai-brain test
pnpm --filter @uwe/studio test
```

Coverage includes hardware-fit scoring, cloud blocking for private contexts, health aggregation, and recommendation smoke tests.

## Extending the catalog

Add entries to `COOKBOOK_MODEL_REGISTRY` in `packages/cookbook/src/model-registry.ts`:

- `paramsB`, `contextLength`, `minVramGbQ4`
- `ollamaTags` for matching `ollama list`
- `useCases` from the table above
- `engines` the model supports

Re-run `pnpm --filter @uwe/cookbook test` after changes.
