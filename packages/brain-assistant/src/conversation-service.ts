/**
 * Persistence for the Brain assistant: conversations, messages, attachments and
 * the singleton "hinterlegte KI" profile.
 *
 * Everything here lives in the owner-private Brain database (`uwe-brain.db`) and
 * touches nothing else. Connector/model identifiers are stored as opaque
 * scalars because the connectors themselves live in `uwe.db` — the same
 * cross-domain pattern the Brain split established for `ScanDocument.worldId`.
 */

import type { BrainPrismaClient } from "@uwe/database/brain-client";

import {
  type AssistantAttachmentKind,
  type AssistantAttachmentView,
  type AssistantContextMode,
  type AssistantConversationSummary,
  type AssistantConversationView,
  type AssistantMessageView,
  type AssistantProfileView,
  type AssistantRole,
} from "./assistant-types";

const PROFILE_ID = "default";

/** Title used until the first user message renames the conversation. */
const UNTITLED = "Neues Gespräch";

/** Derive a short title from the first question the owner asks. */
export function deriveConversationTitle(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return UNTITLED;
  return flat.length <= 60 ? flat : `${flat.slice(0, 57).trimEnd()}…`;
}

type AttachmentRow = {
  id: string;
  kind: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  extractedText: string | null;
  createdAt: Date;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  model: string | null;
  route: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
  attachments?: AttachmentRow[];
};

