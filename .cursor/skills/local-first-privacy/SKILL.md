---
name: local-first-privacy
description: Enforce UWE local-first and privacy rules — Maschinenraum-only brain context, no cloud leakage, deferred jobs, and separation of personal vs campaign data. Use when changing AI providers, context modes, brain retrieval, or deployment exposure.
---

# UWE Local-First Privacy

## Principles

1. **Campaign and brain data stay on the UWE host** — SQLite, uploads, backups local/self-hosted.
2. **Maschinenraum/Ollama/LM Studio = LAN only** — never in Cloudflare Tunnel or public DNS.
3. **Personal Life Brain = strictly local** — personal_brain never goes to cloud, hard-coded, not configurable.
4. **DnD/world context = configurable** — brain/current_object modes may go to cloud when admin policy allows (W0 default: CLOUD_ALLOWED, Maschinenraum preferred).
5. **Explicit Apply** — AI never writes canon without DM review.

## Context modes (W0 Atlas Policy)

| Mode | Cloud allowed | Maschinenraum required | Notes |
|------|---------------|--------------|-------|
| `general_chat` | Yes | No (falls back to cloud) | No context in prompt |
| `brain` (DnD) | **Configurable** | No (cloud fallback OK) | Default: CLOUD_ALLOWED |
| `current_object` | **Configurable** | No (cloud fallback OK) | Default: CLOUD_ALLOWED |
| `current_object_plus_brain` | **Configurable** | No (cloud fallback OK) | Default: CLOUD_ALLOWED |
| `personal_brain` | **Never** | Yes (always) | Hard local-only, not configurable |

`LOCAL_ONLY_CONTEXT_MODES = ["personal_brain"]` — only Life Brain is permanently blocked.

Defined in `packages/ai-brain/src/router/types.ts`.

Validation: `validateProviderContextCombination`, `validateResolvedRouteForContext` (both block only `personal_brain` on cloud routes).

## Brain separation

| Store | Models | Cloud | Portal |
|-------|--------|-------|--------|
| DnD Brain | `BrainDocument`, `BrainFact` | Never | Never |
| Life Brain | `PersonalBrainDocument`, `PersonalBrainFact` | Never | Never |
| Wiki pages | `Page`, blocks | Never (context) | Filtered publish only |

See `docs/life-brain-privacy.md`.

## Maschinenraum inference (outbound connector)

- `tools/uwe-engine-connector/` — outbound inference worker only (legacy inbound `tools/uwe-engine-agent` removed)
- No persistent UWE data storage on Maschinenraum host
- Connector connects outbound to the host over the private network; no inbound port

## Deployment checks

Before public exposure:

- Skill: `deployment-cloudflare-check`
- Only Studio (:3000) and Portal (:3001) behind tunnel
- `pnpm test:security`, `pnpm secret:scan`

## Deferred execution

When Maschinenraum offline + local-only mode:

- Queue `ai_run` job — HTTP 202
- **No cloud fallback**
- User notified via job status UI

## Checklist

- [ ] New context mode classified local-only or cloud-safe
- [ ] Context builder excludes cross-brain data
- [ ] Logs contain no prompt text with PII in production
- [ ] ENV documents Maschinenraum URL as internal only
- [ ] Backup/export opts for player notes documented (`docs/BACKUP.md`)

## Related

- Skill: `ai-agent-proposal-workflow`
- Skill: `uwe-brain`
- Skill: `hardware-homelab`
- Docs: `docs/life-brain-privacy.md`, `SECURITY.md`
