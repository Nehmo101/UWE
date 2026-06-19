# API Route Patterns

## Error responses

Return consistent JSON — avoid leaking stack traces in production:

```typescript
return NextResponse.json({ error: "Not found" }, { status: 404 });
return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

Let services throw or return `{ ok: false, error }` — routes translate to HTTP.

## Upload routes

- Validate MIME via `@uwe/assets`
- Enforce size limits from ENV or existing constants
- Store via asset repository — never write arbitrary paths from user input
- Default new campaign assets to `dm_only` unless explicitly player-safe

## Long-running work

Do not block HTTP for minutes. Enqueue via `job-service.ts`:

1. Create `Job` row (`pending`)
2. Return `202` with `jobId`
3. Worker/cron completes and updates status

AI deferred prompts follow the same pattern when RTX is offline.

## Health endpoints

- `GET /api/health/public` — minimal, no secrets
- Detailed health — Studio admin only, behind auth

## Mutation guards

For Studio POST/PUT/DELETE from non-API contexts, use `guardStudioMutation()` from `@uwe/security` in Server Actions.
