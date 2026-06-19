---
name: daily-admin-os
description: Implement Daily Admin OS modules in UWE Studio — Today dashboard, Capture inbox, Projects, Workshop, Contracts, Hardware. Use for life-admin features, mobile admin UX, and Studio-only personal data.
---

# Daily Admin OS

## Product boundaries

**In scope:** Today, Capture, Projects, Workshop, Contracts, Hardware, Life Brain (UI shell).

**Out of scope (never build):** Family/kids module, cats, meal planner, household inventory, document vault, decision log, weekly review mode, purchases/warranty tracker.

Source: `docs/prompts/UWE_DAILY_ADMIN_OS_CURSOR_PROMPTS.md`, `docs/daily-admin-os.md`.

## Architecture

| Layer | Location |
|-------|----------|
| Prisma models | `packages/database/prisma/schema.prisma` — `CaptureEntry`, `PersonalProject`, `WorkshopProject`, `ContractExpense`, `HardwareDevice`, `PersonalBrain*` |
| Domain service | `packages/database/src/life-admin-service.ts` |
| Server actions | `apps/studio/app/life-admin-actions.ts`, `capture-actions.ts` |
| UI routes | `apps/studio/app/today`, `capture`, `projects`, `workshop`, `contracts`, `hardware`, `life-brain` |
| Today logic | `apps/studio/src/lib/today-dashboard.ts` |
| Mobile nav | `apps/studio/src/lib/mobile-nav.ts` — Heute · Capture · Suche · KI · Mehr |
| Shell | `apps/studio/components/AdminModuleShell.tsx` |
| Sidebar | `apps/studio/src/lib/admin-sidebar-nav.ts` |

## Implementation rules

1. **Studio only** — Daily Admin data never exposed via Portal or static export.
2. **Capture works without RTX** — quick capture must not depend on GPU inference.
3. **Cross-links** — use `AdminEntityLink` for Capture → Project/Workshop/Image Studio.
4. **Mobile-first** — test bottom nav and FAB (`GlobalCaptureFab.tsx`) on narrow viewports.
5. **No bank APIs** — Contracts are manual tracking only.
6. **Preferred world** — `/today` DnD card: settings → `PREFERRED_WORLD_SLUG` → `terra` → first world (not hardcoded).

## Common tasks

### Today Dashboard 2.0

Extend `getTodaySummary()` in `life-admin-service.ts` and `today-dashboard.ts`:

- Capture inbox count (untriaged)
- Contract alerts (upcoming renewals)
- Workshop active projects
- Calendar events (delegate to calendar service)
- System ampel + RTX status

### Capture 2.0

- Add triage status enum if missing (`new`, `triaged`, `archived`, `converted`)
- `file_image`: wire to `@uwe/assets` upload pipeline
- Conversion actions: → Project, Workshop, Life Brain note

### Workshop

- Status workflow: `planned` → `in_progress` → `printed` → `painted` → `done`
- Optional `worldId` / page link for DnD terrain
- Materials JSON field — keep schema minimal

## Tests

```bash
pnpm --filter @uwe/database test -- life-admin-service
pnpm --filter @uwe/studio test -- today-dashboard
```

## Quality gate

```bash
pnpm quality
```

No `test:security` unless adding API routes with new auth surface.

## Related docs

- `docs/daily-admin-os.md`
- `docs/engineering/product-orchestrator-plan.md` — Subagents 2, 3, 5, 6
