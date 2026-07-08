import type { PrismaClient } from "@uwe/database/client";
import {
  parseRuleActions,
  parseRuleConditions,
  type MailRuleAction,
  type MailRuleCondition,
  type MailRuleDefinition,
} from "./rule-types";

export interface UpsertMailRuleInput {
  name: string;
  enabled?: boolean;
  sortOrder?: number;
  accountId?: string | null;
  conditions: MailRuleCondition[];
  actions: MailRuleAction[];
}

/** CRUD for mail rules and VIP senders. Takes a PrismaClient directly (feature-package pattern). */
export class MailRuleService {
  constructor(private readonly db: PrismaClient) {}

  async listRules(): Promise<MailRuleDefinition[]> {
    const rows = await this.db.mailRule.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      accountId: row.accountId,
      conditions: parseRuleConditions(row.conditions),
      actions: parseRuleActions(row.actions),
    }));
  }

  /** Enabled rules only — the shape the sync-time engine consumes. */
  async listActiveRules(): Promise<MailRuleDefinition[]> {
    return (await this.listRules()).filter((rule) => rule.enabled);
  }

  async createRule(input: UpsertMailRuleInput) {
    return this.db.mailRule.create({
      data: {
        name: input.name.trim(),
        enabled: input.enabled ?? true,
        sortOrder: input.sortOrder ?? 0,
        accountId: input.accountId ?? null,
        conditions: parseRuleConditions(input.conditions),
        actions: parseRuleActions(input.actions),
      },
    });
  }

  async updateRule(id: string, input: Partial<UpsertMailRuleInput>) {
    return this.db.mailRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.conditions !== undefined ? { conditions: parseRuleConditions(input.conditions) } : {}),
        ...(input.actions !== undefined ? { actions: parseRuleActions(input.actions) } : {}),
      },
    });
  }

  async deleteRule(id: string) {
    await this.db.mailRule.delete({ where: { id } });
  }

  async listVipAddresses(): Promise<string[]> {
    const rows = await this.db.mailVipSender.findMany({ select: { address: true } });
    return rows.map((row) => row.address);
  }

  async listVips() {
    return this.db.mailVipSender.findMany({ orderBy: { address: "asc" } });
  }

  async addVip(address: string, label?: string | null) {
    const normalized = address.trim().toLowerCase();
    return this.db.mailVipSender.upsert({
      where: { address: normalized },
      create: { address: normalized, label: label ?? null },
      update: { label: label ?? null },
    });
  }

  async removeVip(id: string) {
    await this.db.mailVipSender.delete({ where: { id } });
  }

  /**
   * Applies enabled rules to the given (freshly-synced) messages: mark read,
   * star, move to a LOCAL archive/trash folder, and set a minimum priority /
   * category. Returns the ids that a rule asked to skip AI triage for, plus the
   * ids that were moved out of the inbox. DB-only (best-effort IMAP writeback is
   * unnecessary — incremental sync never re-fetches a UID at or below the
   * watermark, so a local move sticks).
   */
  async applyRules(messageIds: string[]): Promise<{ skipAiTriageIds: string[]; movedIds: string[] }> {
    const skipAiTriageIds: string[] = [];
    const movedIds: string[] = [];
    if (messageIds.length === 0) return { skipAiTriageIds, movedIds };

    const rules = await this.listActiveRules();
    if (rules.length === 0) return { skipAiTriageIds, movedIds };

    const { evaluateRules } = await import("./rule-engine");

    const messages = await this.db.mailInboxMessage.findMany({
      where: { id: { in: messageIds } },
      select: {
        id: true,
        accountId: true,
        fromAddress: true,
        subject: true,
        toAddresses: true,
        hasAttachments: true,
        listUnsubscribeHttpUrl: true,
        listUnsubscribeMailto: true,
      },
    });

    for (const message of messages) {
      const evaluation = evaluateRules(rules, {
        accountId: message.accountId,
        fromAddress: message.fromAddress,
        subject: message.subject,
        toAddresses: Array.isArray(message.toAddresses) ? (message.toAddresses as string[]) : [],
        hasAttachments: message.hasAttachments,
        hasUnsubscribeTarget: Boolean(message.listUnsubscribeHttpUrl || message.listUnsubscribeMailto),
      });
      if (evaluation.actions.length === 0) continue;

      const data: { isRead?: boolean; isStarred?: boolean } = {};
      let moveTarget: "archive" | "trash" | null = null;
      let minPriority: number | null = null;
      let category: string | null = null;

      for (const action of evaluation.actions) {
        if (action.type === "markRead") data.isRead = true;
        else if (action.type === "star") data.isStarred = true;
        else if (action.type === "move") moveTarget = action.target;
        else if (action.type === "setMinPriority") minPriority = action.priority;
        else if (action.type === "setCategory") category = action.category;
        else if (action.type === "skipAiTriage") skipAiTriageIds.push(message.id);
      }

      if (moveTarget) {
        const localKey = moveTarget === "archive" ? "LOCAL:archived" : "LOCAL:trash";
        const displayName = moveTarget === "archive" ? "Archiv" : "Papierkorb";
        const folder = await this.db.mailFolder.upsert({
          where: { accountId_imapPath: { accountId: message.accountId, imapPath: localKey } },
          create: { accountId: message.accountId, imapPath: localKey, displayName, folderRole: moveTarget },
          update: {},
        });
        await this.db.mailInboxMessage.update({ where: { id: message.id }, data: { ...data, folderId: folder.id } });
        movedIds.push(message.id);
      } else if (Object.keys(data).length > 0) {
        await this.db.mailInboxMessage.update({ where: { id: message.id }, data });
      }

      if (minPriority !== null || category !== null) {
        await this.db.mailPriorityScore.upsert({
          where: { messageId: message.id },
          create: {
            messageId: message.id,
            priority: minPriority ?? 50,
            category: (category as never) ?? "info",
            explanation: "Regel angewendet",
            modelProvider: "rules",
            modelName: "uwe-mail-rules-v1",
          },
          update: {
            ...(minPriority !== null ? { priority: minPriority } : {}),
            ...(category !== null ? { category: category as never } : {}),
          },
        });
      }
    }

    return { skipAiTriageIds, movedIds };
  }
}

export function createMailRuleService(db: PrismaClient): MailRuleService {
  return new MailRuleService(db);
}
