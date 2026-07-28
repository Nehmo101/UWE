# Portal security model

Portal access is decided **server-side** in `packages/auth` and `packages/database`.
The Portal Next.js routes are thin; never trust the client.

## Surfaces

| Surface | Auth | Gate |
|---------|------|------|
| `/auth/worlds/*` | Session required | `portal` checkbox **and** a `WorldMembership` for that world |
| Portal API | Route policy + runtime `requirePortalApiAuth` | Same as the viewer context |

Anonymous access is gone: there is no guest mode, no `/worlds/*` public tree and
no share links. Every Portal route needs a session.

## The one content rule

`canViewWorldContent` in `packages/auth/src/permissions.ts`:

> Whoever is assigned to a world sees everything in it.

No `dm_only`, no `player_visible`, no publish status, no per-page grant, no
session unlock. The Studio checkbox reaches every world without an assignment —
that is how DM preview works.

**The world boundary is the whole gate.** `scopeFromAccessContext` only carries
a membership over when it belongs to that world; without it a member of world A
could read world B.

## Session recaps

`GameSession` has DM prep fields (`summaryDm`, `notes`) and player recap fields (`summaryPlayer`, `playerDecisions`, `openPlots`).

- Portal **never** returns `summaryDm` or `notes`.
- Player recap fields are included only when `recapPublished === true`.
- Linked pages in recaps are filtered with the same rules as wiki pages.

Linked pages need no unlocking — a world member already reads every page.

## Player notes

Statuses: `draft` → `visible_to_dm` → `accepted` / `hidden` / `deleted`.

- Players create and edit own notes while `draft` or `visible_to_dm`.
- DM reviews in Studio (`/worlds/[slug]/notes`): accept, adopt, hide, delete.
- Party sees `accepted` + `visibility: party` only.

## Player characters

Players may edit `player_text` / `rich_text` blocks on `player_character` pages
in a world they are assigned to (`canEditPlayerCharacterBlock`). Page metadata
stays with the DM, and someone holding the Studio checkbox edits through Studio,
not through the sheet.

## Dashboard

`AuthService.getPortalDashboard()` aggregates quests, NPCs, places, handouts, sessions, and notes — all sourced from `listPagesForViewer` / `listGameSessionsForViewer` / `listPlayerNotesForViewer`.

## Tests

```bash
pnpm --filter @uwe/database test -- portal-dashboard.test.ts game-session.test.ts authz-integration.test.ts
pnpm --filter @uwe/auth test -- player-character-permissions.test.ts
pnpm --filter @uwe/portal test -- world-access.test.ts
pnpm test:security
```

## Related docs

- `docs/engineering/access-model.md` — the four checkboxes and the world boundary
- `docs/auth-api-security.md` — API guards and CSRF
- `.cursor/skills/auth-access/SKILL.md` — implementation and review guide
- `.cursor/skills/security-audit/SKILL.md` — audit workflow
