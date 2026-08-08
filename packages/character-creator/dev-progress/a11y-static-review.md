# Character Creator — static a11y / dark-theme review

**Workstream:** `a11y`  
**Agent:** composer-2.5-fast  
**Date:** 2026-08-08  
**Scope:** `apps/portal/src/components/character-wizard/**` (25 TSX/CSS files)  
**Route:** `/auth/worlds/[worldSlug]/characters/neu`  
**E2E run:** **attempted, not completed** — `pnpm test:e2e:a11y --grep "characters/neu"` failed at server build (`EBUSY` on `apps/studio/.next/standalone` under Windows). Spec is in place; run on CI or Linux host.

---

## Executive summary

Static review of the Character Wizard shows **strong intentional a11y patterns** aligned with `BRIEF.md`: `aria-pressed` tiles, `fieldset`/`legend` or `role="group"`, real `<label htmlFor>`, non-color-only selection affordances (corner wedge + check icon), and `focus-visible` rings in `wizard.css`.

**E2E coverage added (2026-08-08):** `e2e/portal-a11y.spec.ts` now includes the creator route in the axe smoke list, the viewport × hell/dunkel `auditShell` matrix, and the 390 px touch block. Automated proof still requires a Playwright run (`pnpm test:e2e:a11y`).

**Verdict:** Static markup **passes with minor gaps**; overall workstream status **`in_progress`** until e2e passes and real dark-theme capture is verified.

---

## How UWE theme / dark mode works (capture guide)

UWE has **two layers** — do not confuse them when capturing screenshots or running contrast checks.

| Layer | Source | DOM hook | What it controls |
|-------|--------|----------|------------------|
| **Appearance flag** | `settings.app.theme` → `buildVisualThemeHtmlAttributes()` | `data-theme`, `data-uwe-appearance` on `<html>` | `dark` / `light` / `system` — `color-scheme`, a11y CSS hooks, `ThemeDocumentSync` |
| **Visual preset (palette)** | `settings.app.themePreferences.portal.themeId` + client `localStorage` | `data-uwe-theme` on `<html>` (written by theme engine) | Actual colors — e.g. `uwe-ghibli-tag` (day) vs `uwe-ghibli-nacht` (night) |

Portal layout (`apps/portal/app/layout.tsx`):

```tsx
const visualThemeAttrs = buildVisualThemeHtmlAttributes(settings.app, { appVariant: "portal" });
// …
<html lang="de" suppressHydrationWarning {...visualThemeAttrs}>
```

`buildVisualThemeHtmlAttributes` (`packages/shared-ui/src/visual-theme.ts`) maps `settings.app.theme` → `data-theme` / `data-uwe-appearance`. The **theme id** (`data-uwe-theme`) is set separately by `ThemeBootstrapScript` + `applyThemePreferences()` from stored preferences.

### Wrong (produces byte-identical “dark” screenshots)

```ts
// Playwright — does NOT switch UWE palette
await page.emulateMedia({ colorScheme: "dark" });
```

### Correct options

1. **E2E helper (matches existing portal a11y spec):**

   ```ts
   import { applyTheme } from "./helpers/shell-audit";
   await applyTheme(page, "dunkel"); // sets data-uwe-theme=uwe-ghibli-nacht
   await applyTheme(page, "hell");   // sets data-uwe-theme=uwe-ghibli-tag
   ```

   Source: `e2e/helpers/shell-audit.ts` — sets `document.documentElement.dataset.uweTheme`, waits 120 ms for CSS vars.

2. **In-browser:** Portal theme picker / hell–dunkel toggle (switches `themeId` between Ghibli Tag ↔ Nacht counterparts per `docs/design/uwe-theme-system.md`).

3. **Server default:** Studio → Einstellungen → Erscheinungsbild → Portal-Standard (`settings.app.themePreferences.portal`).

4. **Verify capture worked:** DevTools → `<html data-uwe-theme="uwe-ghibli-nacht">` and computed `--uwe-fg` / `--uwe-accent-ink` differ from tag variant. Screenshot bytes should **not** match the light run.

### Known dark-token risk (unverified on wizard)

`docs/engineering/character-creator-offene-punkte.md` §1.1 notes the night branch in `tokens-v3.css` may reset `*-ink` tokens and weaken AA contrast on accent text. Wizard uses `--uwe-accent-ink` heavily (`.cw-chip[data-tone="accent"]`, step nav, notes). **Needs contrast measurement in real dark theme**, not `prefers-color-scheme`.

---

## Static findings by category

### ARIA & semantics

| Area | Finding | Severity |
|------|---------|----------|
| Step nav (`CharacterWizard.tsx`) | `nav[aria-label]`, `aria-current="step"`, hash routing | OK |
| Step nav state | Done/skipped indicated only via color/checkmark/`data-state` — **fixed:** `aria-label` now includes state text | Was minor |
| Tiles (all choice steps) | `<button type="button" aria-pressed>` — not div-onClick | OK |
| Custom background | Multiple `<fieldset>` + `<legend>` | OK |
| Details step | Fieldsets for identity, alignment, languages, appearance, motivation | OK |
| Abilities | `aria-labelledby` on method/values/bonus sections | OK |
| Search fields | `label` + `htmlFor` (species, class, skills, spells, backgrounds) | OK |
| Live regions | Budget, skill count, spell slots, custom-bg hints use `aria-live="polite"` / `role="status"` | OK |
| Review create block | `role="alert"` on submit failure | OK |
| Character rail | `aside[aria-label="Dein Charakter"]` | OK |
| Decorative SVG art | `aria-hidden="true" focusable="false"` on species/class art | OK |
| Dice panel | `role="img"` + descriptive `aria-label` per roll | OK |
| Point-buy +/- | `aria-label` per ability (German display names in EN step — known C-05) | OK |

