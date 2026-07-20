import type { ExtractedCampaignEntity } from "./entity-schema";

function normalizeTitle(title: string): string {
  return title.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

export function dedupeEntitiesByTitle(
  entities: readonly ExtractedCampaignEntity[],
): ExtractedCampaignEntity[] {
  const seen = new Set<string>();
  const deduped: ExtractedCampaignEntity[] = [];

  for (const entity of entities) {
    const key = normalizeTitle(entity.title);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entity);
  }

  return deduped;
}
