---
name: portal-player-view
description: Build and review UWE Portal player-facing pages, middleware, and APIs with strict dm_only filtering and publish rules. Use when changing Portal routes, share links, player auth, or static export parity.
---

# UWE Portal / Player View

## Portal role

Portal is **read-only player output**. It renders published, visibility-filtered content — never DM secrets.

| Path pattern | Auth | Content |
|--------------|------|---------|
| `/worlds/[slug]/**` | Optional — public pages without login | `player_visible` + `public`, published |
| `/auth/worlds/**` | Session required | Role-scoped player content |
| `/api/share/[token]/**` | Share token | Token-scoped subset |

## Mandatory filters

Use repository/service methods with **Portal context**:

- `getPublicPageForPortal`, `filterPagesForContext`
- `filterAssetsForContext`
- `isPublishedForPortal`, `PORTAL_PAGE_VISIBILITIES`

Source: `packages/database/src/permissions.ts`, `repository.ts`.

## Middleware

`apps/portal/middleware.ts` — session cookies, auth redirects. Changes here affect all player routes — run security tests.

## Parity with static export

Static export (`pnpm export:static`) must apply the **same** visibility rules as live Portal. If you change Portal filters, verify export path in `packages/static-export/`.

## Share links

- Tokens regenerated on backup restore
- Asset/file routes validate token before streaming
- No directory listing of dm_only assets

## Studio preview

Preview-as-player in Studio must call the same filter functions — not a duplicate permissive query.

## Tests

```bash
pnpm test:leaks
pnpm test:security
pnpm --filter @uwe/security-tests test:leaks
```

Add cases when introducing new Portal API routes or block types.

## Checklist

- [ ] No `dm_only` in HTML/JSON for anonymous requests
- [ ] Unpublished pages return 404 (not empty shell with title leak)
- [ ] Player role cannot access Studio admin APIs
- [ ] Asset URLs require auth or valid share token
- [ ] Error messages do not reveal existence of secret pages

## Related

- Skill: `auth-rbac-visibility`
- Skill: `dnd-content-consistency-check`
- Docs: `docs/ARCHITECTURE.md` (visibility flow diagram)

Details: [references/portal-routes.md](references/portal-routes.md)
