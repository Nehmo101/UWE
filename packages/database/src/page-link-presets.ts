export const PAGE_LINK_RELATION_PRESETS = [
  "contains",
  "controls",
  "located_in",
  "threatens",
  "related",
  "member_of",
  "allied_with",
  "enemy_of",
  "leads_to",
  "describes",
  "mentions",
] as const;

export type PageLinkRelationPreset = (typeof PAGE_LINK_RELATION_PRESETS)[number];

export const PAGE_LINK_RELATION_LABELS: Record<PageLinkRelationPreset, string> = {
  contains: "Enthält",
  controls: "Kontrolliert",
  located_in: "Liegt in",
  threatens: "Bedroht",
  related: "Verwandt mit",
  member_of: "Mitglied von",
  allied_with: "Verbündet mit",
  enemy_of: "Feind von",
  leads_to: "Führt zu",
  describes: "Beschreibt",
  mentions: "Erwähnt",
};

export function isPageLinkRelationPreset(value: string): value is PageLinkRelationPreset {
  return (PAGE_LINK_RELATION_PRESETS as readonly string[]).includes(value);
}

export function pageLinkRelationLabel(relationType: string): string {
  if (isPageLinkRelationPreset(relationType)) {
    return PAGE_LINK_RELATION_LABELS[relationType];
  }
  return relationType;
}
