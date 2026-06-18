# Odysseus license risk assessment (UWE)

## Source project

- **Repository:** https://github.com/pewdiepie-archdaemon/odysseus
- **License:** GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)

## UWE position

UWE is a separate monorepo without an AGPL license on the aggregate work. **Odysseus is used only as a product/UX reference** during design research — not as a code donor.

## Decision (conservative)

| Risk | Mitigation |
|------|------------|
| Copying `theme.js`, `style.css`, canvas effects | **Avoided** — UWE theme code written from scratch |
| Copying hex palettes 1:1 | **Avoided** — palettes authored in `themes.ts` with distinct values |
| Copying bootstrap inline script | **Avoided** — UWE `bootstrapScript.ts` is a separate minimal implementation |
| Odysseus-branded theme IDs in product UI | **Removed** — UWE-native IDs only (`uwe-charcoal-desk`, …) |
| Idea-level reuse (tokens, picker UX, localStorage) | **Allowed** — not copyrightable expression |

## Product code policy

1. **No copy-paste** from Odysseus or other AGPL repos into UWE runtime code.
2. **UWE-native naming** for themes, tokens, components, and user-facing labels.
3. **Independent palettes** — if a color looks too close to a reference project, shift it.
4. **Audit docs only** may name Odysseus for traceability; shipped UI does not.

## Legacy ID migration

Early draft builds used preview IDs such as `odysseus-dark-inspired`. These are **not** shipped names. `LEGACY_THEME_ID_MAP` in `themes.ts` migrates any saved `localStorage` entries to UWE-native IDs.

## If future work requires code reuse

1. Obtain legal review.
2. Either release the affected UWE components under AGPL-3.0 with proper notices, **or**
3. Obtain a separate license from Odysseus copyright holders.

## Attribution

Odysseus informed **workspace UX research** for UWE's theme picker and token model. Odysseus is © its respective authors (AGPL-3.0-or-later). **UWE does not bundle Odysseus code.**

## Recommended ongoing practice

- Do not paste Odysseus snippets into PRs.
- Add themes only via `packages/shared-ui/src/theme/themes.ts`.
- PR review question: *Could this diff only exist because someone transcribed AGPL source?* If yes, reject.
