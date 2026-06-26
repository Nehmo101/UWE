---
name: local-first-privacy
description: Enforce UWE local-first and privacy rules — RTX-only brain context, no cloud leakage, deferred jobs, and separation of personal vs campaign data. Use when changing AI providers, context modes, brain retrieval, or deployment exposure.
---

# UWE Local-First Privacy

## Principles

1. **Campaign and brain data stay on the UWE host** — SQLite, uploads, backups local/self-hosted.
2. **RTX/Ollama/LM Studio = LAN only** — never in Cloudflare Tunnel or public DNS.
3. **Cloud AI = general chat only** — no world pages, brain chunks, or personal life data.
4. **Explicit Apply** — AI never writes canon without DM review.

## Context modes

| Mode | Cloud allowed | RTX required |
|------|---------------|--------------|
| `general_chat` | Yes | No (falls back to cloud) |
| `brain` (DnD) | **No** | Yes |
| `current_object` | **No** | Yes |
| `current_object_plus_brain` | **No** | Yes |
| `personal_brain` | **No** | Yes |

Defined in `packages/ai-brain/src/router/types.ts` (`LOCAL_ONLY_CONTEXT_MODES`).

Validation: `validateProviderContextCombination`, `validateResolvedRouteForContext`.

## Brain separation

| Store | Models | Cloud | Portal |
|-------|--------|-------|--------|
| DnD Brain | `BrainDocument`, `BrainFact` | Never | Never |
| Life Brain | `PersonalBrainDocument`, `PersonalBrainFact` | Never | Never |
| Wiki pages | `Page`, blocks | Never (context) | Filtered publish only |

See `docs/life-brain-privacy.md`.

## RTX inference (outbound connector)

- `tools/uwe-rtx-connector/` — outbound inference worker only (legacy inbound `tools/uwe-rtx-agent` removed)
- No persistent UWE data storage on RTX host
- Connector connects outbound to the host over the private network; no inbound port

## Deployment checks

Before public exposure:

- Skill: `deployment-cloudflare-check`
- Only Studio (:3000) and Portal (:3001) behind tunnel
- `pnpm test:security`, `pnpm secret:scan`

## Deferred execution

When RTX offline + local-only mode:

- Queue `ai_run` job — HTTP 202
- **No cloud fallback**
- User notified via job status UI

## Checklist

- [ ] New context mode classified local-only or cloud-safe
- [ ] Context builder excludes cross-brain data
- [ ] Logs contain no prompt text with PII in production
- [ ] ENV documents RTX URL as internal only
- [ ] Backup/export opts for player notes documented (`docs/BACKUP.md`)

## Related

- Skill: `ai-agent-proposal-workflow`
- Skill: `uwe-brain`
- Skill: `hardware-homelab`
- Docs: `docs/life-brain-privacy.md`, `SECURITY.md`