### Labels & form controls

| Area | Finding | Severity |
|------|---------|----------|
| Name field | `required`, `aria-invalid`, `aria-describedby` → error id | OK |
| Background bonus selects | `label` + `htmlFor` on primary/secondary | OK |
| Ability rows | `label htmlFor` or caption span | OK |
| Equipment help toggle | `aria-expanded` on disclosure trigger | OK |
| Alignment grid | **Fixed:** added `role="group" aria-label="Gesinnung wählen"` | Was minor |

### Keyboard

| Area | Finding | Severity |
|------|---------|----------|
| All tiles/filters | Native `<button>` — keyboard activatable | OK |
| Focus rings | `.cw-tile:focus-visible`, `.cw-step:focus-visible`, `.cw-filter:focus-visible` in CSS | OK |
| Step hash nav | `#species` etc. — back button works; no skip-link on wizard itself (inherits portal shell) | OK |
| Locked skill tiles | `aria-disabled` but click still fires (shows explanation via `role="status"`) — intentional UX, slightly ambiguous for AT | Low |
| `details`/`summary` | Equipment pack disclosure — keyboard native | OK |

### Color-only signals

| Signal | Non-color redundant cue? | Notes |
|--------|--------------------------|-------|
| Tile selected | Yes — check icon, corner wedge, border/inset glow | `wizard.css` L283–322 |
| Filter pill active | Yes — `aria-pressed` + filled background | OK |
| Step done | Partial — checkmark in index **was** `aria-hidden`; state now in `aria-label` | Fixed in shell |
| Step current | Underline bar + accent ring on index | OK with `aria-current` |
| `data-tone="accent"` chips | Text content always present | Color is emphasis only |
| `data-tone="blocked"` hints | Text always present; warning color secondary | OK |
| Class complexity | Text label (`Einstieg`/`Mittel`/`Anspruchsvoll`); dots `aria-hidden` | OK pattern |
| Rail boosted ability | **Was color-only** (border/bg) — **fixed:** `title="Hintergrund-Bonus…"` | Was minor |
| Skills locked | “vom Hintergrund” chip + lock icon (decorative in check span) | OK |

### Heading structure

| Level | Element | Location |
|-------|---------|----------|
| `h1` | Page title “Charakter erstellen” | `PageHeader` on route page |
| `h2` | Active step title | `CharacterWizard` `.cw-head__title` |
| `h3` | Section titles within steps | Species, class, abilities, review blocks, etc. |

Matches `BRIEF.md` rule: one `h1` per page, steps start at `h3`.

---

## Fixes applied (this pass)

| File | Change |
|------|--------|
| `CharacterWizard.tsx` | Step buttons: `aria-label` with step index + state; footer validation `role="status"`; decorative footer icons `aria-hidden` |
| `CharacterRail.tsx` | Boosted abilities: `title` tooltip for background bonus |
| `EquipmentStep.tsx` | Validation note: `role="status"`, alert icon `aria-hidden` |
| `DetailsStep.tsx` | Alignment grid: `role="group" aria-label="Gesinnung wählen"` |
| `wizard.css` | Step nav buttons: `min-height: var(--uwe-touch-min)` for shell/touch audit |

---

## Pass / fail checklist

| Check | Static review | E2E / runtime |
|-------|---------------|---------------|
| Choice tiles are buttons with `aria-pressed` | **PASS** | not run |
| Groups use fieldset/legend or `role="group"` + label | **PASS** | not run |
| Text inputs have associated labels | **PASS** | not run |
| Selection not conveyed by color alone | **PASS** (after fixes) | not run |
| Focus visible on interactive controls | **PASS** (CSS present) | not run |
| Single `h1`, logical heading order | **PASS** | not run |
| axe WCAG A/AA zero violations | not run | **PENDING** |
| `auditShell`: no overflow, ≥12px text, touch targets | not run | **PENDING** |
| Dark theme visually distinct from light | not run | **PENDING** (matrix uses `applyTheme`) |
| Dark accent/chip contrast (`*-ink` tokens) | not run | **PENDING** |
| Creator route in `portal-a11y.spec.ts` | **PASS** — added 2026-08-08 | **PENDING** (needs Playwright run) |

---

## Recommended next actions

1. **Run e2e:** `pnpm test:e2e:a11y` (starts Studio + Portal via `scripts/e2e-servers.mjs`; first run builds all apps — allow ~15–30 min).

   Creator route coverage in `e2e/portal-a11y.spec.ts`:

   - axe WCAG A/AA: `/auth/worlds/terra/characters/neu` → heading „Charakter erstellen“
   - `auditShell` matrix: same path × viewports 390/768/1440 × `applyTheme(page, "hell" | "dunkel")`
   - Touch 390 px: same path with `MIN_TOUCH_COARSE_PX` (44 px)

2. Re-shot all wizard steps with `applyTheme(page, "hell" | "dunkel")` — verify `data-uwe-theme` and screenshot diff.

3. If axe reports contrast failures on `.cw-chip[data-tone="accent"]` in nacht theme, fix in `tokens-v3.css` `*-ink` night branch (global token fix, not wizard-local hacks).

4. Optional: add `aria-hidden` to decorative `NavIcon` instances inside buttons that already have visible text (many steps — low priority).

---

## Related docs

- `apps/portal/src/components/character-wizard/BRIEF.md` § Zugänglichkeit
- `docs/engineering/character-creator-offene-punkte.md` §1.1–1.2
- `docs/character-creator-missing-data.md` MD-13
- `docs/design/uwe-theme-system.md`
- `docs/design/theme-a11y-checklist.md`
