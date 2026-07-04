---
name: uwe-security-invariants
description: UWE security and privacy invariants — content visibility (dm_only never reaches the Portal), RBAC, player-safe filtering, and local-first AI privacy. Use when touching auth, sessions, Portal/export output, permissions, AI provider routing, or brain context.
---

# UWE Security & Privacy Invariants

Non-negotiable rules. When a change touches any of these, verify the invariant and the guarding test.

## Content visibility

| Value | Studio | Portal (published) | Static export |
|-------|--------|--------------------|---------------|
| `dm_only` | Yes | **Never** | **Never** |
| `player_visible` | Yes | Yes (if published) | If published |
| `public` | Yes | Yes | Yes |

- Filtering is centralized in **`packages/database/src/permissions.ts`** — filter there, not ad-hoc in routes/components.
- Respect `PublishStatus` / `CanonicalStatus`: unpublished pages never reach the Portal.
- Guarding tests: `scripts/studio-route-auth.test.ts`, `scripts/security-leaks.test.ts`, `packages/security-tests/`.

## Auth imports

Import session symbols from `@uwe/auth` (`SESSION_COOKIE_NAME` from `session`, **not** `runtime-config`) — see the table in `AGENTS.md`.

## Local-first AI privacy

- **`personal_brain` (Life Brain) is hard local-only — never to cloud, not configurable.** `LOCAL_ONLY_CONTEXT_MODES = ["personal_brain"]`.
- DnD `brain` / `current_object` modes may use cloud when admin policy allows (W0 default: cloud allowed, RTX preferred).
- Validation lives in `packages/ai-brain/src/router/` (`validateProviderContextCombination`, `validateResolvedRouteForContext`).
- RTX/Ollama/LM Studio = LAN only, never behind Cloudflare Tunnel or public DNS.
- AI never writes canon without explicit DM Apply.

## CSP

CSP is environment-aware (`packages/auth/src/security-headers.ts`): dev adds `'unsafe-eval'`, production stays strict. **Do not weaken the production CSP without security review** (`.cursor/rules/security.mdc`).

Depth: `.cursor/skills/auth-rbac-visibility/SKILL.md`, `.cursor/skills/local-first-privacy/SKILL.md`, `SECURITY.md`.
