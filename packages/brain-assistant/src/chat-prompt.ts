/**
 * Prompt assembly for the Brain assistant.
 *
 * The AI layer has no message-array plumbing: `GenerateTextOptions.prompt` is a
 * single string and the connector's `llm_generate` payload carries `{prompt,
 * system}`. Every multi-turn feature in UWE therefore flattens its history —
 * see `apps/studio/src/lib/life-brain-chat-prompt.ts`. This module does the same
 * and adds two Brain-specific blocks: extracted attachment text and retrieved
 * Life-Brain context.
 *
 * Everything is budgeted here, before `enforceAiRequestLimits` sees the prompt,
 * so a long document or a fat RAG hit degrades to a truncated block instead of
 * a policy error the user cannot act on.
 */

import {
  ASSISTANT_ATTACHMENT_TEXT_LIMIT,
  ASSISTANT_ATTACHMENT_TOTAL_LIMIT,
  ASSISTANT_MAX_HISTORY,
  ASSISTANT_RAG_CONTEXT_LIMIT,
  type AssistantRole,
} from "./assistant-types";

export interface PromptHistoryMessage {
  role: AssistantRole;
  content: string;
}

export interface PromptAttachmentBlock {
  kind: "image" | "document" | "audio";
  filename: string;
  text: string;
}

export interface BuildAssistantPromptInput {
  /** Full history including the current question as the last user message. */
  messages: PromptHistoryMessage[];
  attachments?: PromptAttachmentBlock[];
  /** Retrieved Life-Brain context (only in `life_brain` mode). */
  ragContext?: string | null;
  /**
   * The owner's instruction from the assistant profile. `AiRouterRequest` has no
   * system-prompt field — the router derives one from the task type — so the
   * owner's wording is prepended to the user prompt instead of being dropped.
   */
  systemPrompt?: string | null;
}

const KIND_LABELS: Record<PromptAttachmentBlock["kind"], string> = {
  image: "Bild",
  document: "Dokument",
  audio: "Aufnahme",
};

/** Cut on a whitespace boundary when possible and mark the cut explicitly. */
export function truncateForPrompt(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  const hard = trimmed.slice(0, limit);
  const lastBreak = hard.lastIndexOf("\n");
  const cut = lastBreak > limit * 0.6 ? hard.slice(0, lastBreak) : hard;
  return `${cut.trimEnd()}\n… [gekürzt]`;
}

function renderAttachments(blocks: PromptAttachmentBlock[]): string {
  let remaining = ASSISTANT_ATTACHMENT_TOTAL_LIMIT;
  const rendered: string[] = [];

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text || remaining <= 0) {
      continue;
    }
    const budget = Math.min(ASSISTANT_ATTACHMENT_TEXT_LIMIT, remaining);
    const body = truncateForPrompt(text, budget);
    remaining -= body.length;
    rendered.push(`[${KIND_LABELS[block.kind]}: ${block.filename}]\n${body}`);
  }

  return rendered.join("\n\n");
}

/**
 * Serialize one turn so a local model sees the attachments, the retrieved
 * knowledge, the history and finally the question.
 */
export function buildAssistantPrompt(input: BuildAssistantPromptInput): string {
  const messages = input.messages
    .map((message) => ({ role: message.role, content: message.content.trim() }))
    .filter((message) => message.content.length > 0)
    .slice(-ASSISTANT_MAX_HISTORY);

  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (lastUserIndex === -1) {
    throw new Error("Mindestens eine Nutzer-Nachricht ist erforderlich.");
  }

  const question = messages[lastUserIndex].content;
  const history = messages.slice(0, lastUserIndex);
  const sections: string[] = [];

  const instruction = input.systemPrompt?.trim();
  if (instruction) {
    sections.push(`Anweisung: ${truncateForPrompt(instruction, 2_000)}`);
  }

  const attachments = renderAttachments(input.attachments ?? []);
  if (attachments) {
    sections.push(`Angehängte Inhalte:\n${attachments}`);
  }

  const rag = input.ragContext?.trim();
  if (rag) {
    sections.push(
      `Persönlicher Kontext (aus dem Life-Brain):\n${truncateForPrompt(rag, ASSISTANT_RAG_CONTEXT_LIMIT)}`,
    );
  }

  if (history.length > 0) {
    const transcript = history
      .map((message) => `${message.role === "user" ? "Nutzer" : "Assistent"}: ${message.content}`)
      .join("\n");
    sections.push(`Gesprächsverlauf:\n${transcript}`);
  }

  if (sections.length === 0) {
    return question;
  }

  sections.push(`Aktuelle Frage: ${question}`);
  return sections.join("\n\n");
}

/** Default system prompt when the owner has not written their own. */
export const ASSISTANT_DEFAULT_SYSTEM_PROMPT = [
  "Du bist der persönliche Assistent im UWE Brain und läufst ausschließlich lokal.",
  "Antworte auf Deutsch, sachlich und knapp.",
  "Stütze dich auf die angehängten Inhalte und den persönlichen Kontext, wenn vorhanden.",
  "Wenn du etwas nicht weißt, sage das, statt zu raten.",
].join(" ");

/** Prompt used to turn an attached image into text a chat model can reason about. */
export const ASSISTANT_VISION_DESCRIBE_PROMPT = [
  "Beschreibe dieses Bild sachlich und vollständig auf Deutsch.",
  "Gib sichtbaren Text wörtlich wieder.",
].join(" ");
