import { normalizeLookupKey } from "@uwe/shared-utils";

/** Normalized visibility for player-facing access checks. */
export type ContentVisibility = "private" | "dm_only" | "player_visible" | "public";

export type ExtendedVisibility =
  | ContentVisibility
  | "specific_players"
  | "unlock_after_session"
  | "archived";

export type ContentBlockTypeValue = string;

/** Visibilities that may appear in public/player APIs when published. */
export const PLAYER_PORTAL_VISIBILITIES: readonly ContentVisibility[] = [
  "player_visible",
  "public",
] as const;

/** Visibilities that are never exposed to players (includes legacy archived). */
export const DM_ONLY_VISIBILITIES: readonly ExtendedVisibility[] = [
  "private",
  "dm_only",
  "archived",
] as const;

/** Fields required for player exposure checks. */
export interface ContentAccessFields {
  visibility: ExtendedVisibility;
}

export interface ContentBlockAccessFields {
  visibility: ExtendedVisibility;
  type?: ContentBlockTypeValue;
}


export function isPlayerPortalVisibility(visibility: ExtendedVisibility): boolean {
  return visibility === "player_visible" || visibility === "public";
}

export function isDmOnlyVisibility(visibility: ExtendedVisibility): boolean {
  return (
    visibility === "private" ||
    visibility === "dm_only" ||
    visibility === "archived"
  );
}

/** Default placeholder shown in the UI in place of a masked secret. */
export const DEFAULT_SECRET_PLACEHOLDER =
  "🔒 Verborgenes Geheimnis — für Spieler noch nicht enthüllt.";

export interface MaskSecretsOptions {
  /**
   * Audience the content is rendered for. For `"player"` (default) a secret
   * that is not `revealed` is masked; for `"dm"` the full content is returned.
   * This is a UI affordance only — server-side player APIs must still rely on
   * `sanitizeForPlayer` / `isBlockPlayerExposable` to drop secrets entirely.
   */
  audience?: "player" | "dm";
  /** Placeholder shown in place of masked content. */
  placeholder?: string;
}

export interface MaskedContent {
  masked: boolean;
  content: string;
}

/**
 * UI helper: masks the text content of a secret block/page when it is not
 * revealed and the audience is a player. Pure and side-effect free. Does NOT
 * replace the server-side sanitization boundary — it only avoids showing
 * unrevealed secret text in shared/preview surfaces.
 */
export function maskSecretsInUi(
  input: { content: string },
  options: MaskSecretsOptions = {},
): MaskedContent {
  const audience = options.audience ?? "player";
  if (audience === "dm") {
    return { masked: false, content: input.content };
  }
  return { masked: true, content: options.placeholder ?? DEFAULT_SECRET_PLACEHOLDER };
}

/**
 * Central rule: content is exposable to players only when visibility, status,
 * and secret/reveal state all allow it.
 */
export function isPlayerExposableContent(content: ContentAccessFields): boolean {
  return isPlayerPortalVisibility(content.visibility);
}

export function isBlockPlayerExposable(block: ContentBlockAccessFields): boolean {
  if (block.type === "gm_note") {
    return false;
  }

  if (isDmOnlyVisibility(block.visibility)) {
    return false;
  }

  if (!isPlayerPortalVisibility(block.visibility)) {
    return false;
  }
  return true;
}

export function isPagePlayerExposable(page: ContentAccessFields): boolean {
  return isPlayerExposableContent(page);
}

export interface PrivateReferencePage {
  title: string;
  slug: string;
  visibility: ExtendedVisibility;
  aliases?: unknown;
}

export interface PrivateReferenceTarget {
  title: string;
  slug: string;
  reason: "private_visibility" | "hidden_secret";
}

function parseAliases(aliases: unknown): string[] {
  if (!Array.isArray(aliases)) {
    return [];
  }
  return aliases.filter((value): value is string => typeof value === "string");
}

/**
 * Detects wikilinks from player-visible content to non-exposable targets.
 * Used in DM player preview to warn about broken player experience.
 */
export function detectPrivateReferences(
  content: string,
  allPages: PrivateReferencePage[],
): PrivateReferenceTarget[] {
  const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const seen = new Set<string>();
  const results: PrivateReferenceTarget[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const target = match[1].trim();
    const key = normalizeLookupKey(target);
    if (seen.has(key)) continue;
    seen.add(key);

    const page = allPages.find((candidate) => {
      const slugKey = normalizeLookupKey(candidate.slug);
      const titleKey = normalizeLookupKey(candidate.title);
      if (slugKey === key || titleKey === key) {
        return true;
      }
      return parseAliases(candidate.aliases).some((alias) => normalizeLookupKey(alias) === key);
    });

    if (!page) continue;

    if (isDmOnlyVisibility(page.visibility)) {
      results.push({ title: page.title, slug: page.slug, reason: "private_visibility" });
      continue;
    }

  }

  return results;
}

export function formatPrivateReferenceWarning(targets: PrivateReferenceTarget[]): string | null {
  if (targets.length === 0) {
    return null;
  }

  const names = targets.map((target) => `"${target.title}"`).join(", ");
  return `Dieser Spielerinhalt verlinkt auf private Inhalte: ${names}`;
}
