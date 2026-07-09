/**
 * Custom (user-authored) theme palettes.
 *
 * Stored installation-wide inside the single `system_settings` JSON row under
 * `app.customThemes` — no dedicated table / migration (mirrors how
 * `app.themePreferences` already lives there). Each record is a full palette
 * (the `ThemeColorTokens` shape from `@uwe/shared-ui`) plus a label and a scope
 * that decides whether it appears in the Studio picker, the Portal picker, or
 * both. Colors are kept as a loose `Record<string, string>` here so this
 * data-access module stays free of a `@uwe/shared-ui` dependency; completeness /
 * contrast validation is a domain concern handled at creation time.
 */

export type CustomThemeScope = "studio" | "portal" | "both";

export type CustomThemeFont = "mono" | "sans" | "serif";
export type CustomThemeDensity = "compact" | "comfortable" | "spacious";

export interface CustomThemeDefaults {
  font?: CustomThemeFont;
  density?: CustomThemeDensity;
  background?: string;
  frostedGlass?: boolean;
}

export interface CustomThemeRecord {
  /** Stable id, prefixed `custom-` to avoid collisions with built-in theme ids. */
  id: string;
  label: string;
  description?: string;
  scope: CustomThemeScope;
  /** Palette hex tokens (ThemeColorTokens shape). Loose map to stay dependency-free. */
  colors: Record<string, string>;
  defaults?: CustomThemeDefaults;
  /** ISO timestamp; falls back to the epoch when absent (kept deterministic). */
  createdAt: string;
}

export const CUSTOM_THEME_ID_PREFIX = "custom-";

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const SCOPE_VALUES = new Set<CustomThemeScope>(["studio", "portal", "both"]);
const FONT_VALUES = new Set<CustomThemeFont>(["mono", "sans", "serif"]);
const DENSITY_VALUES = new Set<CustomThemeDensity>([
  "compact",
  "comfortable",
  "spacious",
]);

function normalizeColors(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeDefaults(raw: unknown): CustomThemeDefaults | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const result: CustomThemeDefaults = {};
  if (FONT_VALUES.has(obj.font as CustomThemeFont)) result.font = obj.font as CustomThemeFont;
  if (DENSITY_VALUES.has(obj.density as CustomThemeDensity)) {
    result.density = obj.density as CustomThemeDensity;
  }
  if (typeof obj.background === "string" && obj.background.trim()) {
    result.background = obj.background.trim();
  }
  if (typeof obj.frostedGlass === "boolean") result.frostedGlass = obj.frostedGlass;
  return Object.keys(result).length > 0 ? result : undefined;
}

export function normalizeCustomThemeRecord(raw: unknown): CustomThemeRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  const label = typeof obj.label === "string" ? obj.label.trim() : "";
  const colors = normalizeColors(obj.colors);
  if (!id || !label || !colors) return null;

  const scope = SCOPE_VALUES.has(obj.scope as CustomThemeScope)
    ? (obj.scope as CustomThemeScope)
    : "both";
  const description =
    typeof obj.description === "string" && obj.description.trim()
      ? obj.description.trim()
      : undefined;
  const createdAt =
    typeof obj.createdAt === "string" && obj.createdAt.trim() ? obj.createdAt : EPOCH_ISO;
  const defaults = normalizeDefaults(obj.defaults);

  return { id, label, description, scope, colors, defaults, createdAt };
}

/** Normalize the stored list — drops invalid records and de-duplicates ids. */
export function normalizeCustomThemes(raw: unknown): CustomThemeRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomThemeRecord[] = [];
  for (const item of raw) {
    const record = normalizeCustomThemeRecord(item);
    if (record && !seen.has(record.id)) {
      seen.add(record.id);
      out.push(record);
    }
  }
  return out;
}

/** Themes visible in a given app scope (`both` shows everywhere). */
export function customThemesForScope(
  themes: CustomThemeRecord[] | undefined,
  scope: "studio" | "portal",
): CustomThemeRecord[] {
  if (!themes) return [];
  return themes.filter((theme) => theme.scope === "both" || theme.scope === scope);
}

/** Upsert a record into the list by id (used by the save action). */
export function upsertCustomTheme(
  current: CustomThemeRecord[] | undefined,
  next: CustomThemeRecord,
): CustomThemeRecord[] {
  const list = normalizeCustomThemes(current);
  const idx = list.findIndex((theme) => theme.id === next.id);
  if (idx === -1) return [...list, next];
  const copy = list.slice();
  copy[idx] = next;
  return copy;
}

/** Remove a record by id. */
export function removeCustomTheme(
  current: CustomThemeRecord[] | undefined,
  id: string,
): CustomThemeRecord[] {
  return normalizeCustomThemes(current).filter((theme) => theme.id !== id);
}
