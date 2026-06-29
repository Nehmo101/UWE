import type { DevIdea, DevIdeaStatus } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

export type { DevIdea, DevIdeaStatus } from "./generated/prisma/client";

export { DevIdeaStatus as DevIdeaStatusEnum } from "./generated/prisma/client";

export const DEV_IDEA_STATUS_LABELS: Record<DevIdeaStatus, string> = {
  in_planning: "In Planung",
  implemented: "Umgesetzt",
  rejected: "Abgelehnt",
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
  /** Resolved backend route for assistant turns (e.g. "local_rtx" or "cloud"). */
  via?: string;
}

export interface CreateDevIdeaInput {
  title: string;
  body?: string;
  status?: DevIdeaStatus;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateDevIdeaInput {
  title?: string;
  body?: string;
  status?: DevIdeaStatus;
  generatedPrompt?: string | null;
  devAgentJobId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListDevIdeasOptions {
  status?: DevIdeaStatus;
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

export class DevIdeaService {
  constructor(private readonly db: PrismaClient) {}

  async listIdeas(options: ListDevIdeasOptions = {}): Promise<DevIdea[]> {
    return this.db.devIdea.findMany({
      where: options.status ? { status: options.status } : undefined,
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
        ...(input.generatedPrompt !== undefined
          ? { generatedPrompt: input.generatedPrompt }
          : {}),
        ...(input.devAgentJobId !== undefined
          ? { devAgentJobId: input.devAgentJobId }
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

  async linkAgentJob(id: string, devAgentJobId: string | null): Promise<DevIdea> {
    return this.db.devIdea.update({ where: { id }, data: { devAgentJobId } });
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
