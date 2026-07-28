import type { BrainPrismaClient } from "@uwe/database/brain-client";
import { describeImapError } from "@uwe/mail-core";
import { createMailAccountService } from "@uwe/database/server";
import { createMailRuleService } from "../rules/index";
import { autoTriageNewMessages } from "../triage/auto-triage";

/**
 * Ein vollständiger Konto-Sync: Postfach abholen, Regeln anwenden, lokal
 * triagieren, Gesendet-Ordner nachziehen.
 *
 * Stand als `runMailSyncJob` in `apps/studio/src/lib/integration-job-runners.ts`
 * — 85 Zeilen Domänenlogik in einer App-Datei, an die nur Studio herankam. Mit
 * dem Mail-Center in Brain brauchen es beide: Studio startet den Sync über die
 * Job-Queue (Host-Timer), Brain ruft ihn direkt auf. Also liegt er hier, und
 * beide Seiten sind dünne Aufrufer.
 *
 * `onProgress` ist optional: Studios Job-Runner reicht den Fortschritt an die
 * Job-Zeile weiter, Brain läuft ohne.
 */

export interface MailSyncProgress {
  processed: number;
  total: number;
  phase: string;
}

export interface MailSyncAccountOptions {
  limit?: number;
  fullSync?: boolean;
  mailbox?: string;
  /** Fortschritt 0–100 plus Phasentext. Fehler daraus brechen den Sync ab. */
  onProgress?: (percent: number, phase: string) => Promise<void> | void;
}

export interface MailSyncAccountResult {
  imported: number;
  /** Nachrichten, die eine Regel in den Papierkorb verschoben hat. */
  ruleMoved: number;
  /** Nachrichten, die die lokale Triage bewertet hat (kein LLM). */
  triaged: number;
  /** Aus dem Gesendet-Ordner nachgezogene Nachrichten. */
  sentImported: number;
}

export async function syncMailAccount(
  brainDb: BrainPrismaClient,
  accountId: string,
  options: MailSyncAccountOptions = {},
): Promise<MailSyncAccountResult> {
  const { limit = 50, fullSync = false, mailbox, onProgress } = options;
  const mail = createMailAccountService(brainDb);

  await onProgress?.(5, "IMAP Postfach synchronisieren");

  try {
    const result = await mail.syncInbox(accountId, {
      limit,
      fullSync,
      mailbox,
      onProgress: async (progress: MailSyncProgress) => {
        const pct =
          progress.total > 0 ? Math.round((progress.processed / progress.total) * 90) + 5 : 50;
        await onProgress?.(Math.min(pct, 95), progress.phase);
      },
    });

    // Regeln und lokale Auto-Triage auf die frisch geholten INBOX-Nachrichten,
    // damit Filter und Prioritäten sofort sichtbar sind — alles lokal, kein LLM.
    let ruleMoved = 0;
    let triaged = 0;
    const createdIds = "createdIds" in result ? (result.createdIds as string[]) : [];
    if (!mailbox && createdIds.length > 0) {
      try {
        const ruleService = createMailRuleService(brainDb);
        const { skipAiTriageIds, movedIds } = await ruleService.applyRules(createdIds);
        ruleMoved = movedIds.length;
        const vipSenders = await ruleService.listVipAddresses();
        const trashedSet = new Set(movedIds);
        const triageTargets = createdIds.filter((id) => !trashedSet.has(id));
        const { scored } = await autoTriageNewMessages(brainDb, triageTargets, {
          vipSenders,
          skipIds: skipAiTriageIds,
        });
        triaged = scored;
      } catch {
        // Regeln und Triage sind best effort — ein Fehler darf den Sync nicht kippen.
      }
    }

    // Gesendet-Ordner nachziehen, damit „Gesendet" die echte Server-Mail zeigt.
    // Auch das best effort: scheitert es, bleibt der INBOX-Sync gültig.
    let sentImported = 0;
    if (!mailbox) {
      try {
        const sent = await mail.syncSentFolder(accountId, { limit });
        sentImported = "imported" in sent ? sent.imported : 0;
      } catch {
        sentImported = 0;
      }
    }

    await onProgress?.(100, `${result.imported} Nachrichten synchronisiert`);
    return { imported: result.imported, ruleMoved, triaged, sentImported };
  } catch (error) {
    await mail.markImapSyncError(accountId, describeImapError(error));
    throw error;
  }
}
