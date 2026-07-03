export interface LifeBrainChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Serialize the conversation so the local model sees history + the current question. */
export function buildLifeBrainChatPrompt(messages: LifeBrainChatMessage[]): string {
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIndex === -1) {
    throw new Error("Mindestens eine Nutzer-Nachricht ist erforderlich.");
  }

  const question = messages[lastUserIndex].content.trim();
  const history = messages.slice(0, lastUserIndex);

  if (history.length === 0) {
    return question;
  }

  const transcript = history
    .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content.trim()}`)
    .join("\n");

  return `Gesprächsverlauf:\n${transcript}\n\nAktuelle Frage: ${question}`;
}
