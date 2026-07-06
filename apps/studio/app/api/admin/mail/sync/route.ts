import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { accountId?: string; limit?: number; fullSync?: boolean; sync?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.accountId) return mailApiError("accountId erforderlich.");

  const service = createMailPortalService(prisma);

  // Optional synchronous quick sync (e.g. connection test with limit 1)
  if (body.sync === true) {
    try {
      const result = await service.syncAccount(
        body.accountId,
        auth.user?.id,
        body.limit ?? 50,
        { fullSync: body.fullSync ?? false },
      );
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync fehlgeschlagen.";
      return jsonError(message, 502);
    }
  }

  const account = await service.getAccountSafe(body.accountId);
  if (!account) return mailApiError("Mail-Account nicht gefunden.", 404);

  const job = await enqueueAndDispatch({
    type: "mail_sync",
    title: `IMAP Sync — ${account.label}`,
    payload: {
      accountId: body.accountId,
      limit: body.limit ?? 100,
      fullSync: body.fullSync ?? true,
    },
    relatedType: "mail_account",
    relatedId: body.accountId,
    userId: auth.user?.id ?? null,
  });

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    message: "Sync gestartet.",
  });
}
