import type { ExtractedCampaignEntity } from "./entity-schema";

export const MAX_FIT_CHAT_MESSAGES = 24;
export const MAX_FIT_CHAT_MESSAGE_CHARS = 4_000;
export const MAX_FIT_CHAT_ENTITY_LINES = 120;
export const MAX_FIT_CHAT_DESCRIPTION_CHARS = 4_000;

export interface CampaignFitChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CampaignFitChatContext {
  worldName: string;
  worldDescription?: string | null;
  campaignName: string;
  campaignDescription?: string | null;
  /** Vom Nutzer im Import-Panel eingegebener Kampagnen-Kontext. */
  campaignContext?: string | null;
  entities: readonly Pick<ExtractedCampaignEntity, "kind" | "title" | "summary">[];
}

/**
 * Tolerant einen Chat-Verlauf einlesen (z. B. aus Job-Metadata oder aus dem
 * Client): unbekannte Rollen und leere Inhalte werden verworfen, Inhalte auf
 * die Zeichenobergrenze gekürzt und nur die letzten Nachrichten behalten.
 */
export function sanitizeFitChatTranscript(value: unknown): CampaignFitChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const messages: CampaignFitChatMessage[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const role = record.role === "user" || record.role === "assistant" ? record.role : null;
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (!role || !content) {
      continue;
    }
    messages.push({ role, content: content.slice(0, MAX_FIT_CHAT_MESSAGE_CHARS) });
  }
  return messages.slice(-MAX_FIT_CHAT_MESSAGES);
}

function clip(value: string | null | undefined, maxChars: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) + "…" : trimmed;
}

function entityLines(
  entities: CampaignFitChatContext["entities"],
): string[] {
  if (entities.length === 0) {
    return ["(Noch keine Entitäten extrahiert — die PDF-Analyse lief noch nicht.)"];
  }
  const lines = entities
    .slice(0, MAX_FIT_CHAT_ENTITY_LINES)
    .map((entity) => {
      const summary = clip(entity.summary, 200);
      return `- [${entity.kind}] ${entity.title}${summary ? ` — ${summary}` : ""}`;
    });
  const remaining = entities.length - MAX_FIT_CHAT_ENTITY_LINES;
  if (remaining > 0) {
    lines.push(`… und ${remaining} weitere Entitäten.`);
  }
  return lines;
}

/**
 * Prompt für die Einordnungs-Konversation: Wie fügt sich die importierte
 * Kampagne in die bestehende Welt ein? Läuft ausschließlich lokal (RTX);
 * Welt-/Kampagnenbeschreibung werden bewusst hier — und nur hier — angehängt.
 */
export function buildCampaignFitChatPrompt(
  context: CampaignFitChatContext,
  transcript: readonly CampaignFitChatMessage[],
): string {
  const worldDescription = clip(context.worldDescription, MAX_FIT_CHAT_DESCRIPTION_CHARS);
  const campaignDescription = clip(
    context.campaignDescription,
    MAX_FIT_CHAT_DESCRIPTION_CHARS,
  );
  const campaignContext = clip(context.campaignContext, MAX_FIT_CHAT_DESCRIPTION_CHARS);

  const conversation = transcript.map((message) =>
    (message.role === "user" ? "Spielleiter: " : "Assistent: ") + message.content,
  );

  return [
    "Du unterstützt einen Spielleiter dabei einzuordnen, wie eine aus einem PDF importierte Kampagne sich in seine bestehende Welt einfügt.",
    "Diskutiere Anknüpfungspunkte, Konflikte mit bestehender Lore, Zeitlinien und konkrete Einbau-Vorschläge.",
    "Stütze dich nur auf die folgenden Angaben und das Gespräch. Erfinde keine Fakten über die Welt, die hier nicht stehen — kennzeichne eigene Vorschläge klar als Vorschläge.",
    "",
    `Welt: ${context.worldName}`,
    ...(worldDescription ? ["Beschreibung der Welt:", worldDescription] : []),
    "",
    `Kampagne: ${context.campaignName}`,
    ...(campaignDescription ? ["Beschreibung der Kampagne:", campaignDescription] : []),
    ...(campaignContext
      ? ["Vom Spielleiter angegebener Kampagnen-Kontext:", campaignContext]
      : []),
    "",
    "Aus dem PDF extrahierte Entitäten:",
    ...entityLines(context.entities),
    "",
    "Bisheriges Gespräch:",
    ...conversation,
    "",
    "Antworte auf die letzte Nachricht des Spielleiters auf Deutsch, als Fließtext ohne JSON und ohne Rollen-Präfix.",
  ].join("\n");
}
