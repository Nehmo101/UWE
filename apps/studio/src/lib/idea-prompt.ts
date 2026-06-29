import type { DevIdeaChatMessage } from "@uwe/database/server";

const CHAT_SYSTEM_FRAMING =
  "Du bist ein KI-Assistent im UWE-Ideen-Management. Hilf dem Owner, die folgende " +
  "Entwicklungs-Idee zu schärfen: stelle gezielte Rückfragen, ergänze fehlende Aspekte, " +
  "weise auf Risiken und Edge-Cases hin und strukturiere die Idee. Antworte prägnant auf Deutsch.";

const PROMPT_SYSTEM_FRAMING =
  "Du bist ein Senior-Software-Engineer. Formuliere aus der folgenden Idee und der bisherigen " +
  "Diskussion EINEN klaren, eigenständigen Implementierungs-Prompt für einen Coding-Agenten " +
  "(z. B. Cursor), der am UWE-Repository arbeitet. Der Prompt soll enthalten: kurzen Kontext, " +
  "ein konkretes Ziel, betroffene Bereiche bzw. Dateien (sofern erkennbar), Akzeptanzkriterien " +
  "und einen Hinweis auf Tests. Gib NUR den fertigen Prompt aus — ohne Vorrede, ohne Markdown-Codeblock.";

function renderIdea(title: string, body: string): string {
  const trimmedBody = body.trim();
  return trimmedBody ? `# Idee: ${title}\n${trimmedBody}` : `# Idee: ${title}`;
}

function renderTranscript(transcript: DevIdeaChatMessage[]): string {
  return transcript
    .map((message) => `${message.role === "user" ? "Nutzer" : "Assistent"}: ${message.content}`)
    .join("\n\n");
}

/** Build the single composed prompt for one multi-turn chat reply (general_chat, cloud-safe). */
export function composeIdeaChatPrompt(
  title: string,
  body: string,
  transcript: DevIdeaChatMessage[],
  message: string,
): string {
  const sections = [CHAT_SYSTEM_FRAMING, renderIdea(title, body)];
  if (transcript.length > 0) {
    sections.push(`# Bisheriger Verlauf\n${renderTranscript(transcript)}`);
  }
  sections.push(`# Neue Nachricht\nNutzer: ${message.trim()}\nAssistent:`);
  return sections.join("\n\n");
}

/** Build the prompt that asks the model to synthesize a Cursor implementation prompt. */
export function composeIdeaPromptGeneration(
  title: string,
  body: string,
  transcript: DevIdeaChatMessage[],
): string {
  const sections = [PROMPT_SYSTEM_FRAMING, renderIdea(title, body)];
  if (transcript.length > 0) {
    sections.push(`# Diskussion\n${renderTranscript(transcript)}`);
  }
  sections.push("# Aufgabe\nSchreibe jetzt den fertigen Implementierungs-Prompt.");
  return sections.join("\n\n");
}
