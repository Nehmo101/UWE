import type { PrismaClient } from "@uwe/database/client";
import {
  buildPageReviewPatch,
  combineBlockContent,
  createAiReviewService,
  createJobService,
  syncAiProposalReview,
  toPrismaJsonValue,
  UweRepository,
  type GeneratedPatch,
} from "@uwe/database/server";
import type { PublishStatus } from "@uwe/database/enums";
import {
  parseSuggestedTags,
  resolveReviewTaskType,
  type PageReviewDetail,
  type PageReviewListItem,
  type StartBulkReviewInput,
  type StartBulkReviewResult,
} from "./types";

export class PageAiReviewService {
  constructor(private readonly db: PrismaClient) {}

  private get review() {
    return createAiReviewService(this.db);
  }

  private get jobs() {
    return createJobService(this.db);
  }

  /**
   * The proposal's `patch` column is stored as JSON, so it is untyped at
   * runtime. Guard the `payload` before callers read `patch.payload.*`, turning
   * a missing/corrupt patch into a clear error instead of a raw TypeError.
   */
  private asGeneratedPatch(patch: unknown): GeneratedPatch {
    const payload =
      patch && typeof patch === "object" ? (patch as { payload?: unknown }).payload : undefined;
    if (!payload || typeof payload !== "object") {
      throw new Error("AI review proposal patch is missing its payload");
    }
    return patch as GeneratedPatch;
  }

  async countOpenReviews(worldSlug: string): Promise<number> {
    const repo = new UweRepository(this.db);
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) return 0;

