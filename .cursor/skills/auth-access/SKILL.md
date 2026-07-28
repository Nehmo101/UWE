---
name: auth-access
description: Implement and review UWE authentication and the four-checkbox access model. Use when changing login, who may enter Portal/Studio/Brain/Family, world assignment, or route guards.
---

# UWE Auth & Zugänge

## The model in two sentences

The **checkbox** says which app: `portal`, `studio`, `brain`, `family` — four
booleans per e-mail address, set by the owner in the Command Center. The
**world assignment** (`WorldMembership`) says which world. Nothing else gates
access.

`isOwner` is not an area: it governs operations (restore, host control,
`/admin/*`) only. The first account created at setup gets the owner flag and all
four checkboxes.

There is **no** role enum, **no** capability matrix, **no** per-item visibility,
**no** guest mode, **no** share links, and **no** self-registration. If you find
yourself reintroducing any of them, that is the bug (Notiz Lasse, 2026-07-26).

## Auth surfaces

| App | Mechanism | Gate |
|-----|-----------|------|
| Studio | Session cookie, `/login`, `/setup`, 2FA optional | `studio` checkbox; `/admin/**` needs `isOwner` |
| Portal | Session cookie | `portal` checkbox **and** a world assignment |
| Brain | Session cookie | `brain` checkbox (`canEnterBrain`) |
| Studio API | `requireStudioApiAuth` + optional `STUDIO_API_TOKEN` | `getRequiredAccessForApiPath` |

Import session symbols from `@uwe/auth` — see `AGENTS.md` for the import table
(`SESSION_COOKIE_NAME` from `session`, not `runtime-config`).

## Where the rules live

| Question | Answer in code |
|---|---|
| May this address open this app? | `packages/auth/src/area-access.ts` — `canAccessPortal/Studio/Brain/Family` |
| May this session reach this Studio route? | `getRequiredAccessForApiPath` / `getRequiredAccessForPagePath` + `satisfiesStudioRouteAccess` |
| May this context read this world's content? | `packages/auth/src/permissions.ts` — `canViewWorldContent` |
| May this user read *that* world? | `packages/auth/src/security/authz.ts` — `canReadWorld`, `scopeFromAccessContext` |

**`scopeFromAccessContext` is load-bearing.** It only carries a membership over
when the membership belongs to that world. Without that check, a member of world
A can read world B — the world boundary is the only content rule left.

## Content rule

> Whoever is assigned to a world sees everything in it.

Portal route handlers and Server Components go through
`filterPagesForViewer` / `filterBlocksForViewer` / `filterAssetsForViewer`.
They return everything or nothing — that is the whole filter now.

## Security tests

```bash
pnpm test:security
```

## Checklist

1. New Studio API route has an auth guard or a documented public exception
2. World-scoped reads build their scope with `scopeFromAccessContext`, never by hand
3. An anonymous visitor gets nothing — no route may fall back to a public read
4. Password reset / login rate limits preserved
5. No secrets in logs or client bundles

## Related

- Skill: `security-audit` — full audit workflow
- Skill: `portal-player-view`
- Docs: `SECURITY.md`, `docs/SECURITY_QA_MATRIX.md`
