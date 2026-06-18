# Theme migration notes

## Phase 1 (this PR)

### Added

- Full theme module under `packages/shared-ui/src/theme/`
- CSS token layer at top of `uwe.css`
- Token migration for shell primitives: `.uwe-shell`, topbar, sidebar, cards, primary buttons, DM/player badges
- Wiki link colors via `--uwe-wiki-link` in Studio/Portal `wiki.css`
- `globals.css` body/html fallback to CSS variables
- Studio Settings tab **Erscheinungsbild**
- `ThemeProvider` + `ThemeBootstrapScript` in Studio and Portal layouts

### Still hardcoded (follow-up)

| Area | Notes |
|------|-------|
| Majority of `uwe.css` (~2400 lines) | Legacy `rgba(...)` literals in forms, tables, mobile sheets, command palette |
| `apps/studio/app/globals.css` | Auth pages, brain, capture FAB |
| `apps/portal/app/globals.css` | Auth/share gate purple styling |
| Wiki layout chrome | Partial token migration |
| `StatusBadges.tsx` | Uses CSS classes; badges partially tokenized |
| Label editor | Intentionally print-white canvas |

### Duplications identified

- Studio vs Portal `wiki.css` — nearly identical; candidate for shared `wiki-tokens.css` import
- Studio vs Portal `globals.css` auth patterns — separate brand colors by design
- `settings.app.theme` (DB) vs `localStorage` theme — dual source until sync implemented

## Breaking changes

None intended. Default `:root` values match pre-existing Studio palette.

## Testing checklist

- [ ] Studio loads at `/`
- [ ] Portal loads
- [ ] `/settings?tab=appearance` — switch themes
- [ ] Refresh retains theme (localStorage)
- [ ] Mobile breakpoints (`max-width: 960px`) — sidebar, bottom nav
- [ ] Wiki pages readable; wiki links visible
- [ ] DM / player badges contrast in `uwe-parchment-study` and `hells`
- [ ] Command palette (`Cmd+K`) usable
- [ ] Capture FAB visible on mobile Studio
- [ ] Portal can use different theme than Studio

## Next steps

1. **Token sweep** — replace remaining literals in `uwe.css` with `var(--uwe-*)`
2. **DB sync (optional)** — map `UweThemePreferences` to `settings.app.theme` or new JSON column
3. **Portal appearance entry** — player-facing theme control (if desired)
4. **More canvas backgrounds** — rain/noise animation if performance allows
5. **Shared wiki stylesheet** — deduplicate Studio/Portal `wiki.css`
6. **Light theme QA** — audit `uwe-parchment-study` across all Studio modules
7. **Export/import** — JSON theme sharing (UWE format, not Odysseus format)

## Odysseus comparison

| Feature | Odysseus | UWE (now) |
|---------|----------|-----------|
| Custom theme editor | Full | Not yet |
| Server sync | Yes | No |
| Theme count | 15+ presets + custom | 9 presets |
| Background FX | 8+ | 6 (2 animated) |
| AGPL code reuse | N/A | None |
