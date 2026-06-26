/**
 * Central, framework-agnostic slug utilities.
 *
 * This is the single home for UWE's slug/lookup-key transforms so every package
 * (database, auth, knoteforge-import, agent-jobs, …) shares one implementation
 * instead of re-deriving subtly different ones.
 *
 * Three slugifiers with intentionally different normalisation:
 * - `slugifyDe`    — German display content: expands umlauts (`ä→ae`, `ö→oe`,
 *                    `ü→ue`, `ß→ss`). Used for pages, worlds, templates, dungeons.
 * - `slugifyAscii` — ASCII transliteration via NFKD diacritic stripping
 *                    (`ä→a`). Used by the KnoteForge importer (stable import slugs).
 * - `slugifyKey`   — machine keys: drops non-ASCII outright. Used for mail keys
 *                    and git branch names.
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
 * Expands umlauts (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`), strips remaining diacritics,
 * lowercases with German locale rules and collapses everything else to dashes.
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
 * Derive a URL-safe slug by transliterating to ASCII (NFKD diacritic strip).
 * Umlauts collapse to their base letter (`ä→a`), so this is **not** umlaut-aware
 * — use {@link slugifyDe} for that. Kept distinct to preserve KnoteForge import
 * slug stability.
 */
export function slugifyAscii(value: string, options: SlugifyOptions = {}): string {
  let slug = value
    .toLocaleLowerCase("de")
    .normalize("NFKD")
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
 *
 * Falls back to numbered suffixes (`-2`, `-3`, …) and finally a timestamp. When
 * `maxLength` is set, numbered candidates are trimmed so the result (base +
 * suffix) stays within the limit; the initial collision-free base is returned
 * untrimmed (callers pass already-bounded bases).
 */
export function pickUniqueSlug(
  baseSlug: string,
  existingSlugs: Iterable<string>,
  options: SlugifyOptions = {},
): string {
  const taken = new Set(existingSlugs);
  const fallback = options.fallback ?? "seite";
  const maxLength = options.maxLength;
  const base = baseSlug || fallback;

  if (!taken.has(base)) return base;

  for (let i = 2; i < 1000; i += 1) {
    const suffix = `-${i}`;
    const candidate =
      typeof maxLength === "number"
        ? `${base.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`
        : `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}

/** Normalise a wikilink / lookup target for case-insensitive matching. */
export function normalizeLookupKey(value: string): string {
  return value.trim().toLocaleLowerCase("de");
}

/**
 * Slugify a machine key (mail keys, branch names). Drops non-ASCII characters
 * (no umlaut expansion). Returns `fallback` when the result would be empty.
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
