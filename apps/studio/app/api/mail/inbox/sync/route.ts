import { NextResponse } from "next/server";
import { createMailAccountService, createJobService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: { accountId?: string; limit?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body.accountId) {
    return NextResponse.json({ error: "accountId ist erforderlich." }, { status: 400 });
  }

  const account = await createMailAccountService(prisma).getAccount(body.accountId);
  if (!account) {
    return NextResponse.json({ error: "Mail-Account nicht gefunden." }, { status: 404 });
  }

  const jobs = createJobService(prisma);
  const job = await jobs.enqueue({
    type: "mail_sync",
    title: `IMAP Sync — ${account.label}`,
    payload: {
      accountId: body.accountId,
      limit: body.limit ?? 50,
    },
    relatedType: "mail_account",
    relatedId: body.accountId,
  });

  return NextResponse.json({ jobId: job.id, status: job.status });
}
