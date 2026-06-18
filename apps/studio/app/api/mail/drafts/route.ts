import { NextResponse } from "next/server";
import { createMailAccountService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
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
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: { subject?: string; bodyText?: string; worldId?: string; accountId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body.subject?.trim()) {
    return NextResponse.json({ error: "subject ist erforderlich." }, { status: 400 });
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
