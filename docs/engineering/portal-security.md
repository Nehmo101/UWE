# Portal security model

Player-facing content in UWE Portal is filtered **server-side** in `packages/database` and `packages/auth`. The Portal Next.js routes are thin; never trust client-side visibility alone.

## Surfaces

| Surface | Auth | Visibility layer |
|---------|------|------------------|
| `/worlds/*` | Optional session; guest mode when enabled | Static `portal` context + per-user `AccessContext` when logged in |
| `/auth/worlds/*` | Session required (production) | Per-user `AccessContext` only |
| `/share/[token]` | Share grant + optional password | Share-scoped pages/assets |
| Portal API | Route policy + runtime `requirePortalApiAuth` | Same as viewer context |

## Visibility rules (authenticated players)

Handled by `canViewPage`, `canViewContentBlock`, and `canViewAsset` in `packages/auth/src/permissions.ts`:

| Visibility | Player sees when |
|------------|------------------|
| `dm_only` | Never (including preview-as-player) |
| `player_visible` | Published + role player + secret revealed |
| `public` | Published (+ guest if guest mode) |
| `specific_players` | `pageId` in `PagePlayerAccess` for user |
| `unlock_after_session` | `pageId` in `SessionUnlock` for user |
| Unpublished | DM/owner only |

## Session recaps

`GameSession` has DM prep fields (`summaryDm`, `notes`) and player recap fields (`summaryPlayer`, `playerDecisions`, `openPlots`).

- Portal **never** returns `summaryDm` or `notes`.
- Player recap fields are included only when `recapPublished === true`.
- Linked pages in recaps are filtered with the same rules as wiki pages.

Publishing a recap (`publishRecap`) auto-unlocks linked pages with `visibility: unlock_after_session` for all world players.

## Player notes

Statuses: `draft` → `visible_to_dm` → `accepted` / `hidden` / `deleted`.

- Players create and edit own notes while `draft` or `visible_to_dm`.
- DM reviews in Studio (`/worlds/[slug]/notes`): accept, adopt, hide, delete.
- Party sees `accepted` + `visibility: party` only.

## Player characters

Players may edit `player_visible` `player_text` / `rich_text` blocks on `player_character` pages they can view (`canEditPlayerCharacterBlock`). Page metadata, visibility, and `dm_only` blocks remain DM-only.

## Dashboard

`AuthService.getPortalDashboard()` aggregates quests, NPCs, places, handouts, sessions, and notes — all sourced from `listPagesForViewer` / `listGameSessionsForViewer` / `listPlayerNotesForViewer`.

## Tests

```bash
pnpm --filter @uwe/database test -- portal-dashboard.test.ts game-session.test.ts visibility-security.test.ts
pnpm --filter @uwe/auth test -- player-character-permissions.test.ts
pnpm test:security
```

## Related docs

- `docs/auth-api-security.md` — API guards and CSRF
- `docs/security-testing.md` — leak scanner and role matrix
- `.cursor/skills/security-audit/SKILL.md` — audit workflow
