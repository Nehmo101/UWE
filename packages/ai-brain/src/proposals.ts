import type { BrainActionDefinition } from "./actions";
import type { AiProposalTargetType } from "./actions";

export type AiProposalStatus = "pending" | "applied" | "discarded";

export interface AiProposal {
  id: string;
  label: string;
  content: string;
  targetType: AiProposalTargetType;
  targetId?: string | null;
  visibility?: "dm_only" | "player_visible" | "public";
  status: AiProposalStatus;
  metadata?: Record<string, unknown>;
}

export interface BuildProposalInput {
  action: BrainActionDefinition;
  resultText: string;
  pageId?: string;
  sessionId?: string;
  worldId?: string;
}

function extractMailSubject(text: string): { subject: string; body: string } {
  const subjectMatch = text.match(/^Betreff:\s*(.+)$/m);
  if (subjectMatch) {
    const subject = subjectMatch[1]?.trim() ?? "Session-Update";
    const body = text.replace(/^Betreff:\s*.+\n?/m, "").trim();
    return { subject, body };
  }
  return { subject: "Session-Update", body: text.trim() };
}

export function buildProposalsFromResult(input: BuildProposalInput): AiProposal[] {
  const { action, resultText, pageId, sessionId } = input;
  const baseId = `proposal-${Date.now().toString(36)}`;

  if (action.id === "mail_draft") {
    const { subject, body } = extractMailSubject(resultText);
    return [
      {
        id: `${baseId}-mail`,
        label: action.defaultProposalLabel,
        content: body,
        targetType: "mail_draft",
        targetId: sessionId ?? pageId ?? null,
        visibility: "player_visible",
        status: "pending",
        metadata: {
          subject,
          mailDraft: true,
          autoSend: false,
        },
      },
    ];
  }

  if (action.id === "session_recap" && sessionId) {
    return [
      {
        id: `${baseId}-dm`,
        label: action.defaultProposalLabel,
        content: resultText.trim(),
        targetType: "session_summary_dm",
        targetId: sessionId,
        visibility: "dm_only",
        status: "pending",
      },
    ];
  }

  if (action.id === "player_handout") {
    return [
      {
        id: `${baseId}-handout`,
        label: action.defaultProposalLabel,
        content: resultText.trim(),
        targetType: "brain_document",
        targetId: pageId ?? null,
        visibility: "player_visible",
        status: "pending",
        metadata: {
          documentType: "general",
          source: "ai_generated",
        },
      },
    ];
  }

  return [
    {
      id: `${baseId}-main`,
      label: action.defaultProposalLabel,
      content: resultText.trim(),
      targetType: action.defaultProposalTarget,
      targetId: pageId ?? sessionId ?? null,
      visibility: action.playerSafe ? "player_visible" : "dm_only",
      status: "pending",
    },
  ];
}

export function parseProposals(value: unknown): AiProposal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is AiProposal =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as AiProposal).id === "string" &&
      typeof (item as AiProposal).content === "string",
  );
}

export function markProposalStatus(
  proposals: AiProposal[],
  proposalId: string,
  status: AiProposalStatus,
): AiProposal[] {
  return proposals.map((proposal) =>
    proposal.id === proposalId ? { ...proposal, status } : proposal,
  );
}
