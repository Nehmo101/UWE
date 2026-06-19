import type { PrismaClient } from "./client";
import { createActivityLogService } from "./activity-log-service";
import type {
  ContentReviewSourceType,
  ContentReviewStatus,
} from "./generated/prisma/client";
import { toPrismaJsonValue } from "./json-utils";

export const CONTENT_REVIEW_STATUS_LABELS: Record<ContentReviewStatus, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  superseded: "Ersetzt",
};

export const CONTENT_REVIEW_SOURCE_LABELS: Record<ContentReviewSourceType, string> = {
  ai_proposal: "KI-Vorschlag",
  co_dm_change: "Co-DM-Änderung",
  player_note: "Spielernotiz",
  portal_unlock: "Portal-Freischaltung",
};

export interface CreateContentReviewInput {
  worldId: string;
  worldSlug?: string | null;
  sourceType: ContentReviewSourceType;
  sourceId: string;
  title: string;
  summary?: string;
  diff?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  proposedByUserId?: string | null;
  targetHref?: string | null;
}

export interface ContentReviewView {
  id: string;
  worldId: string;
  sourceType: ContentReviewSourceType;
  sourceId: string;
  status: ContentReviewStatus;
  title: string;
  summary: string;
  diff: unknown;
  payload: unknown;
  proposedByUserId: string | null;
  proposedByDisplayName: string | null;
  reviewedByUserId: string | null;
  reviewedByDisplayName: string | null;
  reviewedAt: Date | null;
  rejectReason: string | null;
  targetHref: string | null;
  createdAt: Date;
  updatedAt: Date;
  commentCount: number;
}

export interface ReviewCommentView {
  id: string;
  reviewId: string;
  userId: string;
  userDisplayName: string;
  content: string;
  createdAt: Date;
}

export interface ListReviewsOptions {
  worldId?: string;
  status?: ContentReviewStatus | ContentReviewStatus[];
  sourceType?: ContentReviewSourceType;
  limit?: number;
  offset?: number;
}

export interface ApproveReviewInput {
  reviewId: string;
  reviewerUserId: string;
  worldSlug?: string | null;
}

export interface RejectReviewInput {
  reviewId: string;
  reviewerUserId: string;
  reason?: string | null;
  worldSlug?: string | null;
}

export interface AddReviewCommentInput {
  reviewId: string;
  userId: string;
  content: string;
  worldSlug?: string | null;
}

const reviewInclude = {
  proposedBy: { select: { id: true, displayName: true } },
  reviewedBy: { select: { id: true, displayName: true } },
  _count: { select: { comments: true } },
} as const;

export class ReviewService {
  constructor(private readonly db: PrismaClient) {}

  private get activity() {
    return createActivityLogService(this.db);
  }

