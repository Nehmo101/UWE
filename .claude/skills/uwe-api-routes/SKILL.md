---
name: uwe-api-routes
description: Add or review UWE Next.js API routes — Studio/Portal auth guards, CSRF, server-only imports, and structured error shapes. Use when creating or changing REST endpoints, upload handlers, health checks, or webhook callbacks under apps/*/app/api/**.
---

# UWE API Routes

Route handlers stay thin — call a service from `packages/`, don't put business logic here.

| App | Path | Auth |
|-----|------|------|
| Studio | `apps/studio/app/api/**/route.ts` | `requireStudioApiAuth(request)` on protected routes |
| Portal | `apps/portal/app/api/**/route.ts` | Session middleware + repository visibility filters |

Studio route shape:

```typescript
import { NextResponse } from "next/server";
import { requireStudioApiAuth } from "@/lib/studio-api-auth";
import { createSomeService } from "@uwe/database/server";

export async function GET(request: Request) {
  const auth = await requireStudioApiAuth(request);
  if (!auth.ok) return auth.response;
  const data = await createSomeService().list(/* ... */);
  return NextResponse.json(data);
}
```

Rules:
- Public (no-session) Studio routes are an explicit allowlist (health, Spotify OAuth callback)
  verified by `scripts/studio-route-auth.test.ts` — adding a public route means updating that test.
- Never import server-only modules into client components (breaks the Studio production build).
- HTML sanitization: never top-level-import `isomorphic-dompurify`/`jsdom` — lazy-init + `serverExternalPackages`.
- Portal responses must go through visibility filtering — never return `dm_only` content.
- Validate input, return structured errors; enforce CSRF/rate-limits on sensitive endpoints.

Depth: `.cursor/skills/api-routes/SKILL.md` (+ `references/route-patterns.md`).
