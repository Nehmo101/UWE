# Portal Route Inventory

## High-traffic routes

| Route | Filter |
|-------|--------|
| World home / page by slug | `getPublicPageForPortal` |
| `/api/assets/[assetId]/file` | Visibility + membership |
| `/api/share/[token]/...` | Token scope |
| Search (if enabled) | Player-safe index only |

## When adding routes

1. Copy pattern from nearest existing Portal API route
2. Use `@uwe/database/server` — server only
3. Register in leak scanner fixtures if new surface area
4. Manual QA: anonymous curl + authenticated player session

## Static export

Export CLI reads same repositories — if Portal filter changes, update:

- `packages/static-export/src/**`
- `scripts/security-leaks.test.ts` fixtures if applicable
