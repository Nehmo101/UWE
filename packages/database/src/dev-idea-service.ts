import type { DevIdea, DevIdeaLifecycle, DevIdeaStatus, DevIdeaType } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

export type { DevIdea, DevIdeaLifecycle, DevIdeaStatus, DevIdeaType } from "./generated/prisma/client";

export { DevIdeaStatus as DevIdeaStatusEnum } from "./generated/prisma/client";
export { DevIdeaType as DevIdeaTypeEnum } from "./generated/prisma/client";
export { DevIdeaLifecycle as DevIdeaLifecycleEnum } from "./generated/prisma/client";

export const DEV_IDEA_STATUS_LABELS: Record<DevIdeaStatus, string> = {
  in_planning: "In Planung",
  implemented: "Umgesetzt",
  rejected: "Abgelehnt",
};

export const DEV_IDEA_TYPE_LABELS: Record<DevIdeaType, string> = {
  feature: "Feature",
  bug: "Bug",
  prompt: "Prompt",
};

export const DEV_IDEA_LIFECYCLE_LABELS: Record<DevIdeaLifecycle, string> = {
  existing: "Vorhanden",
  planned: "Geplant",
  broken: "Defekt",
  deprecated: "Veraltet",
};

export const DEV_IDEA_STATUSES: readonly DevIdeaStatus[] = [
  "in_planning",
  "implemented",
  "rejected",
];

export type DevIdeaChatRole = "user" | "assistant";

export interface DevIdeaChatMessage {
  role: DevIdeaChatRole;
  content: string;
  createdAt: string;
  /** Resolved backend route for assistant turns (e.g. "local_engine" or "cloud"). */
  via?: string;
}

/**
 * A single image attachment linked to a dev idea. Only the asset reference is
 * persisted; the binary lives in the asset store and is served via the studio
 * `/api/assets/:id/file` route.
 */
export interface DevIdeaAttachment {
  assetId: string;
  title?: string;
  mimeType?: string;
}

export interface CreateDevIdeaInput {
  title: string;
  body?: string;
  status?: DevIdeaStatus;
  ideaType?: DevIdeaType;
  lifecycle?: DevIdeaLifecycle;
  module?: string | null;
  maturityLevel?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateDevIdeaInput {
  title?: string;
  body?: string;
  status?: DevIdeaStatus;
  ideaType?: DevIdeaType;
  lifecycle?: DevIdeaLifecycle;
  module?: string | null;
  maturityLevel?: string | null;
  generatedPrompt?: string | null;
  attachments?: DevIdeaAttachment[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListDevIdeasOptions {
  status?: DevIdeaStatus;
  ideaType?: DevIdeaType;
  lifecycle?: DevIdeaLifecycle;
  module?: string;
  limit?: number;
}

/** Parse a persisted `chatTranscript` JSON column into typed chat messages. */
export function parseDevIdeaTranscript(value: unknown): DevIdeaChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): DevIdeaChatMessage[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    const role = candidate.role;
    const content = candidate.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return [];
    }
    return [
      {
        role,
        content,
        createdAt:
          typeof candidate.createdAt === "string"
            ? candidate.createdAt
            : new Date().toISOString(),
        ...(typeof candidate.via === "string" ? { via: candidate.via } : {}),
      },
    ];
  });
}

/** Parse a persisted `attachments` JSON column into typed image attachments. */
export function parseIdeaAttachments(value: unknown): DevIdeaAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): DevIdeaAttachment[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    const assetId = candidate.assetId;
    if (typeof assetId !== "string" || !assetId) {
      return [];
    }
    return [
      {
        assetId,
        ...(typeof candidate.title === "string" ? { title: candidate.title } : {}),
        ...(typeof candidate.mimeType === "string" ? { mimeType: candidate.mimeType } : {}),
      },
    ];
  });
}

export class DevIdeaService {
  constructor(private readonly db: PrismaClient) {}

