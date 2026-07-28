import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { syncMailAccount } from "@uwe/mail/sync-account";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

/**
 * Sync von Hand — läuft direkt, nicht über die Job-Queue.
 *
 * In Studio reihte diese Route `mail_sync`-Jobs ein, der In-Process-Executor
 * arbeitete sie ab, und die Oberfläche pollte `/api/jobs/:id` für den
 * Fortschritt. Brain hat keinen Executor, und einen zweiten aufzumachen wäre
 * ein hoher Preis für eine Prozentanzeige. Also läuft der Sync hier im Request
 * und antwortet, wenn er durch ist.
 *
 * Was das kostet: keine Prozentzahl (die Oberfläche zeigt den unbestimmten
 * Balken) und ein langer Request. Was es nicht kostet: den automatischen Sync.
 * Der läuft weiter über Studios Host-Timer (`deploy/scripts/uwe-mail-sync.sh`
 * → `/api/internal/mail-sync`) und füllt die Postfächer im Hintergrund, egal
 * welche App sie anzeigt.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;

  let body: { accountId?: string; limit?: number; fullSync?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  const service = createMailPortalService(brainPrisma);
  const limit = body.limit ?? 100;
  const fullSync = body.fullSync ?? true;

  const accounts = await service.listAccounts();
  const syncable = accounts.filter((account) => account.imapHost && account.syncEnabled !== false);

  const targets =
    !body.accountId || body.accountId === "all"
      ? syncable
      : syncable.filter((account) => account.id === body.accountId);

  if (targets.length === 0) {
    return mailApiError(
      body.accountId && body.accountId !== "all"
        ? "Mail-Account nicht gefunden oder ohne IMAP."
        : "Kein IMAP-Konto für den Sync konfiguriert.",
      404,
    );
  }

  // Ein kaputtes Konto darf die anderen nicht mitreißen: der Fehler landet am
  // Konto (`markImapSyncError` in syncMailAccount) und in der Antwort.
  const results = await Promise.all(
    targets.map(async (account) => {
      try {
        const result = await syncMailAccount(brainPrisma, account.id, { limit, fullSync });
        return { accountId: account.id, label: account.label, ok: true as const, ...result };
      } catch (error) {
        return {
          accountId: account.id,
          label: account.label,
          ok: false as const,
          error: error instanceof Error ? error.message : "Sync fehlgeschlagen.",
        };
      }
    }),
  );

  const imported = results.reduce((sum, entry) => sum + (entry.ok ? entry.imported : 0), 0);
  const failed = results.filter((entry) => !entry.ok);

  return NextResponse.json({
    status: "completed",
    imported,
    accounts: results,
    message: failed.length
      ? `${imported} Nachrichten synchronisiert — ${failed.length} Konto/Konten mit Fehler.`
      : `${imported} Nachrichten synchronisiert.`,
  });
}
