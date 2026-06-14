import type { AiTaskType, AiContextBrainEntry, BrainVisibility } from "../types";

export interface BrainKnowledgeEntry {
  id: string;
  title: string;
  content: string;
  visibility: BrainVisibility;
  sourceType: string;
  objectRef?: string | null;
  trustLevel?: string | null;
}

export interface BrainKnowledgeQuery {
  worldId: string;
  campaignId?: string;
  sessionId?: string;
  pageId?: string;
  taskType: AiTaskType;
  allowDmOnly: boolean;
  maxEntries?: number;
}

export interface BrainKnowledgeSource {
  findRelevant(query: BrainKnowledgeQuery): Promise<BrainKnowledgeEntry[]>;
}

export const emptyBrainKnowledgeSource: BrainKnowledgeSource = {
  async findRelevant() {
    return [];
  },
};

export function toContextBrainEntry(entry: BrainKnowledgeEntry): AiContextBrainEntry {
  return {
    entryId: entry.id,
    title: entry.title,
    content: entry.content,
    visibility: entry.visibility,
    sourceType: entry.sourceType,
    objectRef: entry.objectRef,
    trustLevel: entry.trustLevel,
  };
}

export function serializeBrainEntries(entries: AiContextBrainEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  const blocks = entries.map((entry) =>
    [
      `### ${entry.title} (${entry.entryId})`,
      `Quelle: ${entry.sourceType}`,
      `Sichtbarkeit: ${entry.visibility}`,
      entry.trustLevel ? `Vertrauen: ${entry.trustLevel}` : "",
      entry.objectRef ? `Bezug: ${entry.objectRef}` : "",
      entry.content,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return ["# DnD-Brain-Wissen", ...blocks].join("\n\n");
}

export function serializeLifeBrainEntries(entries: AiContextBrainEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  const blocks = entries.map((entry) =>
    [
      `### ${entry.title} (${entry.entryId})`,
      `Quelle: ${entry.sourceType}`,
      entry.trustLevel ? `Status: ${entry.trustLevel}` : "",
      entry.objectRef ? `Bezug: ${entry.objectRef}` : "",
      entry.content,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return ["# Life-Brain (privat, lokal)", ...blocks].join("\n\n");
}
