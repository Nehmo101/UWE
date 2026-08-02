# Database service map (`@uwe/database`)

Compact index for agents — **import from `@uwe/database/server`** (canonical barrel, ~1540 lines). Do not open `server.ts` for navigation; use this map to find the right service file.

| Domain | Key exports / files |
|--------|---------------------|
| **Core** | `repository.ts`, `app-repository.ts`, `client.ts`, `permissions.ts`, `content-access.ts` |
| **Auth & users** | `auth.ts` (sessions incl. sliding-window inactivity auto-logout via `lastActiveAt`), `user-service.ts`, `two-factor-service.ts`, `api-token-service.ts`, `login-audit.ts`, `owner-setup-service.ts` |
| **Wiki / pages** | `page-service.ts`, `page-template-service.ts`, `page-templates.ts`, `tag-service.ts`, `search-service.ts`, `graph-service.ts` |
| **Worlds & campaigns** | `world-creation-service.ts`, `world-inspector.ts`, `world-overview.ts`, `game-session.ts`, `dungeon-cockpit.ts` |
| **Characters (DnD)** | `character-service.ts` (Sheet + Derived Stats 2024), `character-spell-service.ts` (Slots, Open5e/Homebrew-Zauber), `character-level-up-service.ts`, `character-sheet-export.ts` |
| **Brain (DnD)** | `brain-store-service.ts`, `generator-service.ts`, `research-service.ts` |
| **Life Brain / admin** | `life-admin-service.ts`, `personal-brain-service.ts`, `personal-brain-context.ts`, `personal-brain-search.ts`, `capture-triage-service.ts` |
| **AI gateway** | `ai-gateway-service.ts`, `ai-run-service.ts`, `ai-review-service.ts`, `inference-endpoint-service.ts` |
| **Mail** | `mail-service.ts`, `mail-compose-service.ts`, `mail-portal-service.ts`, `mail-account-service.ts`, `mail-template-service.ts`, `mail-unsubscribe-service.ts` |
| **Calendar** | `calendar-service.ts`, `calendar-aggregation-service.ts` |
| **Labels / print** | `label-service.ts`, `label-print-queue-service.ts`, `label-workshop-service.ts`, `label-export.ts` |
| **Portal / player** | `portal-access-service.ts`, `portal-dashboard-service.ts`, `player-note-service.ts`, `share-link-service.ts` |
| **Security / audit** | `studio-security.ts`, `security-dashboard.ts`, `audit-log-service.ts`, `public-leak-scanner.ts`, `production-safety.ts` |
| **Connector / jobs** | `connector-service.ts`, `connector-workflow-service.ts`, `job-service.ts` |
| **Integrations** | `integrations-service.ts`, `spotify-connection-service.ts`, `soundboard.ts` |
| **Settings / admin** | `settings-service.ts`, `settings-validation.ts`, `admin-status.ts`, `system-status.ts`, `homelab-cockpit.ts` |
| **Assets** | `asset-repository.ts`, `asset-link-service.ts` |
| **Review / undo** | `review-service.ts`, `review-bridge.ts`, `undo-service.ts`, `activity-log-service.ts` |

## Conventions

- New domain logic → `packages/database/src/<domain>-service.ts`, then re-export from `server.ts`.
- Tests colocated: `*-service.test.ts` or `*.test.ts` next to source.
- Prisma schema: `packages/database/prisma/schema.prisma` + migration in `prisma/migrations/`.

## Related packages

| Need | Package |
|------|---------|
| AI router / context | `@uwe/ai-brain` |
| Auth guards / sessions | `@uwe/auth`, `@uwe/security` |
| Upload validation | `@uwe/assets` |
