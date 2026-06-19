# Roles & Review Workflow

UWE separates **global roles** (system-wide) from **world membership roles** (per campaign world). Collaborative edits flow through a unified **review queue** so canon, security, and private data stay protected.

## Global roles

| Role | Capabilities |
|------|----------------|
| **owner** | Full access: security, restore, users, API tokens, canon |
| **admin** | System, users, calendar, backups — **not** direct DnD canon edits |
| **dm** | Studio, worlds, sessions, handouts, players, AI, canon |
| **player** | Own player notes / character fields (via Portal) |
| **readonly** | Read-only world access where granted |
| **guest** | Minimal guest-mode access |

Capability checks live in `packages/auth/src/role-capabilities.ts`.

## World membership roles

| Role | Read | Direct edit | Proposals |
|------|------|-------------|-----------|
| **owner** | ✓ | ✓ | optional |
| **dm** | ✓ | ✓ | optional |
| **co_dm** | ✓ (staff) | ✗ | required |
| **player** | player-visible | own notes only | — |

Co-DMs see `dm_only` content (`isWorldStaff`) but cannot publish or change visibility (`canEditContent` is false). They submit **Co-DM change proposals** instead.

## Unified review queue

`ContentReview` aggregates pending items from:

| Source | Trigger |
|--------|---------|
| `ai_proposal` | AI run completes (`AiReviewService`) |
| `player_note` | Player submits note to DM |
| `co_dm_change` | Co-DM proposes page/block edit |
| `portal_unlock` | Session unlock request for `unlock_after_session` pages |

### Review actions

1. **Create** — proposal enters queue (`review_submitted` activity)
2. **Preview** — diff/payload in Admin → Reviews UI
3. **Comment** — `ReviewComment` + `review_commented` activity
4. **Approve** — `resolveReview()` applies underlying change + `review_approved`
5. **Reject** — status + optional reason + `review_rejected`

Service: `packages/database/src/review-service.ts`  
Resolver: `packages/database/src/review-bridge.ts`

## Admin UI

Studio → **Admin → Reviews** (`/admin/reviews`)

API:

- `GET /api/admin/reviews` — list + pending count
- `GET /api/admin/reviews/[id]` — detail + comments
- `POST /api/admin/reviews/[id]` — `approve` | `reject` | `comment`

## Activity log

New actions: `review_submitted`, `review_approved`, `review_rejected`, `review_commented`  
Target type: `content_review`

## Tests

- `packages/auth/src/role-capabilities.test.ts` — capability matrix
- `packages/database/src/review-workflow.test.ts` — review flow + co_dm read/edit

## Security notes

- Only `review_approve` roles (owner, admin, dm, world owner/dm) should approve reviews.
- Admin cannot bypass canon restrictions via `canEditWorld` — world edits require DM role or world DM membership.
- Studio `studioTrusted` scope still grants DM-equivalent access on the home network; per-user accountability uses world membership when trust is disabled.
