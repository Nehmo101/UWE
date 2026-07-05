import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createPageAiReviewService } from "@uwe/page-ai-review";
import { requireStudioApiAuth, safeHandlerError } from "@uwe/security";

interface RouteContext {
  params: Promise<{ worldSlug: string; pageId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await requireStudioApiAuth(request);
  if (authError) return authError;

  try {
    const { worldSlug, pageId } = await context.params;
    const detail = await createPageAiReviewService(prisma).getReviewDetail(worldSlug, pageId);
    if (!detail) {
      return NextResponse.json({ error: "Review nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ detail });
  } catch (error) {
    return safeHandlerError(error, "Review-Detail konnte nicht geladen werden.");
  }
}
