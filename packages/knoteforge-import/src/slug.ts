import { pickUniqueSlug, slugifyAscii } from "@uwe/shared-utils";

const SLUG_MAX_LENGTH = 60;

/**
 * KnoteForge import slugs stay ASCII (diacritic-stripping) for stability with
 * previously imported content — see `@uwe/shared-utils` `slugifyAscii`.
 */
export function slugifyTitle(title: string): string {
  return slugifyAscii(title, { maxLength: SLUG_MAX_LENGTH });
}

export function resolveUniqueSlug(
  desiredSlug: string,
  takenSlugs: ReadonlySet<string>,
): string {
  return pickUniqueSlug(desiredSlug, takenSlugs, {
    maxLength: SLUG_MAX_LENGTH,
    fallback: "import",
  });
}

export { normalizeLookupKey } from "@uwe/shared-utils";
