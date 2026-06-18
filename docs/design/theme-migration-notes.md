# Theme migration notes

## Status (post-orchestration steps 1–8, main)

### Completed

- Full theme module under `packages/shared-ui/src/theme/`
- CSS token layer + `uwe-visual-polish.css`
- Component migration (~50% fewer `rgba()` literals in `uwe.css`)
- Studio Settings tab **Erscheinungsbild** with `ThemeSettingsPanel`
- Accessible `ThemePicker` for server dark/light/system
- `ThemeProvider` + `ThemeBootstrapScript` in Studio and Portal layouts
- Visual polish: patterns, frosted glass, scrollbars, `VisualThemePreview`
- Mobile touch targets, focus rings, `theme-a11y-checklist.md`
- QA report: `theme-qa-report.md`

### Still hardcoded (follow-up)

| Area | Notes |
|------|-------|
| ~73 `rgba(...)` in `uwe.css` | Forms, tables, mobile sheets, command palette |
| `apps/studio/app/globals.css` | Auth pages, brain, capture FAB |
| `apps/portal/app/globals.css` | Auth/share gate purple styling |
| Label editor | Intentionally print-white canvas |

### Duplications identified

- Studio vs Portal `wiki.css` — nearly identical; candidate for shared `wiki-tokens.css` import
- Studio vs Portal `globals.css` auth patterns — separate brand colors by design
- `settings.app.theme` (DB) vs `localStorage` theme — dual source until sync implemented

## Breaking changes

None intended. `LEGACY_THEME_ID_MAP` migrates old draft theme IDs.

## Testing checklist

- [x] `pnpm quality` passes on `main`
- [x] Theme module unit tests (`theme.test.ts`, `visual-theme.test.ts`)
- [x] Accessible theme picker unit test (`shared-ui.test.tsx`)
- [ ] Studio loads at `/` (manual)
- [ ] Portal loads (manual)
- [ ] `/settings?tab=appearance` — switch themes (manual)
- [ ] Refresh retains theme (localStorage) (manual)
- [ ] Mobile breakpoints — sidebar, bottom nav (manual)
- [ ] Wiki pages readable; wiki links visible (manual)
- [ ] DM / player badges contrast in all presets (manual)
- [ ] Command palette (`Cmd+K`) usable in production build (manual)
- [ ] Portal can use different theme than Studio (manual)

## Next steps

1. **DB sync (optional)** — map `UweThemePreferences` to settings or new JSON column
2. **Token sweep phase 2** — remaining literals in `uwe.css`
3. **Portal appearance entry** — player-facing theme control (if desired)
4. **Shared wiki stylesheet** — deduplicate Studio/Portal `wiki.css`
5. **E2E theme test** — Playwright persistence smoke
6. **Export/import** — JSON theme sharing (UWE format, not Odysseus format)

## Odysseus comparison

| Feature | Odysseus | UWE (now) |
|---------|----------|-----------|
| Custom theme editor | Full | Not yet |
| Server sync | Yes | Partial (`data-uwe-*` + localStorage) |
| Theme count | 15+ presets + custom | 9 presets |
| Background FX | 8+ | 6 (2 animated) |
| AGPL code reuse | N/A | None |