  async upsertPending(input: CreateContentReviewInput): Promise<ContentReviewView> {
    const review = await this.db.contentReview.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      create: {
        worldId: input.worldId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
        summary: input.summary ?? "",
        diff: toPrismaJsonValue(input.diff),
        payload: toPrismaJsonValue(input.payload),
        proposedByUserId: input.proposedByUserId ?? null,
        targetHref: input.targetHref ?? null,
        status: "pending",
      },
      update: {
        title: input.title,
        summary: input.summary ?? "",
        diff: toPrismaJsonValue(input.diff),
        payload: toPrismaJsonValue(input.payload),
        proposedByUserId: input.proposedByUserId ?? null,
        targetHref: input.targetHref ?? null,
        status: "pending",
        reviewedByUserId: null,
        reviewedAt: null,
        rejectReason: null,
      },
      include: reviewInclude,
    });

    await this.activity.log({
      worldId: input.worldId,
      worldSlug: input.worldSlug ?? null,
      action: "review_submitted",
      targetType: "content_review",
      targetId: review.id,
      targetLabel: review.title,
      targetHref: review.targetHref,
      summary: `${CONTENT_REVIEW_SOURCE_LABELS[input.sourceType]}: ${review.title}`,
      details: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });

    return this.toView(review);
  }

  async getById(reviewId: string): Promise<ContentReviewView | null> {
    const review = await this.db.contentReview.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });
    return review ? this.toView(review) : null;
  }

  async list(options: ListReviewsOptions = {}): Promise<ContentReviewView[]> {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    const reviews = await this.db.contentReview.findMany({
      where: {
        ...(options.worldId ? { worldId: options.worldId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(options.sourceType ? { sourceType: options.sourceType } : {}),
      },
      include: reviewInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });

    return reviews.map((review) => this.toView(review));
  }

  async countPending(worldId?: string): Promise<number> {
    return this.db.contentReview.count({
      where: {
        status: "pending",
        ...(worldId ? { worldId } : {}),
      },
    });
  }

  async approve(input: ApproveReviewInput): Promise<ContentReviewView> {
    const existing = await this.db.contentReview.findUnique({
      where: { id: input.reviewId },
    });
    if (!existing) {
      throw new Error(`Review ${input.reviewId} nicht gefunden.`);
    }
    if (existing.status !== "pending") {
      throw new Error(`Review ${input.reviewId} ist nicht mehr offen (Status: ${existing.status}).`);
    }

    const review = await this.db.contentReview.update({
      where: { id: input.reviewId },
      data: {
        status: "approved",
        reviewedByUserId: input.reviewerUserId,
        reviewedAt: new Date(),
      },
      include: reviewInclude,
    });

    await this.activity.log({
      worldId: review.worldId,
      worldSlug: input.worldSlug ?? null,
      action: "review_approved",
      targetType: "content_review",
      targetId: review.id,
      targetLabel: review.title,
      targetHref: review.targetHref,
      summary: `Freigegeben: ${review.title}`,
      details: {
        sourceType: review.sourceType,
        sourceId: review.sourceId,
        reviewerUserId: input.reviewerUserId,
      },
    });

    return this.toView(review);
  }

  async reject(input: RejectReviewInput): Promise<ContentReviewView> {
    const existing = await this.db.contentReview.findUnique({
      where: { id: input.reviewId },
    });
    if (!existing) {
      throw new Error(`Review ${input.reviewId} nicht gefunden.`);
    }
    if (existing.status !== "pending") {
      throw new Error(`Review ${input.reviewId} ist nicht mehr offen (Status: ${existing.status}).`);
    }

    const review = await this.db.contentReview.update({
      where: { id: input.reviewId },
      data: {
        status: "rejected",
        reviewedByUserId: input.reviewerUserId,
        reviewedAt: new Date(),
        rejectReason: input.reason ?? null,
      },
      include: reviewInclude,
    });

    await this.activity.log({
      worldId: review.worldId,
      worldSlug: input.worldSlug ?? null,
      action: "review_rejected",
      targetType: "content_review",
      targetId: review.id,
      targetLabel: review.title,
      targetHref: review.targetHref,
      summary: `Abgelehnt: ${review.title}`,
      details: {
        sourceType: review.sourceType,
        sourceId: review.sourceId,
        reviewerUserId: input.reviewerUserId,
        reason: input.reason ?? null,
      },
    });

    return this.toView(review);
  }

  async addComment(input: AddReviewCommentInput): Promise<ReviewCommentView> {
    const review = await this.db.contentReview.findUnique({
      where: { id: input.reviewId },
    });
    if (!review) {
      throw new Error(`Review ${input.reviewId} nicht gefunden.`);
    }

    const comment = await this.db.reviewComment.create({
      data: {
        reviewId: input.reviewId,
        userId: input.userId,
        content: input.content,
      },
      include: {
        user: { select: { id: true, displayName: true } },
      },
    });

    await this.activity.log({
      worldId: review.worldId,
      worldSlug: input.worldSlug ?? null,
      action: "review_commented",
      targetType: "content_review",
      targetId: review.id,
      targetLabel: review.title,
      targetHref: review.targetHref,
      summary: `Kommentar zu: ${review.title}`,
      details: {
        commentId: comment.id,
        userId: input.userId,
      },
    });

    return {
      id: comment.id,
      reviewId: comment.reviewId,
      userId: comment.userId,
      userDisplayName: comment.user.displayName,
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }

  async listComments(reviewId: string): Promise<ReviewCommentView[]> {
    const comments = await this.db.reviewComment.findMany({
      where: { reviewId },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    });

    return comments.map((comment) => ({
      id: comment.id,
      reviewId: comment.reviewId,
      userId: comment.userId,
      userDisplayName: comment.user.displayName,
      content: comment.content,
      createdAt: comment.createdAt,
    }));
  }

  async markSuperseded(sourceType: ContentReviewSourceType, sourceId: string): Promise<void> {
    await this.db.contentReview.updateMany({
      where: {
        sourceType,
        sourceId,
        status: "pending",
      },
      data: { status: "superseded" },
    });
  }

  private toView(
    review: {
      id: string;
      worldId: string;
      sourceType: ContentReviewSourceType;
      sourceId: string;
      status: ContentReviewStatus;
      title: string;
      summary: string;
      diff: unknown;
      payload: unknown;
      proposedByUserId: string | null;
      reviewedByUserId: string | null;
      reviewedAt: Date | null;
      rejectReason: string | null;
      targetHref: string | null;
      createdAt: Date;
      updatedAt: Date;
      proposedBy: { id: string; displayName: string } | null;
      reviewedBy: { id: string; displayName: string } | null;
      _count: { comments: number };
    },
  ): ContentReviewView {
    return {
      id: review.id,
      worldId: review.worldId,
      sourceType: review.sourceType,
      sourceId: review.sourceId,
      status: review.status,
      title: review.title,
      summary: review.summary,
      diff: review.diff,
      payload: review.payload,
      proposedByUserId: review.proposedByUserId,
      proposedByDisplayName: review.proposedBy?.displayName ?? null,
      reviewedByUserId: review.reviewedByUserId,
      reviewedByDisplayName: review.reviewedBy?.displayName ?? null,
      reviewedAt: review.reviewedAt,
      rejectReason: review.rejectReason,
      targetHref: review.targetHref,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      commentCount: review._count.comments,
    };
  }
}

export function createReviewService(db: PrismaClient): ReviewService {
  return new ReviewService(db);
}
