---
name: auth-rbac-visibility
description: Implement and review UWE authentication, RBAC roles, content visibility, and player-safe filtering. Use when changing login, permissions, Portal access, share links, or dm_only/player_visible/public rules.
---

# UWE Auth, RBAC & Visibility

## Auth surfaces

| App | Mechanism | Production |
|-----|-----------|------------|
| Studio | Session cookie, `/login`, `/setup`, 2FA optional | `AUTH_REQUIRED=true` |
| Portal | Session cookie, role matrix | Per-world membership |
| Studio API | `requireStudioApiAuth` + optional `STUDIO_API_TOKEN` | Cloudflare Access recommended |

Import session symbols from `@uwe/auth` — see `AGENTS.md` for import table (`SESSION_COOKIE_NAME` from `session`, not `runtime-config`).

## Roles (Portal / world scope)

| Role | Typical access |
|------|----------------|
| `owner` / `admin` | Full Studio + world admin |
| `dm` | Studio write, campaign management |
| `player` | Portal authenticated content |
| `guest` / `readonly` | Limited or preview |

Studio session roles gate admin paths (`/admin/**`, agent jobs, backups).

## Visibility enums

| Value | Studio | Portal (published) | Static export |
|-------|--------|-------------------|---------------|
| `dm_only` | Yes | **Never** | **Never** |
| `player_visible` | Yes | Yes (if published) | If published |
| `public` | Yes | Yes | Yes |

Also respect `PublishStatus` and `CanonicalStatus` — unpublished pages stay out of Portal.

## Filtering (mandatory)

Implement in `packages/database/src/permissions.ts` and repository methods:

- `filterPagesForContext`
- `filterAssetsForContext`
- `isPlayerExposableContent`

Portal route handlers and Server Components must use filtered queries — **never** fetch DM page and hide in CSS.

## Share links

- Token-based, regeneratable on restore
- Scoped to allowed pages/assets — run leak tests after changes

## Security tests

```bash
pnpm test:security
pnpm test:auth
pnpm test:authz
pnpm test:leaks
```

## Checklist

1. Visibility enforced in service/repository layer
2. New Studio API route has auth guard or documented public exception
3. No `dm_only` in Portal JSON/HTML for anonymous users
4. Password reset / login rate limits preserved
5. No secrets in logs or client bundles

## Related

- Skill: `security-audit` — full audit workflow
- Skill: `portal-player-view`
- Docs: `docs/auth-api-security.md`, `docs/SECURITY_QA_MATRIX.md`

Details: [references/visibility-matrix.md](references/visibility-matrix.md)
