---
name: react-next-ui
description: Build UWE Studio and Portal UI with Next.js 15 App Router, React 19, and shared components. Use when adding pages, forms, layouts, client/server component splits, or extending @uwe/shared-ui.
---

# UWE React / Next.js UI

## Stack

- Next.js 15 App Router, React 19, TypeScript strict
- Styling: existing theme tokens in `@uwe/shared-ui` — match surrounding pages
- Studio: `@uwe/studio` — DM/admin UX
- Portal: `@uwe/portal` — read-focused player wiki

## Server vs client components

**Default to Server Components** for data loading and read-only UI.

Add `"use client"` only when needed:

- Event handlers, `useState`, `useEffect`
- Browser APIs (clipboard, audio playback)
- Interactive widgets (modals, drag-drop editors)

**Never** import in client components:

- `@uwe/database/server`, Prisma, `node:crypto`, filesystem

Pass serializable props from server parents instead.

## File layout

```txt
apps/studio/app/worlds/[worldSlug]/feature/
  page.tsx              # Server Component — load data
  FeatureClient.tsx     # "use client" — interactivity
  loading.tsx           # optional suspense fallback
apps/studio/app/feature-actions.ts   # Server Actions for forms
```

Split large pages (>300 lines) into colocated components — see `LabelEditor.tsx` as a candidate for future split.

## Shared UI

Reuse before inventing:

- `packages/shared-ui/src/` — AppShell, MobileBottomNav, badges, theme
- Studio-local helpers — `apps/studio/src/lib/format.ts` for dates

Extend `@uwe/shared-ui` when **both** apps need the same component.

## Forms and mutations

- Studio forms → Server Actions with CSRF (existing action patterns in `app/*-actions.ts`)
- Optimistic UI only when rollback is trivial — prefer server revalidation
- Show AI proposals as review UI — never auto-apply to canon

## Portal UI rules

- Assume untrusted reader — no hidden DM data in HTML/JSON props
- Preview-as-player mode must match real player visibility
- Minimal client JS — SEO-friendly server render

## Accessibility and i18n

- German UI copy is the project default (`de-DE` date formatting in Studio)
- Use semantic HTML, labels on inputs, focus states from theme
- See `docs/design/theme-a11y-checklist.md` for theme work

## Quality

```bash
pnpm lint        # no-unused-vars strict
pnpm typecheck   # catches client/server import mistakes indirectly
```

## Related

- Rule: `.cursor/rules/coding-standards.mdc`
- Skill: `portal-player-view`
- Skill: `uwe-feature-implementation`
