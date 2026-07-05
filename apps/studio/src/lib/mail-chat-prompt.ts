export interface MailChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function buildMailChatPrompt(input: {
  subject: string;
  fromAddress: string;
  body: string;
  messages: MailChatMessage[];
}): string {
  const header = [
    "Du hilfst beim Verwalten dieser E-Mail.",
    `Betreff: ${input.subject}`,
    `Von: ${input.fromAddress}`,
    "",
    "E-Mail-Inhalt:",
    input.body || "(kein Text)",
    "",
    "Konversationsverlauf:",
  ].join("\n");

  const history = input.messages
    .map((entry) => `${entry.role === "user" ? "Nutzer" : "Assistent"}: ${entry.content}`)
    .join("\n\n");

  return `${header}\n${history}\n\nAntworte auf Deutsch. Schlage konkrete Aktionen vor (löschen, abmelden, archivieren), führe nichts ohne Bestätigung aus. Wenn du eine Bulk-Aktion vorschlägst, nenne das Muster für den Absender.`;
}
