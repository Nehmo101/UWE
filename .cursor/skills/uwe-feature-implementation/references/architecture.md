# UWE Architecture Reference

## Monorepo layout

```
apps/
  studio/     # DM app — port 3000, session login (owner/admin/dm)
  portal/     # Player wiki — port 3001, session auth + role matrix
packages/
  database/   # Prisma, repositories, domain services
  ai-brain/   # KI router, DnD generator, brain retrieval
  auth/       # Sessions, permissions, route policy, headers
  assets/     # Upload paths, storage keys, validation
  backup/     # Backup/restore CLI
  mail/       # SMTP compose
  security-tests/  # Authz + leak scanner
  shared-ui/  # AppShell, MobileBottomNav
  wiki-engine/
  soundboard/
  static-export/
tools/
  uwe-engine-agent/       # Local inference worker
  windows-installer/   # Windows one-click setup
```

## Where to put new code

| Layer | Location | Examples |
|-------|----------|----------|
| DB schema | `packages/database/prisma/schema.prisma` | New models, enums |
| Business logic | `packages/database/src/*-service.ts` | CRUD, validation |
| Feature package | `packages/<feature>/src/` | ai-brain, mail, calendar |
| Studio API | `apps/studio/app/api/**/route.ts` | REST endpoints |
| Studio UI | `apps/studio/app/**/page.tsx` | Pages, layouts |
| Server Actions | `apps/studio/app/*-actions.ts` | Form mutations |
| Portal API/UI | `apps/portal/app/**` | Player-facing |
| Shared UI | `packages/shared-ui/src/` | Cross-app components |

## Key patterns

### Server Actions vs API routes

- **Server Actions** — Studio forms, same-origin mutations with CSRF
- **API routes** — file uploads, external callbacks, health checks, Portal JSON

### Auth guards

```typescript
// Studio API (typical)
import { requireStudioApiAuth } from "@/lib/studio-api-auth";
await requireStudioApiAuth(request);

// Portal — session via middleware + repository filters
```

### Visibility filtering

Always filter in repository/service layer:

- `filterPagesForContext`, `filterAssetsForContext` in `packages/database/src/permissions.ts`
- Portal context: never return `dm_only` to anonymous/guest

### AI / Brain features

1. Define task in `packages/ai-brain/src/tasks.ts` or action in `actions.ts`
2. Route through AI router with privacy guards
3. Save proposal — DM reviews in UI, explicit Apply
4. Player-safe tasks: `resolveServerAllowDmOnly() === false`

### Job queue

Long-running work → `Job` model via `packages/database/src/job-service.ts`. Status: `pending`, `running`, `completed`, `failed`, `cancelled`.

## Package scripts (root)

```bash
pnpm dev              # both apps via turbo
pnpm dev:studio       # :3000
pnpm dev:portal       # :3001
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # demo data (dev only)
pnpm build:release    # db:generate + turbo build
```

## Implementation packages order


```txt
Repo analysis → Production baseline → Cloudflare/Auth → Feature modules → Tests/Hardening
```

For large features, ship in small PRs — one package at a time.

## Testing

- Co-locate tests: `packages/database/src/foo.test.ts`
- Security: `packages/security-tests/`
- Integration smoke: `scripts/integration-smoke.test.ts`
- Use `@uwe/database/test-helpers` for DB fixtures

## Do not

- Put domain logic directly in React components
- Send campaign/brain context to cloud AI
- Hardcode Terra/demo world in product logic (seed only)
- Expose Maschinenraum/Ollama via Cloudflare Tunnel

## Related docs

- `docs/ARCHITECTURE.md` — full module map
- `docs/dnd-generator-upgrade.md` — AI workflow
