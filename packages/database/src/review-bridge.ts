import type { PrismaClient } from "./client";
import { createAiReviewService } from "./ai-review-service";
import { PlayerNoteService } from "./player-note-service";
import { createReviewService } from "./review-service";
import { UweRepository } from "./repository";
import type { ContentReviewView } from "./review-service";

export interface ResolveReviewResult {
  ok: boolean;
  message: string;
  review?: ContentReviewView;
}

/**
 * Execute the underlying action for an approved review, then mark it approved.
 */
export async function resolveReview(
  db: PrismaClient,
  reviewId: string,
  reviewerUserId: string,
  worldSlug?: string | null,
): Promise<ResolveReviewResult> {
  const reviews = createReviewService(db);
  const review = await reviews.getById(reviewId);
  if (!review) {
    return { ok: false, message: "Review nicht gefunden." };
  }
  if (review.status !== "pending") {
    return { ok: false, message: `Review ist nicht mehr offen (Status: ${review.status}).` };
  }

  switch (review.sourceType) {
    case "player_note": {
      const notes = new PlayerNoteService(db);
      await notes.accept(review.sourceId);
      const approved = await reviews.approve({ reviewId, reviewerUserId, worldSlug });
      return { ok: true, message: "Spielernotiz freigegeben.", review: approved };
    }
    case "portal_unlock": {
      const payload = review.payload as {
        pageId?: string;
        userId?: string;
        sessionLabel?: string | null;
      } | null;
      if (!payload?.pageId || !payload.userId) {
        return { ok: false, message: "Portal-Freischaltung: unvollständige Daten." };
      }
      await db.sessionUnlock.upsert({
        where: { pageId_userId: { pageId: payload.pageId, userId: payload.userId } },
        create: {
          pageId: payload.pageId,
          userId: payload.userId,
          sessionLabel: payload.sessionLabel ?? null,
        },
        update: {
          unlockedAt: new Date(),
          sessionLabel: payload.sessionLabel ?? null,
        },
      });
      const approved = await reviews.approve({ reviewId, reviewerUserId, worldSlug });
      return { ok: true, message: "Portal-Freischaltung genehmigt.", review: approved };
    }
    case "ai_proposal": {
      const aiReview = createAiReviewService(db);
      const proposal = await aiReview.getProposal(review.sourceId);
      if (!proposal) {
        return { ok: false, message: "KI-Vorschlag nicht gefunden." };
      }
      const applyResult = await aiReview.applyProposal(review.sourceId, {
        mode: proposal.suggestedMode,
      });
      if (!applyResult.ok) {
        return { ok: false, message: applyResult.message };
      }
      const approved = await reviews.approve({ reviewId, reviewerUserId, worldSlug });
      return { ok: true, message: applyResult.message, review: approved };
    }
    case "co_dm_change": {
      const payload = review.payload as {
        pageId?: string;
        title?: string;
        content?: string;
        blockId?: string;
        blockContent?: string;
      } | null;
      if (!payload?.pageId) {
        return { ok: false, message: "Co-DM-Änderung: unvollständige Daten." };
      }
      const repo = new UweRepository(db);
      if (payload.blockId && payload.blockContent !== undefined) {
        await repo.updateContentBlock(payload.blockId, { content: payload.blockContent });
      } else if (payload.title !== undefined || payload.content !== undefined) {
        await repo.updatePage(payload.pageId, {
          ...(payload.title !== undefined ? { title: payload.title } : {}),
          ...(payload.content !== undefined ? { content: payload.content } : {}),
        });
      } else {
        return { ok: false, message: "Co-DM-Änderung: keine anwendbaren Felder." };
      }
      const approved = await reviews.approve({ reviewId, reviewerUserId, worldSlug });
      return { ok: true, message: "Co-DM-Änderung übernommen.", review: approved };
    }
    default:
      return { ok: false, message: `Unbekannter Review-Typ: ${review.sourceType}` };
  }
}

export async function syncAiProposalReview(
  db: PrismaClient,
  input: {
    proposalId: string;
    worldId: string;
    worldSlug?: string | null;
    title: string;
    summary?: string;
    resultText?: string;
    proposedByUserId?: string | null;
    targetHref?: string | null;
  },
): Promise<void> {
  const reviews = createReviewService(db);
  await reviews.upsertPending({
    worldId: input.worldId,
    worldSlug: input.worldSlug,
    sourceType: "ai_proposal",
    sourceId: input.proposalId,
    title: input.title,
    summary: input.summary ?? "",
    diff: input.resultText ? { after: input.resultText } : null,
    proposedByUserId: input.proposedByUserId,
    targetHref: input.targetHref,
  });
}

export async function syncPlayerNoteReview(
  db: PrismaClient,
  input: {
    noteId: string;
    worldId: string;
    worldSlug?: string | null;
    userId: string;
    authorDisplayName: string;
    content: string;
    targetHref?: string | null;
  },
): Promise<void> {
  const reviews = createReviewService(db);
  const preview = input.content.length > 120 ? `${input.content.slice(0, 117)}…` : input.content;
  await reviews.upsertPending({
    worldId: input.worldId,
    worldSlug: input.worldSlug,
    sourceType: "player_note",
    sourceId: input.noteId,
    title: `Spielernotiz von ${input.authorDisplayName}`,
    summary: preview,
    diff: { content: input.content },
    proposedByUserId: input.userId,
    targetHref: input.targetHref,
  });
}

export async function createPortalUnlockReview(
  db: PrismaClient,
  input: {
    worldId: string;
    worldSlug?: string | null;
    pageId: string;
    userId: string;
    pageTitle: string;
    userDisplayName: string;
    sessionLabel?: string | null;
    proposedByUserId?: string | null;
    targetHref?: string | null;
  },
): Promise<ContentReviewView> {
  const reviews = createReviewService(db);
  const sourceId = `${input.pageId}:${input.userId}`;
  return reviews.upsertPending({
    worldId: input.worldId,
    worldSlug: input.worldSlug,
    sourceType: "portal_unlock",
    sourceId,
    title: `Freischaltung: ${input.pageTitle}`,
    summary: `Spieler ${input.userDisplayName} — Session: ${input.sessionLabel ?? "—"}`,
    payload: {
      pageId: input.pageId,
      userId: input.userId,
      sessionLabel: input.sessionLabel ?? null,
    },
    proposedByUserId: input.proposedByUserId,
    targetHref: input.targetHref,
  });
}

export async function createCoDmChangeReview(
  db: PrismaClient,
  input: {
    worldId: string;
    worldSlug?: string | null;
    proposedByUserId: string;
    title: string;
    summary: string;
    payload: Record<string, unknown>;
    diff?: Record<string, unknown> | null;
    targetHref?: string | null;
  },
): Promise<ContentReviewView> {
  const reviews = createReviewService(db);
  const sourceId = `codm-${Date.now()}-${input.proposedByUserId}`;
  return reviews.upsertPending({
    worldId: input.worldId,
    worldSlug: input.worldSlug,
    sourceType: "co_dm_change",
    sourceId,
    title: input.title,
    summary: input.summary,
    payload: input.payload,
    diff: input.diff,
    proposedByUserId: input.proposedByUserId,
    targetHref: input.targetHref,
  });
}
