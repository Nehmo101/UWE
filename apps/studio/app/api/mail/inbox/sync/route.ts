import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailAccountService, createJobService, prisma } from "@uwe/database/server";

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  let body: { accountId?: string; limit?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Ungültiger JSON-Body.", 400);
  }

  if (!body.accountId) {
    return jsonError("accountId ist erforderlich.", 400);
  }

  const account = await createMailAccountService(prisma).getAccount(body.accountId);
  if (!account) {
    return jsonError("Mail-Account nicht gefunden.", 404);
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
