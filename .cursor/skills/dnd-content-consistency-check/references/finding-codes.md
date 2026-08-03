# UWE Inspector Finding Codes

Source: `packages/database/src/world-inspector.ts`

## Safety findings (Portal exposure)

| Code | Severity | Meaning |
|------|----------|---------|
| `gm_note_player_visible` | critical | GM note block visible to players |
| `secret_page_portal_visible` | critical | Secret/unlock page exposed on Portal |
| `share_link_unprotected` | critical/warning | Share link without password or expired |
| `hidden_link_in_portal_page` | warning | Player page links to hidden/dm_only target |

## Canon / quality findings

| Code | Severity | Meaning |
|------|----------|---------|
| `broken_wiki_link` | warning | Wikilink target does not resolve |
| `duplicate_name` | warning | Multiple pages share title/alias |
| `contradictory_page` | warning | Conflicting canon pages detected |
| `visible_but_unpublished` | warning | Player-visible but still draft |
| `published_but_dm_only` | info | Published page marked dm_only |
| `orphan_page` | info | No inbound wikilinks |
| `uncategorized_page` | info | Page not assigned to a campaign |

## Fix actions (Inspector UI)

From `inspector-fix-service.ts`:

- `set_block_dm_only`
- `set_page_dm_only`
- `publish_page`
- `set_page_player_visible`
- `remove_broken_wiki_link`
- `assign_page_campaign`

## Visibility model

| Field | Values | Player impact |
|-------|--------|---------------|
| `visibility` | `public`, `player_visible`, `dm_only`, `unlock_after_session` | Core access gate |
| `publishStatus` | `draft`, `published` | Draft never on Portal |
| `canonicalStatus` | `canon`, `idea`, `non_canon` | Lore quality, not access |
| `secret_level` / `reveal_state` | normalized secret system | Session-gated reveals |

## AI / DnD Generator checklist

After generator Apply:

- [ ] Player handouts: run `validatePlayerRecapContent()` patterns — no DM-only phrases
- [ ] NPC/location ideas: `canonicalStatus: idea`, not canon
- [ ] Dungeon room fills: GM notes as `dm_only` blocks
- [ ] Canon check output: review findings before merging into canon pages

## Automated tests

| Test | File |
|------|------|
| Portal visibility | `packages/database/src/visibility-security.test.ts` |
| Player recap | `packages/ai-brain/src/ai-brain.test.ts` |
| Cloud privacy | `packages/ai-brain/src/privacy.test.ts` |
| Public leak scanner | `packages/security-tests/src/public-leak-scanner.ts` |

## Manual smoke (with Maschinenraum or `AI_USE_MOCK=true`)

See `docs/dnd-generator-upgrade.md` — NPC, handout, canon check, Apply/Discard flows.

## Multi-world

- Inspector runs **per world** — repeat for each active campaign world
- Terra seed is demo only; do not treat as production canon
