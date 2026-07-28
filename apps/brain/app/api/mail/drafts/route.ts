import { NextResponse } from "next/server";
import { createMailAccountService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailApi, requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

export async function GET() {
  const auth = await requireBrainMailApi();
  if (auth.error) return auth.error;

  const service = createMailAccountService(brainPrisma);
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
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;

  let body: { subject?: string; bodyText?: string; worldId?: string; accountId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.", 400);
  }

  if (!body.subject?.trim()) {
    return mailApiError("subject ist erforderlich.", 400);
  }

  const service = createMailAccountService(brainPrisma);
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
