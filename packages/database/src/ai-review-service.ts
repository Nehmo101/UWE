import type { PrismaClient } from "./client";
import { createActivityLogService } from "./activity-log-service";
import type {
  AiProposalApplyMode,
  ApplyAiProposalInput,
  AiProposalView,
  GeneratedPatch,
  RecordAiRunInput,
  RecordAiRunResult,
} from "./ai-proposal-types";
import { buildGeneratedPatch, suggestApplyMode } from "./ai-proposal-types";
import { BrainStoreService } from "./brain-store-service";
import { GameSessionService } from "./game-session";
import { buildPageUrl } from "./page-types";
import { UweRepository } from "./repository";
import { toPrismaJsonValue } from "./json-utils";
import { createUndoService } from "./undo-service";

export interface ApplyBrainProposalInput {
  runId: string;
  proposalId: string;
  editedContent?: string;
  ideaTitle?: string;
}

export interface JsonBrainProposal {
  id: string;
  label: string;
  content: string;
  targetType: string;
  targetId?: string | null;
  visibility?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ApplyAiProposalResult {
  ok: boolean;
  message: string;
  proposal?: AiProposalView;
  undoEntryId?: string;
  appliedTargetType?: string;
  appliedTargetId?: string;
}

export class AiReviewService {
  constructor(private readonly db: PrismaClient) {}

  private get activity() {
    return createActivityLogService(this.db);
  }

  private get undo() {
    return createUndoService(this.db);
  }

  /**
   * Create a pending proposal for an already completed AI run.
   * Generation itself never writes productive content.
   */
  async createProposalFromRun(input: RecordAiRunInput): Promise<RecordAiRunResult> {
    const run = await this.db.aiRun.findUnique({ where: { id: input.aiRunId } });
    if (!run) throw new Error(`AI Run ${input.aiRunId} nicht gefunden.`);
    if (run.status !== "completed") {
      throw new Error(`AI Run ${input.aiRunId} ist nicht abgeschlossen (Status: ${run.status}).`);
    }

    const patch = buildGeneratedPatch({
      taskType: input.taskType,
      sourcePageId: input.pageId,
      sessionId: input.sessionId,
      content: input.resultText,
      title: input.title,
    });
    const suggestedMode = suggestApplyMode(input.taskType);

    await this.db.aiRun.update({
      where: { id: input.aiRunId },
      data: { proposals: toPrismaJsonValue([patch]) },
    });

    const proposal = await this.db.aiProposal.create({
      data: {
        aiRunId: input.aiRunId,
        worldId: input.worldId,
        suggestedMode,
        patch: toPrismaJsonValue(patch),
        resultText: input.resultText,
        sourcePageId: input.pageId,
        sessionId: input.sessionId ?? null,
      },
      include: { aiRun: true },
    });

    return {
      runId: input.aiRunId,
      proposal: this.toView(proposal),
    };
  }

  async getProposal(proposalId: string): Promise<AiProposalView | null> {
    const proposal = await this.db.aiProposal.findUnique({
      where: { id: proposalId },
      include: { aiRun: true },
    });
    return proposal ? this.toView(proposal) : null;
  }

