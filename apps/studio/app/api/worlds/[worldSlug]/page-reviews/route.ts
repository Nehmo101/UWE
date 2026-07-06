import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createPageAiReviewService } from "@uwe/page-ai-review";
import { safeHandlerError } from "@uwe/security";

interface RouteContext {
  params: Promise<{ worldSlug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  try {
    const { worldSlug } = await context.params;
    const service = createPageAiReviewService(prisma);
    const [entries, pendingCount] = await Promise.all([
      service.listReviewPages(worldSlug),
      service.countOpenReviews(worldSlug),
    ]);
    return NextResponse.json({ entries, pendingCount });
  } catch (error) {
    return safeHandlerError(error, "Review-Liste konnte nicht geladen werden.");
  }
}
