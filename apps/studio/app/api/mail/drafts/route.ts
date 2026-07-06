import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailAccountService, prisma } from "@uwe/database/server";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const service = createMailAccountService(prisma);
  const drafts = await service.listDrafts();
  return NextResponse.json({
    drafts: drafts.map((draft) => ({
      id: draft.id,
      subject: draft.subject,
      status: draft.status,
      worldId: draft.worldId,
      updatedAt: draft.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  let body: { subject?: string; bodyText?: string; worldId?: string; accountId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Ungültiger JSON-Body.", 400);
  }

  if (!body.subject?.trim()) {
    return jsonError("subject ist erforderlich.", 400);
  }

  const service = createMailAccountService(prisma);
  const draft = await service.createDraft({
    subject: body.subject,
    bodyText: body.bodyText,
    worldId: body.worldId,
    accountId: body.accountId,
  });

  return NextResponse.json({
    draft: {
      id: draft.id,
      subject: draft.subject,
      status: draft.status,
    },
  });
}
