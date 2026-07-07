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

  const service = createMailPortalService(prisma);

  // accountId "all" (oder weggelassen): alle sync-fähigen Konten als Jobs einreihen —
  // genutzt vom manuellen „Alle Konten"-Sync und vom Hintergrund-Timer im Mail Center.
  if (!body.accountId || body.accountId === "all") {
    const accounts = await service.listAccounts();
    const syncAccounts = accounts.filter(
      (account) => account.imapHost && account.syncEnabled !== false,
    );
    if (syncAccounts.length === 0) {
      return mailApiError("Kein IMAP-Konto für den Sync konfiguriert.", 404);
    }
    const jobs = [];
    for (const account of syncAccounts) {
      const job = await enqueueAndDispatch({
        type: "mail_sync",
        title: `IMAP Sync — ${account.label}`,
        payload: {
          accountId: account.id,
          limit: body.limit ?? 100,
          fullSync: body.fullSync ?? true,
        },
        relatedType: "mail_account",
        relatedId: account.id,
        userId: auth.user?.id ?? null,
      });
      jobs.push({ accountId: account.id, jobId: job.id });
    }
    return NextResponse.json({
      jobs,
      status: "queued",
      message: `Sync für ${jobs.length} Konto/Konten gestartet.`,
    });
  }

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
