import type { CaptureAiProposal, CaptureProposalTarget } from "@uwe/database/server";
import { readModelJson } from "../model-json";

const VALID_TARGETS = new Set<CaptureProposalTarget>([
  "personal_project",
  "workshop_project",
  "dnd_page",
  "hardware_device",
  "contract_expense",
  "life_brain",
  "inbox",
]);

export interface RtxCaptureProposalInput {
  title: string;
  content: string;
  captureType: string;
  url?: string | null;
}

export function buildRtxCaptureProposalPrompt(input: RtxCaptureProposalInput): string {
  return [
    "Du klassifizierst eine private Capture-Inbox-Notiz für ein lokales Admin-Tool.",
    "Antworte NUR mit JSON ohne Markdown:",
    "{",
    '  "suggestedTarget": "personal_project|workshop_project|dnd_page|hardware_device|contract_expense|life_brain|inbox",',
    '  "suggestedCategory": "string",',
    '  "suggestedTags": ["tag1","tag2"],',
    '  "suggestedNextAction": "string",',
    '  "confidence": "low|medium|high",',
    '  "reasoning": "kurze Begründung"',
    "}",
    "",
    `Titel: ${input.title}`,
    `Typ: ${input.captureType}`,
    input.url ? `URL: ${input.url}` : "",
    `Inhalt: ${input.content.slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseRtxCaptureProposalResponse(
  raw: string,
  fallback: CaptureAiProposal,
): CaptureAiProposal {
  /* Was `raw.match(/\{[\s\S]*\}/)` — greedy to the LAST brace in the answer,
     so any prose containing a `}` after the object swallowed it and the whole
     proposal fell back. `readModelJson` strips fences and scans to the
     BALANCED brace instead; same shared reader as the Brain proposals. */
  const parsed = readModelJson(raw);
  if (!parsed) {
    return fallback;
  }

  try {
    const suggestedTarget = String(parsed.suggestedTarget ?? fallback.suggestedTarget);
    const confidence = String(parsed.confidence ?? fallback.confidence);
    const tags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.filter((entry): entry is string => typeof entry === "string")
      : fallback.suggestedTags;

    return {
      status: "draft",
      generatedAt: new Date().toISOString(),
      source: "rtx",
      suggestedTarget: VALID_TARGETS.has(suggestedTarget as CaptureProposalTarget)
        ? (suggestedTarget as CaptureProposalTarget)
        : fallback.suggestedTarget,
      suggestedCategory:
        typeof parsed.suggestedCategory === "string"
          ? parsed.suggestedCategory
          : fallback.suggestedCategory,
      suggestedTags: tags,
      suggestedNextAction:
        typeof parsed.suggestedNextAction === "string"
          ? parsed.suggestedNextAction
          : fallback.suggestedNextAction,
      confidence:
        confidence === "low" || confidence === "medium" || confidence === "high"
          ? confidence
          : fallback.confidence,
    };
  } catch {
    return fallback;
  }
}
