/**
 * Atlas stamp KI-Stempel-Generierung — P5.
 *
 * `ATLAS_STAMP_STYLE_PROMPT` is a fixed style suffix for all atlas stamp
 * generation requests.  The DM's keyword is prepended; the style prompt
 * ensures Tolkien ink line-art with a transparent background.
 *
 * `assembleStampPrompt(keyword)` is the canonical assembly function used by
 * both the server action and the unit tests.
 */

/**
 * Fixed style descriptor appended to every atlas stamp image-generation prompt.
 * Produces Tolkien-style ink line-art stamps suitable for fantasy map palettes.
 */
export const ATLAS_STAMP_STYLE_PROMPT =
  "tolkien-style ink line art, fantasy cartography map stamp, " +
  "black ink on transparent background, medieval illuminated manuscript style, " +
  "highly detailed pen and ink illustration, no color fill, pure line art, " +
  "transparent background, isolated map symbol, stamp style, DnD map icon";

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
