import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { prisma } from "@uwe/database/server";
import { createPageAiReviewService } from "@uwe/page-ai-review";
import { safeHandlerError } from "@uwe/security";

interface RouteContext {
  params: Promise<{ worldSlug: string; pageId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  try {
    const { worldSlug, pageId } = await context.params;
    const detail = await createPageAiReviewService(prisma).getReviewDetail(worldSlug, pageId);
    if (!detail) {
      return jsonError("Review nicht gefunden.", 404);
    }
    return NextResponse.json({ detail });
  } catch (error) {
    return safeHandlerError(error, "Review-Detail konnte nicht geladen werden.");
  }
}
