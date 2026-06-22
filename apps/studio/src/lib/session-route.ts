/** Game sessions use Prisma cuid ids; wiki session/encounter pages use human slugs. */
export function isLikelyGameSessionId(segment: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(segment);
}

/** True when a /worlds/:slug/sessions/:segment URL should open a wiki page, not GameSession admin. */
export function isWikiSessionCategoryPath(category: string, segment: string): boolean {
  return category === "sessions" && !isLikelyGameSessionId(segment);
}