function toAttachmentView(row: AttachmentRow): AssistantAttachmentView {
  return {
    id: row.id,
    kind: row.kind as AssistantAttachmentKind,
    mimeType: row.mimeType,
    originalFilename: row.originalFilename,
    sizeBytes: row.sizeBytes,
    extractedText: row.extractedText,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMessageView(row: MessageRow): AssistantMessageView {
  return {
    id: row.id,
    role: row.role as AssistantRole,
    content: row.content,
    model: row.model,
    route: row.route,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    attachments: (row.attachments ?? []).map(toAttachmentView),
  };
}

export interface AppendMessageInput {
  conversationId: string;
  role: AssistantRole;
  content: string;
  model?: string | null;
  route?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  attachmentIds?: string[];
}

export class BrainAssistantService {
  constructor(private readonly db: BrainPrismaClient) {}

  // --- Profil ("hinterlegte KI") -------------------------------------------

  async getProfile(): Promise<AssistantProfileView> {
    const row = await this.db.brainAssistantProfile.findUnique({ where: { id: PROFILE_ID } });
    return {
      chat:
        row?.chatConnectorId && row.chatModelId
          ? {
              connectorId: row.chatConnectorId,
              modelId: row.chatModelId,
              label: row.chatModelLabel ?? row.chatModelId,
            }
          : null,
      vision:
        row?.visionConnectorId && row.visionModelId
          ? {
              connectorId: row.visionConnectorId,
              modelId: row.visionModelId,
              label: row.visionModelLabel ?? row.visionModelId,
            }
          : null,
      sttModelName: row?.sttModelName ?? null,
      systemPrompt: row?.systemPrompt ?? "",
      defaultContextMode: (row?.defaultContextMode ?? "plain") as AssistantContextMode,
    };
  }

  async saveProfile(input: {
    chat: { connectorId: string; modelId: string; label: string } | null;
    vision: { connectorId: string; modelId: string; label: string } | null;
    sttModelName: string | null;
    systemPrompt: string;
    defaultContextMode: AssistantContextMode;
  }): Promise<void> {
    const data = {
      chatConnectorId: input.chat?.connectorId ?? null,
      chatModelId: input.chat?.modelId ?? null,
      chatModelLabel: input.chat?.label ?? null,
      visionConnectorId: input.vision?.connectorId ?? null,
      visionModelId: input.vision?.modelId ?? null,
      visionModelLabel: input.vision?.label ?? null,
      sttModelName: input.sttModelName,
      systemPrompt: input.systemPrompt,
      defaultContextMode: input.defaultContextMode,
    };
    await this.db.brainAssistantProfile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, ...data },
      update: data,
    });
  }

  // --- Unterhaltungen -------------------------------------------------------

  async listConversations(limit = 50): Promise<AssistantConversationSummary[]> {
    const rows = await this.db.brainChatConversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { _count: { select: { messages: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      contextMode: row.contextMode as AssistantContextMode,
      modelLabel: row.modelLabel,
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count.messages,
    }));
  }

  async getConversation(id: string): Promise<AssistantConversationView | null> {
    const row = await this.db.brainChatConversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" }, include: { attachments: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      contextMode: row.contextMode as AssistantContextMode,
      connectorId: row.connectorId,
      modelId: row.modelId,
      modelLabel: row.modelLabel,
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count.messages,
      messages: row.messages.map(toMessageView),
    };
  }

  async createConversation(input: {
    title?: string;
    contextMode?: AssistantContextMode;
  } = {}): Promise<string> {
    const row = await this.db.brainChatConversation.create({
      data: {
        title: input.title?.trim() || UNTITLED,
        contextMode: input.contextMode ?? "plain",
      },
    });
    return row.id;
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await this.db.brainChatConversation.update({
      where: { id },
      data: { title: title.trim() || UNTITLED },
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.db.brainChatConversation.delete({ where: { id } });
  }

  async setConversationModel(
    id: string,
    model: { connectorId: string; modelId: string; label: string } | null,
  ): Promise<void> {
    await this.db.brainChatConversation.update({
      where: { id },
      data: {
        connectorId: model?.connectorId ?? null,
        modelId: model?.modelId ?? null,
        modelLabel: model?.label ?? null,
      },
    });
  }

  async setContextMode(id: string, contextMode: AssistantContextMode): Promise<void> {
    await this.db.brainChatConversation.update({ where: { id }, data: { contextMode } });
  }

  // --- Nachrichten & Anhänge ------------------------------------------------

  async appendMessage(input: AppendMessageInput): Promise<AssistantMessageView> {
    const message = await this.db.brainChatMessage.create({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        model: input.model ?? null,
        route: input.route ?? null,
        durationMs: input.durationMs ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    });

    if (input.attachmentIds && input.attachmentIds.length > 0) {
      await this.db.brainChatAttachment.updateMany({
        // Conversation-scoped: an attachment id from another chat is ignored.
        where: { id: { in: input.attachmentIds }, conversationId: input.conversationId },
        data: { messageId: message.id },
      });
    }

    // `updatedAt` drives the conversation list order — touch it on every turn.
    await this.db.brainChatConversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    const attachments = await this.db.brainChatAttachment.findMany({
      where: { messageId: message.id },
      orderBy: { createdAt: "asc" },
    });
    return toMessageView({ ...message, attachments });
  }

  async createAttachment(input: {
    conversationId: string;
    kind: AssistantAttachmentKind;
    storageKey: string;
    mimeType: string;
    originalFilename: string;
    sizeBytes: number;
  }): Promise<AssistantAttachmentView> {
    const row = await this.db.brainChatAttachment.create({ data: input });
    return toAttachmentView(row);
  }

  async setAttachmentText(
    id: string,
    extractedText: string,
    analysisJobId?: string | null,
  ): Promise<void> {
    await this.db.brainChatAttachment.update({
      where: { id },
      data: { extractedText, analysisJobId: analysisJobId ?? null },
    });
  }

  /**
   * Attachments of a pending turn. Scoped by conversation so an id from another
   * conversation cannot be smuggled into this turn.
   */
  async listPendingAttachments(
    conversationId: string,
    ids: string[],
  ): Promise<Array<AssistantAttachmentView & { storageKey: string }>> {
    if (ids.length === 0) return [];
    const rows = await this.db.brainChatAttachment.findMany({
      where: { id: { in: ids }, conversationId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({ ...toAttachmentView(row), storageKey: row.storageKey }));
  }

  /** Storage keys of every file below a conversation — used to clean up on delete. */
  async listStorageKeysForConversation(conversationId: string): Promise<string[]> {
    const rows = await this.db.brainChatAttachment.findMany({
      where: { conversationId },
      select: { storageKey: true },
    });
    return rows.map((row) => row.storageKey);
  }
}

export function createBrainAssistantService(db: BrainPrismaClient): BrainAssistantService {
  return new BrainAssistantService(db);
}