  async listPendingProposals(worldId: string, limit = 20): Promise<AiProposalView[]> {
    const proposals = await this.db.aiProposal.findMany({
      where: { worldId, status: "pending" },
      include: { aiRun: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return proposals.map((entry) => this.toView(entry));
  }

  /** Persist JSON proposals from a completed brain action run (P08 + P09 bridge). */
  async syncJsonProposalsFromRun(
    runId: string,
    jsonProposals: JsonBrainProposal[],
  ): Promise<void> {
    const run = await this.db.aiRun.findUnique({ where: { id: runId } });
    if (!run?.worldId) return;

    for (const json of jsonProposals) {
      const existing = await this.db.aiProposal.findUnique({ where: { id: json.id } });
      if (existing) continue;

      const patch = buildGeneratedPatch({
        taskType: run.taskType,
        sourcePageId: run.pageId ?? "",
        sessionId: run.gameSessionId ?? undefined,
        content: json.content,
        title: json.label,
      });

      await this.db.aiProposal.create({
        data: {
          id: json.id,
          aiRunId: runId,
          worldId: run.worldId,
          suggestedMode: this.mapTargetToApplyMode(json.targetType),
          patch: JSON.parse(
            JSON.stringify({
              ...patch,
              brainTargetType: json.targetType,
              brainMetadata: json.metadata ?? null,
            }),
          ),
          resultText: json.content,
          sourcePageId: run.pageId,
          sessionId: json.targetId && json.targetType.includes("session") ? json.targetId : run.gameSessionId,
          status: json.status === "applied" ? "applied" : json.status === "discarded" ? "discarded" : "pending",
        },
      });
    }
  }

  /** Apply a brain-action JSON proposal with audit log and undo snapshot. */
  async applyBrainProposal(input: ApplyBrainProposalInput): Promise<ApplyAiProposalResult> {
    const proposal = await this.db.aiProposal.findUnique({
      where: { id: input.proposalId },
      include: { aiRun: { include: { world: true, page: true } } },
    });

    if (!proposal || proposal.aiRunId !== input.runId) {
      return { ok: false, message: "Vorschlag nicht gefunden." };
    }

    const patch = proposal.patch as unknown as GeneratedPatch & {
      brainTargetType?: string;
      brainMetadata?: Record<string, unknown>;
    };
    const targetType = patch.brainTargetType ?? patch.operation;
    const mode = this.mapTargetToApplyMode(String(targetType));

    if (targetType === "session_summary_dm") {
      return this.applySessionSummaryDm(proposal, input);
    }
    if (targetType === "brain_document" || targetType === "mail_draft") {
      return this.applyBrainDocument(proposal, input, targetType === "mail_draft");
    }
    if (targetType === "idea_page") {
      return this.applyProposal(proposal.id, {
        mode: "idea",
        title: input.ideaTitle ?? patch.label,
        editedText: input.editedContent,
      });
    }
    if (targetType === "session_summary_player") {
      return this.applyProposal(proposal.id, {
        mode: "player_recap",
        editedText: input.editedContent,
        sessionId: proposal.sessionId ?? undefined,
      });
    }

    return this.applyProposal(proposal.id, {
      mode: mode === "player_recap" ? "content_block" : mode,
      editedText: input.editedContent,
      title: input.ideaTitle,
      sessionId: proposal.sessionId ?? undefined,
    });
  }

  async discardBrainRun(runId: string): Promise<ApplyAiProposalResult> {
    const proposals = await this.db.aiProposal.findMany({
      where: { aiRunId: runId, status: "pending" },
    });

    if (proposals.length === 0) {
      const run = await this.db.aiRun.findUnique({ where: { id: runId } });
      if (!run) return { ok: false, message: "AI Run nicht gefunden." };
      await this.db.aiRun.update({
        where: { id: runId },
        data: { status: "discarded", discardedAt: new Date() },
      });
      return { ok: true, message: "Run verworfen." };
    }

    for (const proposal of proposals) {
      await this.discardProposal(proposal.id);
    }
    return { ok: true, message: "Alle Vorschläge verworfen." };
  }

  private mapTargetToApplyMode(targetType: string): AiProposalApplyMode {
    if (targetType === "idea_page") return "idea";
    if (targetType === "session_summary_player") return "player_recap";
    return "content_block";
  }

  private async applySessionSummaryDm(
    proposal: {
      id: string;
      aiRunId: string;
      worldId: string;
      resultText: string;
      editedText: string | null;
      sessionId: string | null;
      patch: unknown;
      aiRun: { taskType: string; world: { slug: string } | null; page: { title: string } | null };
    },
    input: ApplyBrainProposalInput,
  ): Promise<ApplyAiProposalResult> {
    const sessionId = proposal.sessionId;
    if (!sessionId) return { ok: false, message: "Session-ID fehlt für DM-Recap." };

    const content = (input.editedContent ?? proposal.editedText ?? proposal.resultText).trim();
    if (!content) return { ok: false, message: "Kein Inhalt zum Übernehmen." };

    const sessions = new GameSessionService(this.db);
    const session = await sessions.getById(sessionId);
    if (!session) return { ok: false, message: "Session nicht gefunden." };

    const undoEntry = await this.undo.captureSessionSummaryDm(sessionId);
    await sessions.update(sessionId, { summaryDm: content });

    return this.finalizeBrainApply(proposal, {
      content,
      applyAction: input.editedContent ? "edit_apply" : "apply",
      undoEntryId: undoEntry.id,
      appliedTargetType: "game_session",
      appliedTargetId: sessionId,
      summary: `KI-Vorschlag als DM-Session-Recap für „${session.title}“ übernommen.`,
      mode: "content_block",
    });
  }

  private async applyBrainDocument(
    proposal: {
      id: string;
      aiRunId: string;
      worldId: string;
      resultText: string;
      editedText: string | null;
      sourcePageId: string | null;
      sessionId: string | null;
      patch: unknown;
      aiRun: {
        id: string;
        taskType: string;
        pageId: string | null;
        gameSessionId: string | null;
        world: { slug: string } | null;
      };
    },
    input: ApplyBrainProposalInput,
    mailDraft: boolean,
  ): Promise<ApplyAiProposalResult> {
    const patch = proposal.patch as GeneratedPatch & {
      brainMetadata?: Record<string, unknown>;
    };
    const content = (input.editedContent ?? proposal.editedText ?? proposal.resultText).trim();
    if (!content) return { ok: false, message: "Kein Inhalt zum Übernehmen." };

    const brainStore = new BrainStoreService(this.db);
    const subject =
      typeof patch.brainMetadata?.subject === "string"
        ? patch.brainMetadata.subject
        : patch.label ?? "Brain-Dokument";

    const doc = await brainStore.createDocument({
      worldId: proposal.worldId,
      pageId: proposal.sourcePageId ?? proposal.aiRun.pageId ?? undefined,
      gameSessionId: proposal.sessionId ?? proposal.aiRun.gameSessionId ?? undefined,
      title: mailDraft ? `Mail: ${subject}` : (patch.label ?? "KI-Vorschlag"),
      content,
      documentType: mailDraft ? "session_summary" : "general",
      visibility: mailDraft ? "player_visible" : "dm_only",
      source: "ai_generated",
      status: "draft",
      metadata: {
        aiRunId: proposal.aiRunId,
        proposalId: proposal.id,
        mailDraft,
        subject: mailDraft ? subject : undefined,
        autoSend: false,
      },
    });

    const undoEntry = await this.undo.captureBrainDocumentCreate(doc.id, proposal.worldId);

    return this.finalizeBrainApply(proposal, {
      content,
      applyAction: input.editedContent ? "edit_apply" : "apply",
      undoEntryId: undoEntry.id,
      appliedTargetType: mailDraft ? "brain_document" : "brain_document",
      appliedTargetId: doc.id,
      summary: mailDraft
        ? `KI-Mail-Entwurf gespeichert (nicht versendet): „${subject}“`
        : `KI-Vorschlag als Brain-Dokument „${doc.title}“ übernommen.`,
      mode: "content_block",
      targetHref: `/worlds/${proposal.aiRun.world?.slug ?? ""}/brain`,
    });
  }

  private async finalizeBrainApply(
    proposal: {
      id: string;
      aiRunId: string;
      worldId: string;
      aiRun: { taskType: string; world: { slug: string } | null };
    },
    options: {
      content: string;
      applyAction: "apply" | "edit_apply";
      undoEntryId: string;
      appliedTargetType: string;
      appliedTargetId: string;
      summary: string;
      mode: AiProposalApplyMode;
      targetHref?: string;
    },
  ): Promise<ApplyAiProposalResult> {
    const now = new Date();
    const worldSlug = proposal.aiRun.world?.slug ?? undefined;

    await this.db.aiProposal.update({
      where: { id: proposal.id },
      data: {
        status: "applied",
        appliedAt: now,
        appliedTargetType: options.appliedTargetType as
        | "page"
        | "content_block"
        | "game_session"
        | "brain_document"
        | "ai_proposal",
        appliedTargetId: options.appliedTargetId,
      },
    });

    await this.db.aiRun.update({
      where: { id: proposal.aiRunId },
      data: {
        status: "applied",
        appliedAt: now,
        targetType: options.appliedTargetType,
        targetId: options.appliedTargetId,
      },
    });

    await this.db.aiApplyLog.create({
      data: {
        proposalId: proposal.id,
        aiRunId: proposal.aiRunId,
        worldId: proposal.worldId,
        action: options.applyAction,
        summary: options.summary,
        undoEntryId: options.undoEntryId,
        details: {
          mode: options.mode,
          appliedTargetType: options.appliedTargetType,
          appliedTargetId: options.appliedTargetId,
        },
      },
    });

    await this.activity.log({
      worldId: proposal.worldId,
      worldSlug,
      action: "ai_proposal_applied",
      targetType: "ai_proposal",
      targetId: proposal.id,
      targetLabel: proposal.aiRun.taskType,
      targetHref: options.targetHref,
      summary: options.summary,
      details: { aiRunId: proposal.aiRunId, mode: options.mode },
      undoEntryId: options.undoEntryId,
    });

    const refreshed = await this.getProposal(proposal.id);
    return {
      ok: true,
      message: options.summary,
      proposal: refreshed ?? undefined,
      undoEntryId: options.undoEntryId,
      appliedTargetType: options.appliedTargetType,
      appliedTargetId: options.appliedTargetId,
    };
  }

  async discardProposal(
    proposalId: string,
    options?: { reason?: string; action?: "discard" | "rerun" },
  ): Promise<ApplyAiProposalResult> {
    const proposal = await this.db.aiProposal.findUnique({
      where: { id: proposalId },
      include: { aiRun: { include: { page: true, world: true } } },
    });
    if (!proposal) return { ok: false, message: "Vorschlag nicht gefunden." };
    if (proposal.status !== "pending") {
      return { ok: false, message: `Vorschlag ist bereits ${proposal.status}.` };
    }

    const now = new Date();
    const action = options?.action ?? "discard";

    await this.db.aiProposal.update({
      where: { id: proposalId },
      data: {
        status: action === "rerun" ? "superseded" : "discarded",
        discardedAt: now,
      },
    });

    await this.db.aiRun.update({
      where: { id: proposal.aiRunId },
      data: { status: "discarded", discardedAt: now },
    });

    const worldSlug = proposal.aiRun.world?.slug ?? undefined;
    const summary =
      action === "rerun"
        ? `KI-Vorschlag verworfen (Neu-Generierung): ${proposal.aiRun.taskType}`
        : `KI-Vorschlag verworfen: ${proposal.aiRun.taskType}`;

    await this.db.aiApplyLog.create({
      data: {
        proposalId,
        aiRunId: proposal.aiRunId,
        worldId: proposal.worldId,
        action: action === "rerun" ? "rerun" : "discard",
        summary,
        details: options?.reason ? { reason: options.reason } : undefined,
      },
    });

    await this.activity.log({
      worldId: proposal.worldId,
      worldSlug,
      action: "ai_proposal_discarded",
      targetType: "ai_proposal",
      targetId: proposalId,
      targetLabel: proposal.aiRun.taskType,
      summary,
      details: { aiRunId: proposal.aiRunId, action },
    });

    const refreshed = await this.getProposal(proposalId);
    return { ok: true, message: "Vorschlag verworfen.", proposal: refreshed ?? undefined };
  }

  /**
   * Explicit apply: snapshots previous state, writes productive data, logs audit.
   */
  async applyProposal(
    proposalId: string,
    input: ApplyAiProposalInput,
  ): Promise<ApplyAiProposalResult> {
    const proposal = await this.db.aiProposal.findUnique({
      where: { id: proposalId },
      include: {
        aiRun: {
          include: {
            world: true,
            page: true,
          },
        },
      },
    });

    if (!proposal) return { ok: false, message: "Vorschlag nicht gefunden." };
    if (proposal.status !== "pending") {
      return { ok: false, message: `Vorschlag ist bereits ${proposal.status}.` };
    }

    const patch = proposal.patch as unknown as GeneratedPatch;
    if (!patch.allowedModes.includes(input.mode)) {
      return {
        ok: false,
        message: `Modus „${input.mode}“ ist für diesen Vorschlag nicht erlaubt.`,
      };
    }

    const content = (input.editedText ?? proposal.editedText ?? proposal.resultText).trim();
    if (!content) {
      return { ok: false, message: "Kein Inhalt zum Übernehmen vorhanden." };
    }

    const repo = new UweRepository(this.db);
    const world = proposal.aiRun.world;
    const sourcePage = proposal.aiRun.page;
    if (!world || !sourcePage) {
      return { ok: false, message: "Welt oder Quellseite nicht mehr vorhanden." };
    }

    const worldSlug = world.slug;
    let undoEntryId: string | undefined;
    let appliedTargetType: string | undefined;
    let appliedTargetId: string | undefined;
    let applySummary = "";
    let targetHref: string | undefined;
    const edited = Boolean(input.editedText && input.editedText !== proposal.resultText);
    const applyAction = edited ? "edit_apply" : "apply";

    try {
      if (input.mode === "idea") {
        const title =
          input.title?.trim() ||
          `KI-Idee: ${sourcePage.title}`;
        const slugBase = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40);
        const slug = `idee-${slugBase}-${Date.now().toString(36)}`;

        const idea = await repo.createIdeaPage({
          worldId: world.id,
          title,
          slug,
          type: (patch.payload.pageType as "note" | "npc" | "location" | "encounter") ?? "note",
          content,
          sourcePageId: sourcePage.id,
          taskType: proposal.aiRun.taskType,
          metadata: {
            aiRunId: proposal.aiRunId,
            proposalId,
            ...(patch.payload.metadata ?? {}),
          },
        });

        undoEntryId = (
          await this.undo.captureAiPageCreate(idea.id, world.id)
        ).id;
        appliedTargetType = "page";
        appliedTargetId = idea.id;
        applySummary = `KI-Vorschlag als Idee-Seite „${title}“ übernommen.`;
        targetHref = buildPageUrl(worldSlug, idea.type, idea.slug);
      } else if (input.mode === "content_block") {
        const sortOrder = await repo.getNextContentBlockSortOrder(sourcePage.id);
        const block = await repo.addContentBlock(sourcePage.id, {
          type: "ai_summary",
          sortOrder,
          content,
          visibility: "dm_only",
          metadata: JSON.parse(
            JSON.stringify({
              aiRunId: proposal.aiRunId,
              proposalId,
              source: "ai_brain",
              taskType: proposal.aiRun.taskType,
              isProposalApplied: true,
              ...(patch.payload.metadata ?? {}),
            }),
          ),
        });

        undoEntryId = (
          await this.undo.captureAiBlockCreate(block.id, world.id)
        ).id;
        appliedTargetType = "content_block";
        appliedTargetId = block.id;
        applySummary = `KI-Vorschlag als ContentBlock auf „${sourcePage.title}“ übernommen.`;
        targetHref = `${buildPageUrl(worldSlug, sourcePage.type, sourcePage.slug)}/edit`;
      } else {
        const sessionId = input.sessionId ?? proposal.sessionId;
        if (!sessionId) {
          return { ok: false, message: "sessionId ist für Spieler-Recap erforderlich." };
        }

        const session = await repo.getGameSessionById(sessionId);
        if (!session || session.worldId !== world.id) {
          return { ok: false, message: "Session nicht gefunden." };
        }

        undoEntryId = (
          await this.undo.captureSessionRecap(sessionId)
        ).id;

        await repo.updateGameSessionPlayerRecap(sessionId, content);
        appliedTargetType = "game_session";
        appliedTargetId = sessionId;
        applySummary = `KI-Vorschlag als Spieler-Recap für Session „${session.title}“ übernommen.`;
        targetHref = `/worlds/${worldSlug}/sessions/${sessionId}`;
      }

      const now = new Date();
      await this.db.aiProposal.update({
        where: { id: proposalId },
        data: {
          status: "applied",
          appliedAt: now,
          editedText: input.editedText ?? proposal.editedText,
          appliedTargetType: appliedTargetType as "page" | "content_block" | "game_session",
          appliedTargetId,
        },
      });

      await this.db.aiRun.update({
        where: { id: proposal.aiRunId },
        data: {
          status: "applied",
          appliedAt: now,
          targetType: appliedTargetType,
          targetId: appliedTargetId,
        },
      });

      await this.db.aiApplyLog.create({
        data: {
          proposalId,
          aiRunId: proposal.aiRunId,
          worldId: proposal.worldId,
          action: applyAction,
          summary: applySummary,
          undoEntryId: undoEntryId ?? null,
          details: {
            mode: input.mode,
            edited,
            appliedTargetType,
            appliedTargetId,
          },
        },
      });

      await this.activity.log({
        worldId: world.id,
        worldSlug,
        action: "ai_proposal_applied",
        targetType: "ai_proposal",
        targetId: proposalId,
        targetLabel: proposal.aiRun.taskType,
        targetHref,
        summary: applySummary,
        details: {
          aiRunId: proposal.aiRunId,
          mode: input.mode,
          appliedTargetType,
          appliedTargetId,
        },
        undoEntryId,
      });

      const refreshed = await this.getProposal(proposalId);
      return {
        ok: true,
        message: applySummary,
        proposal: refreshed ?? undefined,
        undoEntryId,
        appliedTargetType,
        appliedTargetId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Übernahme fehlgeschlagen.";
      await this.activity.log({
        worldId: proposal.worldId,
        worldSlug,
        action: "error",
        targetType: "ai_proposal",
        targetId: proposalId,
        summary: `KI-Vorschlag konnte nicht übernommen werden: ${message}`,
      });
      return { ok: false, message };
    }
  }

  private toView(
    entry: {
      id: string;
      aiRunId: string;
      worldId: string;
      status: string;
      suggestedMode: string;
      patch: unknown;
      resultText: string;
      editedText: string | null;
      sourcePageId: string | null;
      sessionId: string | null;
      appliedTargetType: string | null;
      appliedTargetId: string | null;
      appliedAt: Date | null;
      discardedAt: Date | null;
      createdAt: Date;
      aiRun: { taskType: string; provider: string; model: string };
    },
  ): AiProposalView {
    return {
      id: entry.id,
      aiRunId: entry.aiRunId,
      worldId: entry.worldId,
      status: entry.status,
      suggestedMode: entry.suggestedMode as AiProposalApplyMode,
      patch: entry.patch as GeneratedPatch,
      resultText: entry.resultText,
      editedText: entry.editedText,
      sourcePageId: entry.sourcePageId,
      sessionId: entry.sessionId,
      appliedTargetType: entry.appliedTargetType,
      appliedTargetId: entry.appliedTargetId,
      appliedAt: entry.appliedAt,
      discardedAt: entry.discardedAt,
      createdAt: entry.createdAt,
      taskType: entry.aiRun.taskType,
      provider: entry.aiRun.provider,
      model: entry.aiRun.model,
    };
  }
}

export function createAiReviewService(db: PrismaClient): AiReviewService {
  return new AiReviewService(db);
}

export type {
  AiProposalApplyMode,
  AiProposalView,
  ApplyAiProposalInput,
  GeneratedPatch,
  RecordAiRunInput,
  RecordAiRunResult,
} from "./ai-proposal-types";

export {
  allowedApplyModes,
  buildGeneratedPatch,
  suggestApplyMode,
} from "./ai-proposal-types";