    return this.db.page.count({
      where: { worldId: world.id, publishStatus: "review" },
    });
  }

  async startBulkReview(input: StartBulkReviewInput): Promise<StartBulkReviewResult> {
    const repo = new UweRepository(this.db);
    const world = await repo.getWorldBySlug(input.worldSlug);
    if (!world) {
      return { ok: false, message: "Welt nicht gefunden.", jobIds: [] };
    }

    const taskType = resolveReviewTaskType(input.action);
    const jobIds: string[] = [];

    for (const pageId of input.pageIds) {
      const page = await repo.getPageById(pageId);
      if (!page || page.worldId !== world.id) continue;

      const originalContent = combineBlockContent(page.contentBlocks);
      const job = await this.jobs.enqueue({
        type: "ai_run",
        title: `KI-Review · ${page.title}`,
        worldId: world.id,
        worldSlug: input.worldSlug,
        userId: input.userId ?? null,
        relatedType: "page",
        relatedId: page.id,
        payload: {
          taskType,
          worldSlug: input.worldSlug,
          pageSlug: page.slug,
          providerId: input.providerId,
          model: input.model,
          userPrompt: input.userPrompt,
          pageReview: true,
          pageReviewAction: input.action,
          originalContent,
          previousPublishStatus: page.publishStatus,
        },
      });
      jobIds.push(job.id);
    }

    if (jobIds.length === 0) {
      return { ok: false, message: "Keine gültigen Seiten für KI-Review gefunden.", jobIds: [] };
    }

    return {
      ok: true,
      message: `${jobIds.length} KI-Review-Job(s) gestartet.`,
      jobIds,
    };
  }

  async onProposalReady(proposalId: string): Promise<void> {
    const proposal = await this.db.aiProposal.findUnique({
      where: { id: proposalId },
      include: {
        aiRun: { include: { world: true, page: true } },
      },
    });
    if (!proposal?.aiRun.page || !proposal.aiRun.world) return;

    const patch = this.asGeneratedPatch(proposal.patch);
    const repo = new UweRepository(this.db);
    const pageWithBlocks = await repo.getPageById(proposal.aiRun.page.id);
    const originalContent =
      patch.payload.originalContent ??
      (pageWithBlocks ? combineBlockContent(pageWithBlocks.contentBlocks) : "");

    let resultText = proposal.resultText;
    let suggestedTags = patch.payload.suggestedTags ?? [];

    if (proposal.aiRun.taskType === "suggest_page_tags") {
      suggestedTags = parseSuggestedTags(proposal.resultText);
      resultText = originalContent;
    }

    const updatedPatch = buildPageReviewPatch({
      taskType: proposal.aiRun.taskType,
      sourcePageId: proposal.sourcePageId ?? proposal.aiRun.page.id,
      content: resultText,
      originalContent,
      previousPublishStatus:
        patch.payload.previousPublishStatus ?? proposal.aiRun.page.publishStatus,
      suggestedTags,
      title: proposal.aiRun.page.title,
    });

    await this.db.aiProposal.update({
      where: { id: proposalId },
      data: {
        suggestedMode: "replace_content",
        patch: toPrismaJsonValue(updatedPatch),
        resultText,
        editedText: resultText,
      },
    });

    await this.db.page.update({
      where: { id: proposal.aiRun.page.id },
      data: { publishStatus: "review" },
    });

    const worldSlug = proposal.aiRun.world.slug;
    await syncAiProposalReview(this.db, {
      proposalId,
      worldId: proposal.worldId,
      worldSlug,
      title: `Review: ${proposal.aiRun.page.title}`,
      summary: resultText.slice(0, 200),
      resultText,
      originalContent,
      targetHref: `/worlds/${worldSlug}/page-review/${proposal.aiRun.page.id}`,
    });
  }

  async onRefineReady(parentProposalId: string, resultText: string, userPrompt: string): Promise<void> {
    const proposal = await this.db.aiProposal.findUnique({ where: { id: parentProposalId } });
    if (!proposal) return;

    const patch = this.asGeneratedPatch(proposal.patch);
    const chatHistory = Array.isArray(patch.payload.metadata?.chatHistory)
      ? [...(patch.payload.metadata!.chatHistory as Array<{ role: string; content: string; createdAt: string }>)]
      : [];

    chatHistory.push(
      { role: "user", content: userPrompt, createdAt: new Date().toISOString() },
      { role: "assistant", content: resultText, createdAt: new Date().toISOString() },
    );

    const updatedPatch: GeneratedPatch = {
      ...patch,
      payload: {
        ...patch.payload,
        metadata: {
          ...(patch.payload.metadata ?? {}),
          chatHistory,
        },
      },
    };

    await this.db.aiProposal.update({
      where: { id: parentProposalId },
      data: {
        editedText: resultText,
        patch: toPrismaJsonValue(updatedPatch),
      },
    });
  }

  async listReviewPages(worldSlug: string): Promise<PageReviewListItem[]> {
    const repo = new UweRepository(this.db);
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) return [];

    const pages = await this.db.page.findMany({
      where: { worldId: world.id, publishStatus: "review" },
      orderBy: { updatedAt: "desc" },
    });

    const items: PageReviewListItem[] = [];
    for (const page of pages) {
      const proposal = await this.db.aiProposal.findFirst({
        where: { sourcePageId: page.id, status: "pending", worldId: world.id },
        include: { aiRun: true },
        orderBy: { createdAt: "desc" },
      });
      if (!proposal) continue;

      items.push({
        pageId: page.id,
        pageTitle: page.title,
        pageSlug: page.slug,
        pageType: page.type,
        proposalId: proposal.id,
        taskType: proposal.aiRun.taskType,
        updatedAt: page.updatedAt.toISOString(),
        href: `/worlds/${worldSlug}/page-review/${page.id}`,
      });
    }

    return items;
  }

  async getReviewDetail(worldSlug: string, pageId: string): Promise<PageReviewDetail | null> {
    const repo = new UweRepository(this.db);
    const page = await repo.getPageById(pageId);
    if (!page) return null;

    const world = await repo.getWorldBySlug(worldSlug);
    if (!world || page.worldId !== world.id) return null;

    const proposal = await this.db.aiProposal.findFirst({
      where: { sourcePageId: page.id, status: "pending", worldId: world.id },
      include: { aiRun: true },
      orderBy: { createdAt: "desc" },
    });
    if (!proposal) return null;

    const patch = this.asGeneratedPatch(proposal.patch);
    const originalContent =
      patch.payload.originalContent ?? combineBlockContent(page.contentBlocks);
    const chatHistory = Array.isArray(patch.payload.metadata?.chatHistory)
      ? (patch.payload.metadata!.chatHistory as PageReviewDetail["chatHistory"])
      : [];

    return {
      pageId: page.id,
      pageTitle: page.title,
      pageSlug: page.slug,
      pageType: page.type,
      proposalId: proposal.id,
      taskType: proposal.aiRun.taskType,
      originalContent,
      proposedContent: proposal.resultText,
      editedContent: proposal.editedText ?? proposal.resultText,
      suggestedTags: patch.payload.suggestedTags ?? [],
      suggestedMode: "replace_content",
      chatHistory,
      previousPublishStatus:
        (patch.payload.previousPublishStatus as PublishStatus | undefined) ?? "draft",
    };
  }

  async acceptReview(
    proposalId: string,
    editedText: string,
  ): Promise<{ ok: boolean; message: string }> {
    const proposal = await this.review.getProposal(proposalId);
    if (!proposal) return { ok: false, message: "Review nicht gefunden." };

    const result = await this.review.applyProposal(proposalId, {
      mode: "replace_content",
      editedText,
      applyTags: proposal.patch.payload.suggestedTags,
    });

    if (result.ok) {
      await this.db.contentReview.updateMany({
        where: {
          sourceType: "ai_proposal",
          sourceId: proposalId,
          status: "pending",
        },
        data: { status: "approved", reviewedAt: new Date() },
      });
    }

    return { ok: result.ok, message: result.message };
  }

  async rejectReview(
    proposalId: string,
    reason?: string,
  ): Promise<{ ok: boolean; message: string }> {
    const proposal = await this.db.aiProposal.findUnique({
      where: { id: proposalId },
      include: { aiRun: { include: { page: true } } },
    });
    if (!proposal?.aiRun.page) {
      return { ok: false, message: "Review nicht gefunden." };
    }

    const patch = this.asGeneratedPatch(proposal.patch);
    const previousStatus =
      (patch.payload.previousPublishStatus as PublishStatus | undefined) ?? "draft";

    const discard = await this.review.discardProposal(proposalId);
    if (!discard.ok) return discard;

    await this.db.contentReview.updateMany({
      where: {
        sourceType: "ai_proposal",
        sourceId: proposalId,
        status: "pending",
      },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        rejectReason: reason?.trim() || "Review abgelehnt",
      },
    });

    await this.db.page.update({
      where: { id: proposal.aiRun.page.id },
      data: { publishStatus: previousStatus },
    });

    return { ok: true, message: "Review abgelehnt, Seite zurückgesetzt." };
  }

  async enqueueRefineJob(input: {
    worldSlug: string;
    pageId: string;
    proposalId: string;
    providerId: string;
    model: string;
    userPrompt: string;
    currentDraft: string;
    userId?: string | null;
  }): Promise<{ ok: boolean; message: string; jobId?: string }> {
    const repo = new UweRepository(this.db);
    const page = await repo.getPageById(input.pageId);
    const world = await repo.getWorldBySlug(input.worldSlug);
    if (!page || !world || page.worldId !== world.id) {
      return { ok: false, message: "Seite oder Welt nicht gefunden." };
    }

    const refinePrompt = [
      "Aktueller Entwurf:",
      input.currentDraft,
      "",
      "Anweisung des Spielleiters:",
      input.userPrompt,
      "",
      "Gib den vollständig überarbeiteten Seitentext zurück — nur den finalen Text, ohne Meta-Kommentare.",
    ].join("\n");

    const job = await this.jobs.enqueue({
      type: "ai_run",
      title: `KI-Verfeinerung · ${page.title}`,
      worldId: world.id,
      worldSlug: input.worldSlug,
      userId: input.userId ?? null,
      relatedType: "ai_proposal",
      relatedId: input.proposalId,
      payload: {
        taskType: "improve_lore_text",
        worldSlug: input.worldSlug,
        pageSlug: page.slug,
        providerId: input.providerId,
        model: input.model,
        userPrompt: refinePrompt,
        pageReviewRefine: true,
        parentProposalId: input.proposalId,
        refineUserPrompt: input.userPrompt,
      },
    });

    return { ok: true, message: "Verfeinerungs-Job gestartet.", jobId: job.id };
  }
}

export function createPageAiReviewService(db: PrismaClient): PageAiReviewService {
  return new PageAiReviewService(db);
}

export * from "./types";
