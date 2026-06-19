---
name: dnd-content-consistency-check
description: Audit UWE DnD world content for canon conflicts, player leaks, broken wikilinks, visibility mismatches, and AI generator safety. Use when reviewing campaign content, before publishing to Portal, after bulk imports, or when validating DnD generator output.
---

# UWE DnD Content Consistency Check

## Two audit layers

1. **Automated Inspector** — `packages/database/src/world-inspector.ts` (read-only, no AI)
2. **AI canon check** — Brain action `canon_check` / task `detect_contradictions` (Review/Apply required)

For brain storage and Life/DnD separation, see skill `uwe-brain`.

## Workflow

1. Run World Inspector for the target world (Studio: `/worlds/[slug]/inspector`).
2. Walk finding codes in [references/finding-codes.md](references/finding-codes.md).
3. For AI-generated content: verify Review/Apply — nothing auto-canonized.
4. Run player-safety tests if visibility rules changed:

```bash
pnpm test:leaks
pnpm --filter @uwe/database test -- visibility-security
```

## Severity handling

| Severity | Action |
|----------|--------|
| **critical** | Fix before Portal publish (GM notes visible, unprotected share) |
| **warning** | Fix soon (broken links, contradictory pages) |
| **info** | Optional cleanup (orphan pages, uncategorized) |

## DnD Generator rules

- Outputs saved as `idea` / `draft` / `dm_only` — **never** auto-canon
- Player-safe tasks (`create_player_handout`, `generate_player_recap`): no GM secrets
- RTX required for campaign context — no cloud fallback

## Output template

```markdown
## World: <slug>
## Safety findings (critical/warning)
- ...

## Canon findings
- ...

## Generator / AI proposals reviewed
- ...

## Recommended fixes
- ...
```

Details: [references/finding-codes.md](references/finding-codes.md)
