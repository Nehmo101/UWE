import {
  EXTRACTABLE_KINDS,
  type ExtractedCampaignEntity,
  type ExtractedCampaignEntityKind,
} from "./entity-schema";

const EXTRACTABLE_KIND_SET = new Set<string>(EXTRACTABLE_KINDS);

function parseJsonArray(content: string): unknown[] | null {
  const trimmed = content.trim();
  const candidates = new Set<string>([trimmed]);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)?.[1]?.trim();
  if (fenced) {
    candidates.add(fenced);
  }
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.add(trimmed.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next tolerant representation.
    }
  }
  return null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseEntity(value: unknown): ExtractedCampaignEntity | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const title = optionalText(record.title);
  const body = optionalText(record.body);
  if (!title || !body) {
    return null;
  }

  const rawKind = typeof record.kind === "string" ? record.kind.trim().toLowerCase() : "";
  const kind: ExtractedCampaignEntityKind = EXTRACTABLE_KIND_SET.has(rawKind)
    ? (rawKind as ExtractedCampaignEntityKind)
    : "note";
  const summary = optionalText(record.summary);
  const tags = Array.isArray(record.tags)
    ? [
        ...new Set(
          record.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ]
    : [];

  return {
    kind,
    title,
    summary,
    body,
    tags,
  };
}

export function parseCampaignEntities(aiText: string): ExtractedCampaignEntity[] {
  const parsed = parseJsonArray(aiText);
  if (!parsed) {
    return [];
  }
  return parsed
    .map(parseEntity)
    .filter((entity): entity is ExtractedCampaignEntity => entity !== null);
}
