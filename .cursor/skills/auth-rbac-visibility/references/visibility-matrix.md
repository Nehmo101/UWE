# Visibility Matrix

## Content types

| Type | Default visibility | Portal rule |
|------|-------------------|-------------|
| Wiki pages | Often `player_visible` when published | Filter by visibility + publish status |
| Content blocks | Per-block visibility | Block-level filter in render pipeline |
| Assets / handouts | Often `dm_only` until released | `filterAssetsForContext` |
| Brain documents (DnD) | Studio-only | Never Portal |
| Personal brain | Studio-only, local AI only | Never Portal |
| AI generator output | `idea` / `draft` / `dm_only` until Apply | Never auto-publish |

## Context modes (rendering)

Repository methods accept a **context** (studio DM, portal player, static export). The same page ID may return different block sets per context.

When adding a new content type, define:

1. Prisma `visibility` field (or explicit studio-only flag)
2. Filter function in `permissions.ts`
3. Leak test case in `packages/security-tests/`

## Preview-as-player

Studio preview must use Portal-equivalent filters — not a separate permissive code path.
