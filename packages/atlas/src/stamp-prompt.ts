/**
 * Atlas stamp KI-Stempel-Generierung — P5.
 *
 * `ATLAS_STAMP_STYLE_PROMPT` is a fixed style suffix for all atlas stamp
 * generation requests.  The DM's keyword is prepended; the style prompt
 * enforces the map's canonical GOUACHE look (opaque painted map asset with a
 * darker pigment edge on a transparent background) — the binding style rules
 * live in `docs/prompts/atlas-pictogram-styleguide.md` (section "Gouache").
 *
 * `assembleStampPrompt(keyword)` is the canonical assembly function used by
 * both the server action and the unit tests.
 */

/**
 * Fixed style descriptor appended to every atlas stamp image-generation prompt.
 * Produces opaque gouache-painted map stamps matching the builtin
 * `@uwe/atlas/assets` recipes (filled shapes, soft shadow, highlight, darker
 * pigment edge — never plain line art).
 */
export const ATLAS_STAMP_STYLE_PROMPT =
  "gouache painted fantasy map asset, opaque matte painted map stamp, " +
  "flat painterly fills with soft shadow and subtle highlight, " +
  "darker pigment edge outline, muted earth palette on transparent background, " +
  "top-down-friendly medieval cartography icon, isolated map symbol, " +
  "no photo, no 3d render, no plain line art, DnD map stamp";

/**
 * Assembles the full image-generation prompt for a map stamp variant.
 *
 * @param keyword   DM-supplied keyword, e.g. "Kirche", "Hafen", "Vulkan"
 * @returns         Full prompt string: `{keyword}, {ATLAS_STAMP_STYLE_PROMPT}`
 */
export function assembleStampPrompt(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return ATLAS_STAMP_STYLE_PROMPT;
  return `${trimmed}, ${ATLAS_STAMP_STYLE_PROMPT}`;
}
