---
name: uwe-architecture
description: Where to place new UWE code — Studio vs Portal, package boundaries, and the anti-monolith module discipline. Use when planning a feature, deciding which package a change belongs in, or reviewing placement.
---

# UWE Architecture (placement guide)

Thin Next.js apps, fat shared packages. **Golden rule: business logic lives in `packages/`, never in route handlers or React components.**

| Surface | Location | Role |
|---------|----------|------|
| Studio | `apps/studio` (:3000) | DM write/admin |
| Portal | `apps/portal` (:3001) | Player read-only, server-filtered |
| Export | `packages/static-export` | Static HTML, published content only |

Where new code goes:

```
Schema change   → packages/database/prisma/schema.prisma + migration
Domain logic    → packages/database/src/*-service.ts OR a feature package (packages/<domain>)
Studio API      → apps/studio/app/api/**/route.ts
Studio UI       → apps/studio/app/**/page.tsx
Server Actions  → apps/studio/app/*-actions.ts
Shared UI       → packages/shared-ui/src/
```

Hard rules:
- **Never cross-app import** (`apps/studio` must not import `apps/portal`, and vice versa).
- **New domain services go into a feature package, not `packages/database`.** `@uwe/database`
  stays data-access + existing core services. Do not grow the `server.ts` barrel — export new
  symbols via subpath exports.
- **Module discipline:** new files max 700 lines (target < 300). Split into modules/packages
  instead of growing a file. Legacy files in `scripts/file-size-baseline.json` are frozen —
  extract code, never raise a baseline value.

Depth: `.cursor/skills/uwe-architecture/SKILL.md`, service map `docs/engineering/database-service-map.md`, `CLAUDE.md`.
