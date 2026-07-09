"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@uwe/database/server";
import {
  createPageAiReviewService,
  type PageAiReviewAction,
  type PageReviewDetail,
} from "@uwe/page-ai-review";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";
import { dispatchJob } from "@/src/lib/job-executor";

export async function startPageAiReviewBulkAction(
  worldSlug: string,
  pageIds: string[],
  action: PageAiReviewAction,
  options: { providerId: string; model: string; userPrompt?: string },
): Promise<{ ok: boolean; message: string; jobIds: string[] }> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const service = createPageAiReviewService(prisma);
  const result = await service.startBulkReview({
    worldSlug,
    pageIds,
    action,
    providerId: options.providerId,
    model: options.model,
    userPrompt: options.userPrompt,
    userId: null,
  });

  for (const jobId of result.jobIds) {
    dispatchJob(jobId);
  }

  if (result.ok) {
    revalidatePath(`/worlds/${worldSlug}`);
    revalidatePath(`/worlds/${worldSlug}/page-review`);
  }

  return result;
}

export async function acceptPageReviewAction(
  worldSlug: string,
  proposalId: string,
  editedText: string,
): Promise<{ ok: boolean; message: string }> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const result = await createPageAiReviewService(prisma).acceptReview(proposalId, editedText);

  revalidatePath(`/worlds/${worldSlug}`);
  revalidatePath(`/worlds/${worldSlug}/page-review`);

  return result;
}

export async function rejectPageReviewAction(
  worldSlug: string,
  proposalId: string,
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const result = await createPageAiReviewService(prisma).rejectReview(proposalId, reason);

  revalidatePath(`/worlds/${worldSlug}`);
  revalidatePath(`/worlds/${worldSlug}/page-review`);

  return result;
}

export async function refinePageReviewAction(
  worldSlug: string,
  input: {
    pageId: string;
    proposalId: string;
    providerId: string;
    model: string;
    userPrompt: string;
    currentDraft: string;
  },
): Promise<{ ok: boolean; message: string; jobId?: string }> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const result = await createPageAiReviewService(prisma).enqueueRefineJob({
    worldSlug,
    pageId: input.pageId,
    proposalId: input.proposalId,
    providerId: input.providerId,
    model: input.model,
    userPrompt: input.userPrompt,
    currentDraft: input.currentDraft,
    userId: null,
  });

  if (result.jobId) {
    dispatchJob(result.jobId);
  }

  return result;
}

export async function getPageReviewDetailAction(
  worldSlug: string,
  pageId: string,
): Promise<PageReviewDetail | null> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);
  return createPageAiReviewService(prisma).getReviewDetail(worldSlug, pageId);
}

export async function countOpenPageReviewsAction(worldSlug: string): Promise<number> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);
  return createPageAiReviewService(prisma).countOpenReviews(worldSlug);
}
