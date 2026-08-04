/**
 * Kampagnen-Filterleiste für Welt-Unterseiten mit Kampagnen-Scope.
 * Eigene Datei, weil die restliche Alt-Welt-IA in studio-navigation.ts
 * entfernt wurde — das hier ist der einzige überlebende Baustein.
 */
export function campaignNavItems(
  basePath: string,
  campaigns: { slug: string; name: string }[],
  selectedSlug?: string,
) {
  return [
    { label: "Alle Kampagnen", href: basePath, active: !selectedSlug },
    ...campaigns.map((campaign) => ({
      label: campaign.name,
      href: `${basePath}?campaign=${campaign.slug}`,
      active: selectedSlug === campaign.slug,
    })),
  ];
}
