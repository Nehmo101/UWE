export const MAX_CAMPAIGN_CONTEXT_CHARACTERS = 4_000;

export function buildCampaignExtractionPrompt(
  chunk: string,
  campaignContext?: string,
): string {
  const normalizedContext = campaignContext?.trim();
  const contextSection = normalizedContext
    ? [
        "Vom Nutzer bereitgestellter Kontext zur Einordnung der Kampagne innerhalb ihrer Welt:",
        "<campaign_context>",
        normalizedContext,
        "</campaign_context>",
        "Nutze diesen Kontext nur zur Einordnung. Extrahiere weiterhin keine Entit\u00e4ten, die nicht ausdr\u00fccklich im PDF-Ausschnitt genannt werden.",
        "",
      ]
    : [];

  return [
    "Extrahiere aus dem folgenden PDF-Ausschnitt ausschließlich ausdrücklich genannte Kampagnen-Entitäten.",
    "Erfinde nichts hinzu und ergänze kein Wissen, das nicht im Ausschnitt steht.",
    "Erlaubte Arten: npc, location, region, faction, item, quest, encounter, lore, note.",
    "Fasse jede eigenständige Entität genau einmal zusammen. Der body darf Markdown enthalten.",
    "Antworte NUR als JSON-Array ohne Einleitung oder Nachsatz.",
    '{"kind":"npc","title":"Name","summary":"Kurzfassung oder null","body":"Vollständige Notizen","tags":["Tag"]}',
    "title und body müssen nicht leer sein. Verwende bei unklarer Art note.",
    "",
    ...contextSection,
    "PDF-Ausschnitt:",
    chunk,
  ].join("\n");
}
