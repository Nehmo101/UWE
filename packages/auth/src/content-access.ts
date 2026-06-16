/** Normalized visibility for player-facing access checks. */
export type ContentVisibility = "private" | "dm_only" | "player_visible" | "public";

export type ExtendedVisibility =
  | ContentVisibility
  | "specific_players"
  | "unlock_after_session"
  | "archived";

/** Normalized lifecycle status mapped from publishStatus. */
export type ContentStatus = "draft" | "ready" | "published" | "archived";

export type PublishStatusValue = "draft" | "internal" | "published" | "archived";

export type SecretLevel = "none" | "spoiler" | "dm_secret";

export type RevealState = "hidden" | "preview" | "revealed";

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
  publishStatus: PublishStatusValue;
  secretLevel?: SecretLevel | null;
  revealState?: RevealState | null;
}

export interface ContentBlockAccessFields {
  visibility: ExtendedVisibility;
  type?: ContentBlockTypeValue;
  secretLevel?: SecretLevel | null;
  revealState?: RevealState | null;
}

export function mapPublishStatusToContentStatus(publishStatus: PublishStatusValue): ContentStatus {
  switch (publishStatus) {
    case "draft":
      return "draft";
    case "internal":
      return "ready";
    case "published":
      return "published";
    case "archived":
      return "archived";
    default:
      return "draft";
  }
}

export function isPublishedContentStatus(status: ContentStatus): boolean {
  return status === "published";
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

export function isSecretVisibleToPlayer(
  content: Pick<ContentAccessFields, "secretLevel" | "revealState">,
): boolean {
  const secretLevel = content.secretLevel ?? "none";
  const revealState = content.revealState ?? "hidden";

  if (secretLevel === "none") {
    return true;
  }

  return revealState === "revealed";
}

/**
 * Central rule: content is exposable to players only when visibility, status,
 * and secret/reveal state all allow it.
 */
export function isPlayerExposableContent(content: ContentAccessFields): boolean {
  if (!isPlayerPortalVisibility(content.visibility)) {
    return false;
  }

  if (!isPublishedContentStatus(mapPublishStatusToContentStatus(content.publishStatus))) {
    return false;
  }

  return isSecretVisibleToPlayer(content);
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

  return isSecretVisibleToPlayer(block);
}

export function isPagePlayerExposable(page: ContentAccessFields): boolean {
  return isPlayerExposableContent(page);
}

export interface PrivateReferencePage {
  title: string;
  slug: string;
  visibility: ExtendedVisibility;
  publishStatus: PublishStatusValue;
  secretLevel?: SecretLevel | null;
  revealState?: RevealState | null;
  aliases?: unknown;
}

export interface PrivateReferenceTarget {
  title: string;
  slug: string;
  reason: "private_visibility" | "unpublished" | "hidden_secret";
}

function normalizeLookupKey(key: string): string {
  return key.trim().toLocaleLowerCase("de");
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

    if (!isPublishedContentStatus(mapPublishStatusToContentStatus(page.publishStatus))) {
      results.push({ title: page.title, slug: page.slug, reason: "unpublished" });
      continue;
    }

    if (!isSecretVisibleToPlayer(page)) {
      results.push({ title: page.title, slug: page.slug, reason: "hidden_secret" });
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
