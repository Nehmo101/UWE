import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { z } from "zod";
import { prisma } from "@uwe/database/server";
import { createPageAiReviewService } from "@uwe/page-ai-review";
import { parseBody, safeHandlerError } from "@uwe/security";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { dispatchJob } from "@/src/lib/job-executor";

const refineBodySchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1).max(200),
  userPrompt: z.string().min(1).max(8000),
  currentDraft: z.string().min(1).max(200_000),
});

interface RouteContext {
  params: Promise<{ worldSlug: string; pageId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, refineBodySchema);
  if (!parsed.success) return parsed.response;

  try {
    const { worldSlug, pageId } = await context.params;
    const service = createPageAiReviewService(prisma);
    const detail = await service.getReviewDetail(worldSlug, pageId);
    if (!detail) {
      return jsonError("Review nicht gefunden.", 404);
    }

    const result = await service.enqueueRefineJob({
      worldSlug,
      pageId,
      proposalId: detail.proposalId,
      providerId: parsed.data.providerId,
      model: parsed.data.model,
      userPrompt: parsed.data.userPrompt,
      currentDraft: parsed.data.currentDraft,
    });

    if (result.jobId) {
      dispatchJob(result.jobId);
    }

    return NextResponse.json(result);
  } catch (error) {
    return safeHandlerError(error, "Verfeinerung fehlgeschlagen.");
  }
}
