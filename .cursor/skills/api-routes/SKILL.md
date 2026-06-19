---
name: api-routes
description: Add or review UWE Next.js API routes in Studio and Portal — auth guards, CSRF, rate limits, error shapes, and server-only imports. Use when creating REST endpoints, upload handlers, health checks, or webhook callbacks.
---

# UWE API Routes

## Studio vs Portal

| App | Path | Auth pattern |
|-----|------|--------------|
| Studio | `apps/studio/app/api/**/route.ts` | `requireStudioApiAuth(request)` for protected routes |
| Portal | `apps/portal/app/api/**/route.ts` | Session middleware + repository visibility filters |

Studio public allowlist (no session): health, Spotify OAuth callback — verify in `scripts/studio-route-auth.test.ts`.

## Studio route template

```typescript
import { NextResponse } from "next/server";
import { requireStudioApiAuth } from "@/lib/studio-api-auth";
import { createSomeService } from "@uwe/database/server";

export async function GET(request: Request) {
  const auth = await requireStudioApiAuth(request);
  if (!auth.ok) return auth.response;

  const service = createSomeService();
  const data = await service.list(/* ... */);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireStudioApiAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  // validate, call service, return structured errors
}
```

Guards re-export from `@uwe/security` via `apps/studio/src/lib/studio-api-auth.ts`.

## Server Actions vs API routes

| Use Server Actions | Use API routes |
|--------------------|----------------|
| Studio form mutations (same-origin) | Multipart file uploads |
| Colocated with `page.tsx` | External OAuth callbacks |
| CSRF via Next.js action pattern | Health/status JSON |
| | Download/export streams |

Domain logic stays in `packages/` for both.

## Portal safety

- Every read path must apply visibility filters (`filterPagesForContext`, `filterAssetsForContext`).
- Share-link routes: token validation before asset/page delivery.
- Never return `dm_only` fields in JSON for guest/anonymous contexts.

## Checklist for new routes

1. Guard applied (Studio) or visibility filter (Portal)
2. Input validation — Zod or existing service validators
3. Structured error responses (`{ error: string }`, correct HTTP status)
4. No secrets in logs or error messages
5. Rate limit on sensitive endpoints (login, reset, AI inference) if applicable
6. Add route to `scripts/studio-route-auth.test.ts` inventory when Studio route is new

## Tests

```bash
pnpm test:security          # route authz + leak scanner
node --import tsx --test scripts/studio-route-auth.test.ts
```

## Related

- Skill: `auth-rbac-visibility`
- Skill: `portal-player-view`
- Docs: `docs/auth-api-security.md`

Details: [references/route-patterns.md](references/route-patterns.md)
