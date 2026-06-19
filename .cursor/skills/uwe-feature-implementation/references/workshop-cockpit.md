# Workshop Hobby Cockpit

Patterns for the UWE Studio Werkstatt module (Daily Admin OS).

## Data model

| Entity | Location | Purpose |
|--------|----------|---------|
| `WorkshopProject` | `packages/database/prisma/schema.prisma` | Main project — materials, colors, filaments, links, photos, cost, next action |
| `WorkshopPaintRecipe` | same | Reusable paint steps (primer → highlights) |
| `WorkshopPrintProfile` | same | 3D print run history (printer, nozzle, filament, result) |
| `WorkshopTerrainRental` | same | Optional terrain lending inventory |

JSON fields on `WorkshopProject` use typed helpers in `packages/database/src/workshop-types.ts`. Form parsing lives in `workshop-form-utils.ts`.

## App boundaries

- **Domain / CRUD:** `LifeAdminService` in `packages/database/src/life-admin-service.ts`
- **Server actions:** `apps/studio/app/workshop-actions.ts`
- **UI:** `apps/studio/app/workshop/**` (list, `[id]` detail, recipes, print-profiles, rental)

## Capture → Workshop

`promoteCaptureToWorkshop()` creates a project, links `capture → workshop_project` via `AdminEntityLink`, and marks capture `linked`. UI: **→ Werkstatt** on Capture cards (`art_miniature_terrain`, `file_image`, `project_idea`).

## Today integration

`getTodaySummary()` exposes `workshopOpenTasks` — active projects with non-empty `nextAction`. `/today` prefers tasks over generic status.

## Form line formats

| Field | Format (one per line) |
|-------|------------------------|
| Materials | `Name \| Menge \| ja/nein` |
| Colors | `Marke: Name (Code)` |
| Filaments | `Material \| Marke \| Farbe \| Spule` |
| Links | `Label \| URL \| stl/shop/reference` |
| Photos | `URL \| Beschriftung` |
| Checklist | `[x] Item` or `[ ] Item` |

## Quality

After schema changes: `pnpm --filter @uwe/database db:generate` then `pnpm quality`.

Tests: `workshop-types.test.ts`, workshop cases in `life-admin-service.test.ts`.
