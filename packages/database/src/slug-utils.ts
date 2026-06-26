/**
 * Central slug utilities.
 *
 * One umlaut-aware German slugifier, one unique-slug picker, one lookup-key
 * normaliser and one ASCII key slugifier. Domain modules (pages, worlds,
 * dungeon entities, mail keys, restore) should import from here instead of
 * re-implementing the same transforms with subtle differences.
 *
 * Behaviour is intentionally identical to the previous per-module helpers so
 * existing slugs do not change:
 * - `slugifyDe` matches the former `slugifyPageTitle` / `slugifyTemplateName`.
 * - `pickUniqueSlug` matches the former `page-templates` picker.
 * - `normalizeLookupKey` matches the former `queries` helper.
 * - `slugifyKey` matches the former `slugifyMailKey`.
 */

export interface SlugifyOptions {
  /** Truncate the generated slug to this many characters. */
  maxLength?: number;
  /** Returned when the slug would otherwise be empty. */
  fallback?: string;
}

/**
 * Derive a URL-safe slug from German text.
 *
 * Expands umlauts (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`), strips remaining
 * diacritics, lowercases with German locale rules and collapses everything
 * else to single dashes.
 */
export function slugifyDe(value: string, options: SlugifyOptions = {}): string {
  let slug = value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (typeof options.maxLength === "number") {
    slug = slug.slice(0, options.maxLength);
  }

  if (!slug && options.fallback !== undefined) {
    return options.fallback;
  }

  return slug;
}

/**
 * Pick a slug that does not collide with existing slugs.
 * Falls back to numbered suffixes (`-2`, `-3`, …) and finally a timestamp.
 */
export function pickUniqueSlug(
  baseSlug: string,
  existingSlugs: Iterable<string>,
  options: SlugifyOptions = {},
): string {
  const taken = new Set(existingSlugs);
  const fallback = options.fallback ?? "seite";
  let base = baseSlug || fallback;
  if (typeof options.maxLength === "number") {
    base = base.slice(0, options.maxLength);
  }

  if (!taken.has(base)) return base;

  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}

/** Normalise a wikilink / lookup target for case-insensitive matching. */
export function normalizeLookupKey(value: string): string {
  return value.trim().toLocaleLowerCase("de");
}

/**
 * Slugify an ASCII key (mail keys, machine identifiers). Unlike
 * {@link slugifyDe} this does not expand umlauts; non-ASCII characters are
 * dropped. Returns `fallback` when the result would be empty.
 */
export function slugifyKey(
  value: string,
  fallback: string,
  options: { maxLength?: number } = {},
): string {
  const maxLength = options.maxLength ?? 80;
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength) || fallback
  );
}
