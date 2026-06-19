# Package Boundaries

## Apps must stay thin

**Good:** Route handler calls `createLabelService()` from `@uwe/database/server`, returns JSON.

**Bad:** Route handler contains Prisma queries, validation rules, and PDF generation inline.

## Feature package vs database service

| Situation | Location |
|-----------|----------|
| CRUD tied to Prisma models used across Studio | `packages/database/src/*-service.ts` |
| Standalone integration (Spotify, SMTP, iCal) | `packages/<feature>/src/` |
| AI routing / provider selection | `packages/ai-brain/src/` |
| Security guards reused by apps | `packages/security/src/` |

## Daily Admin OS

Life Admin models and services live in `@uwe/database` (`life-admin-service.ts`). UI in `apps/studio/app/admin/**` and related routes. Do **not** add family/meal/cat modules — see `docs/daily-admin-os.md`.

## Testing placement

- Co-locate: `packages/database/src/foo.test.ts`
- Security: `packages/security-tests/`, `scripts/studio-route-auth.test.ts`
- E2E: repo root `e2e/` (Playwright)

## Anti-patterns

- Importing `node:crypto`, Prisma, or filesystem APIs in client components
- Duplicating visibility checks only in React — always mirror in service layer
- Sending world/brain context to cloud AI providers
- Exposing RTX/Ollama via Cloudflare Tunnel
