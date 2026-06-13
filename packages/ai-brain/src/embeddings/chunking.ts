import type { ChunkBrainTextOptions } from "./types";

export const DEFAULT_CHUNK_SIZE = 800;
export const DEFAULT_CHUNK_OVERLAP = 100;

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export function chunkBrainText(
  text: string,
  options?: ChunkBrainTextOptions,
): string[] {
  const maxChars = options?.maxChars ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(options?.overlap ?? DEFAULT_CHUNK_OVERLAP, maxChars - 1);
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized && !options?.includeTitle?.trim()) {
    return [];
  }

  const body = options?.includeTitle?.trim()
    ? `${options.includeTitle.trim()}\n\n${normalized}`.trim()
    : normalized;

  if (!body) {
    return [];
  }

  if (body.length <= maxChars) {
    return [body];
  }

  const paragraphs = body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongText(paragraph, maxChars, overlap));
      continue;
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function splitLongText(text: string, maxChars: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
