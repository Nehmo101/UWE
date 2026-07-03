import { Prisma } from "./generated/prisma/client";

/**
 * Sentinel zum expliziten Nullen einer nullable Json-Spalte in einem Prisma-
 * Update (`toPrismaJsonValue(null)` liefert `undefined` = „nicht ändern").
 */
export const jsonDbNull: typeof Prisma.DbNull = Prisma.DbNull;

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function parseTagsFromMetadata(metadata: unknown): string[] {
  if (typeof metadata !== "object" || metadata === null) {
    return [];
  }
  return parseStringArray((metadata as Record<string, unknown>).tags);
}

export function asMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (typeof metadata !== "object" || metadata === null) {
    return {};
  }
  return { ...(metadata as Record<string, unknown>) };
}

export function toJsonArray(values: string[] | undefined): string[] {
  return values ?? [];
}

export function toPrismaJsonValue(value: null | undefined): undefined;
export function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue;
export function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function withParsedArrays<T extends { tags: unknown; aliases: unknown }>(
  page: T,
): T & { tags: string[]; aliases: string[] } {
  return {
    ...page,
    tags: parseStringArray(page.tags),
    aliases: parseStringArray(page.aliases),
  };
}
