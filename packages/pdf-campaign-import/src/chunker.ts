export const MAX_CHUNK_CHARS = 6_000;
export const MAX_CHUNKS = 20;

function appendChunk(chunks: string[], value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (chunks.length >= MAX_CHUNKS) {
    return false;
  }
  chunks.push(trimmed);
  return chunks.length < MAX_CHUNKS;
}

export function chunkPdfText(text: string): string[] {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const originalParagraph of paragraphs) {
    let paragraph = originalParagraph;
    while (paragraph.length > MAX_CHUNK_CHARS) {
      if (current && !appendChunk(chunks, current)) {
        return chunks;
      }
      current = "";
      if (!appendChunk(chunks, paragraph.slice(0, MAX_CHUNK_CHARS))) {
        return chunks;
      }
      paragraph = paragraph.slice(MAX_CHUNK_CHARS);
    }

    const combined = current ? current + "\n\n" + paragraph : paragraph;
    if (combined.length <= MAX_CHUNK_CHARS) {
      current = combined;
      continue;
    }

    if (!appendChunk(chunks, current)) {
      return chunks;
    }
    current = paragraph;
  }

  appendChunk(chunks, current);
  return chunks;
}
