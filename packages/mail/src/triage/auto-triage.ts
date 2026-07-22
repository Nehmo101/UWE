import type { BrainPrismaClient as PrismaClient } from "@uwe/database/brain-client";
import { scoreMailPriority } from "@uwe/mail-core";

export interface AutoTriageOptions {
  vipSenders?: string[];
  /** Message ids a rule asked to skip (skipAiTriage) — left unscored here. */
  skipIds?: string[];
}

/**
 * Rule-based (local, no LLM) priority scoring for freshly-synced messages.
 * Only scores messages that do not yet have a priority row, so a later
 * user-triggered AI triage can overwrite the "rules" score. Cheap and safe to
 * run on every sync.
 */
export async function autoTriageNewMessages(
  db: PrismaClient,
  messageIds: string[],
  options?: AutoTriageOptions,
): Promise<{ scored: number }> {
  const skip = new Set(options?.skipIds ?? []);
  const targets = messageIds.filter((id) => !skip.has(id));
  if (targets.length === 0) return { scored: 0 };

  const messages = await db.mailInboxMessage.findMany({
    where: { id: { in: targets }, priority: null },
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      bodyText: true,
      bodyHtml: true,
      hasAttachments: true,
    },
  });

  let scored = 0;
  for (const message of messages) {
    const result = scoreMailPriority({
      subject: message.subject,
      fromAddress: message.fromAddress,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      hasAttachments: message.hasAttachments,
      vipSenders: options?.vipSenders,
    });
    await db.mailPriorityScore.upsert({
      where: { messageId: message.id },
      create: {
        messageId: message.id,
        priority: result.priority,
        category: result.category as never,
        confidence: result.confidence,
        explanation: result.explanation,
        ruleSignals: result.ruleSignals,
        extractedActions: result.extractedActions,
        modelProvider: "rules",
        modelName: "uwe-mail-rules-v1",
      },
      update: {},
    });
    scored += 1;
  }
  return { scored };
}
