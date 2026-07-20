export function buildCampaignExtractionPrompt(chunk: string): string {
  return [
    "Extrahiere aus dem folgenden PDF-Ausschnitt ausschließlich ausdrücklich genannte Kampagnen-Entitäten.",
    "Erfinde nichts hinzu und ergänze kein Wissen, das nicht im Ausschnitt steht.",
    "Erlaubte Arten: npc, location, region, faction, item, quest, encounter, lore, note.",
    "Fasse jede eigenständige Entität genau einmal zusammen. Der body darf Markdown enthalten.",
    "Antworte NUR als JSON-Array ohne Einleitung oder Nachsatz.",
    '{"kind":"npc","title":"Name","summary":"Kurzfassung oder null","body":"Vollständige Notizen","tags":["Tag"]}',
    "title und body müssen nicht leer sein. Verwende bei unklarer Art note.",
    "",
    "PDF-Ausschnitt:",
    chunk,
  ].join("\n");
}
