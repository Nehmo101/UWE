import { NextResponse } from "next/server";
import { getSystemSettings } from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requirePrivateHealthAuth } from "@/src/lib/private-health-auth";
import { enqueueAndDispatch } from "@/src/lib/job-executor";
import { brainPrisma } from "@uwe/database/brain-client";

/**
 * Internal endpoint for the host mail-sync timer (`deploy/scripts/uwe-mail-sync.sh`).
 */
export async function POST(request: Request) {
  const authError = requirePrivateHealthAuth(request);
  if (authError) return authError;

  const settings = await getSystemSettings();
  if (!settings.mail.autoSyncEnabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "auto_sync_disabled" });
  }

  const portal = createMailPortalService(brainPrisma);
  const accounts = await portal.listAccounts();
  const syncAccounts = accounts.filter((account) => account.imapHost);

  const jobs = [];
  for (const account of syncAccounts) {
    const job = await enqueueAndDispatch({
      type: "mail_sync",
      title: `Auto IMAP Sync — ${account.label}`,
      payload: { accountId: account.id, fullSync: true, limit: 100 },
      relatedType: "mail_account",
      relatedId: account.id,
    });
    jobs.push({ accountId: account.id, jobId: job.id });
  }

  return NextResponse.json({ ok: true, enqueued: jobs.length, jobs });
}