  async listIdeas(options: ListDevIdeasOptions = {}): Promise<DevIdea[]> {
    return this.db.devIdea.findMany({
      where: {
        ...(options.status ? { status: options.status } : {}),
        ...(options.ideaType ? { ideaType: options.ideaType } : {}),
        ...(options.lifecycle ? { lifecycle: options.lifecycle } : {}),
        ...(options.module ? { module: options.module } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 200,
    });
  }

  async getIdea(id: string): Promise<DevIdea | null> {
    return this.db.devIdea.findUnique({ where: { id } });
  }

  async createIdea(input: CreateDevIdeaInput): Promise<DevIdea> {
    const title = input.title.trim();
    if (!title) {
      throw new Error("Titel ist erforderlich.");
    }
    return this.db.devIdea.create({
      data: {
        title,
        body: input.body ?? "",
        status: input.status ?? "in_planning",
        ideaType: input.ideaType ?? "feature",
        lifecycle: input.lifecycle ?? "planned",
        module: input.module ?? null,
        maturityLevel: input.maturityLevel ?? null,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateIdea(id: string, input: UpdateDevIdeaInput): Promise<DevIdea> {
    return this.db.devIdea.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.ideaType !== undefined ? { ideaType: input.ideaType } : {}),
        ...(input.lifecycle !== undefined ? { lifecycle: input.lifecycle } : {}),
        ...(input.module !== undefined ? { module: input.module } : {}),
        ...(input.maturityLevel !== undefined ? { maturityLevel: input.maturityLevel } : {}),
        ...(input.generatedPrompt !== undefined
          ? { generatedPrompt: input.generatedPrompt }
          : {}),
        ...(input.attachments !== undefined
          ? { attachments: toPrismaJsonValue(input.attachments) }
          : {}),
        ...(input.metadata !== undefined
          ? { metadata: toPrismaJsonValue(input.metadata) }
          : {}),
      },
    });
  }

  async updateStatus(id: string, status: DevIdeaStatus): Promise<DevIdea> {
    return this.db.devIdea.update({ where: { id }, data: { status } });
  }

  async setGeneratedPrompt(id: string, prompt: string | null): Promise<DevIdea> {
    return this.db.devIdea.update({ where: { id }, data: { generatedPrompt: prompt } });
  }

  async getAttachments(id: string): Promise<DevIdeaAttachment[]> {
    const idea = await this.getIdea(id);
    if (!idea) {
      throw new Error("Idee nicht gefunden.");
    }
    return parseIdeaAttachments(idea.attachments);
  }

  /** Replace the idea's image attachments with the given list (order preserved). */
  async setAttachments(id: string, attachments: DevIdeaAttachment[]): Promise<DevIdea> {
    return this.db.devIdea.update({
      where: { id },
      data: { attachments: toPrismaJsonValue(attachments) },
    });
  }

  async getTranscript(id: string): Promise<DevIdeaChatMessage[]> {
    const idea = await this.getIdea(id);
    if (!idea) {
      throw new Error("Idee nicht gefunden.");
    }
    return parseDevIdeaTranscript(idea.chatTranscript);
  }

  async setTranscript(id: string, messages: DevIdeaChatMessage[]): Promise<DevIdea> {
    return this.db.devIdea.update({
      where: { id },
      data: { chatTranscript: toPrismaJsonValue(messages) },
    });
  }

  /** Append one or more messages to an idea's chat transcript and persist. */
  async appendChatMessages(
    id: string,
    messages: DevIdeaChatMessage[],
  ): Promise<{ idea: DevIdea; transcript: DevIdeaChatMessage[] }> {
    const existing = await this.getIdea(id);
    if (!existing) {
      throw new Error("Idee nicht gefunden.");
    }
    const transcript = [...parseDevIdeaTranscript(existing.chatTranscript), ...messages];
    const idea = await this.db.devIdea.update({
      where: { id },
      data: { chatTranscript: toPrismaJsonValue(transcript) },
    });
    return { idea, transcript };
  }

  async clearTranscript(id: string): Promise<DevIdea> {
    return this.db.devIdea.update({ where: { id }, data: { chatTranscript: toPrismaJsonValue([]) } });
  }

  async deleteIdea(id: string): Promise<DevIdea> {
    return this.db.devIdea.delete({ where: { id } });
  }
}

export function createDevIdeaService(db: PrismaClient): DevIdeaService {
  return new DevIdeaService(db);
}
