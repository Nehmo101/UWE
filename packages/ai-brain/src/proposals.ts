import { validateTerraWorldDraft } from "./proposal-validators/terra-world-draft";
import { readModelJson } from "./model-json";
import type { BrainActionDefinition } from "./actions";
import type { AiProposalTargetType } from "./actions";

export type AiProposalStatus = "pending" | "applied" | "discarded";

export interface AiProposal {
  id: string;
  label: string;
  content: string;
  targetType: AiProposalTargetType;
  targetId?: string | null;
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
        status: "pending",
        metadata: {
          documentType: "general",
          source: "ai_generated",
        },
      },
    ];
  }

  if (action.id === "create_knowledge_text") {
    return [
      {
        id: `${baseId}-knowledge`,
        label: action.defaultProposalLabel,
        content: resultText.trim(),
        targetType: "brain_document",
        targetId: pageId ?? null,
        status: "pending",
        metadata: {
          documentType: "world_knowledge",
          source: "ai_generated",
          subject: action.defaultProposalLabel,
        },
      },
    ];
  }

  /* The two Terra text actions produce prose. No validator runs on them: the
     answer IS the proposal, it is read by a human and never applied
     automatically (`autoApply: false`). */
  if (action.id === "terra_name_regions" || action.id === "terra_describe_region") {
    return [
      {
        id: `${baseId}-${action.id}`,
        label: action.defaultProposalLabel,
        content: resultText.trim(),
        targetType: action.defaultProposalTarget,
        targetId: pageId ?? null,
        status: "pending",
        metadata: {
          source: "ai_generated",
          autoApply: false,
        },
      },
    ];
  }

  if (action.id === "terra_world_draft") {
    /* This validator CLAMPS instead of rejecting: an unusable answer would
       leave the user with nothing, a clamped one leaves them with a boring map
       they can edit. `content` therefore always holds the validated draft when
       the answer was JSON at all — what the model lost is listed in `notices`,
       and the panel shows it.

       `readModelJson` is the one shared reader (fences, preamble, balanced
       braces). By the time we get here the router has already spent its single
       repair attempt on this text; if it is still not JSON, the validator says
       so and the panel shows the raw answer. */
    const parsed = readModelJson(resultText);
    const validation = validateTerraWorldDraft(parsed);
    return [
      {
        id: `${baseId}-terra-world-draft`,
        label: action.defaultProposalLabel,
        content: validation.ok
          ? JSON.stringify(validation.draft, null, 2)
          : resultText.trim(),
        targetType: "terra_world_draft",
        targetId: pageId ?? null,
        status: "pending",
        metadata: {
          source: "ai_generated",
          autoApply: false,
          proposalKind: "terra_world_draft",
          validation: validation.ok ? "ok" : "invalid",
          ...(validation.ok
            ? { notices: validation.notices }
            : { errors: validation.errors }),
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
