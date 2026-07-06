import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createReviewService,
  prisma,
  resolveReview,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const context = await resolveStudioApiAuthContext(_request);
  const authError = requireAdminApiAuth(_request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const { id } = await params;
  const reviews = createReviewService(prisma);
  const review = await reviews.getById(id);
  if (!review) {
    return jsonError("Review nicht gefunden.", 404);
  }

  const comments = await reviews.listComments(id);
  return NextResponse.json({ review, comments });
}

export async function POST(request: Request, { params }: RouteParams) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  if (!context.user) {
    return jsonError("Anmeldung erforderlich.", 401);
  }

  const { id } = await params;
  const body = (await request.json()) as {
    action?: "approve" | "reject" | "comment";
    reason?: string;
    content?: string;
    worldSlug?: string;
  };

  const reviews = createReviewService(prisma);

  if (body.action === "comment") {
    if (!body.content?.trim()) {
      return jsonError("Kommentar darf nicht leer sein.", 400);
    }
    const comment = await reviews.addComment({
      reviewId: id,
      userId: context.user.id,
      content: body.content.trim(),
      worldSlug: body.worldSlug,
    });
    return NextResponse.json({ ok: true, comment });
  }

  if (body.action === "reject") {
    const review = await reviews.reject({
      reviewId: id,
      reviewerUserId: context.user.id,
      reason: body.reason,
      worldSlug: body.worldSlug,
    });
    return NextResponse.json({ ok: true, review });
  }

  if (body.action === "approve") {
    const result = await resolveReview(prisma, id, context.user.id, body.worldSlug);
    if (!result.ok) {
      return jsonError(result.message, 400);
    }
    return NextResponse.json({ ok: true, review: result.review, message: result.message });
  }

  return jsonError("Unbekannte Aktion.", 400);
}
