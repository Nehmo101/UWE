/**
 * Überschriften-treuer Chunker für layout-erhaltendes Markdown (OCR-Pfad).
 *
 * `chunkPdfText` schneidet alle ~6000 Zeichen an Absatzgrenzen — bei flachem
 * pdf-parse-Text ist das die einzige Option. Sobald die Extraktion Markdown mit
 * echten Überschriften liefert, ist es die schlechtere: ein NPC landet dann im
 * einen Chunk, sein Statblock im nächsten, und die lokale KI sieht nie beide
 * zusammen. Hier wird stattdessen an `#`-Grenzen geschnitten und ein Abschnitt
 * nur dann geteilt, wenn er allein schon zu groß ist.
 */

import { MAX_CHUNK_CHARS, MAX_CHUNKS, chunkPdfText } from "./chunker";

const HEADING = /^(#{1,6})\s+\S/;

interface MarkdownSection {
  /** Überschriftenebene; 0 für Text vor der ersten Überschrift. */
  level: number;
  text: string;
}

/** Zerlegt Markdown in Abschnitte, jeweils Überschrift plus zugehöriger Text. */
export function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;

  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading) {
      if (current && current.text.trim()) {
        sections.push(current);
      }
      current = { level: heading[1]?.length ?? 1, text: line };
      continue;
    }
    if (!current) {
      current = { level: 0, text: line };
      continue;
    }
    current.text += "\n" + line;
  }

  if (current && current.text.trim()) {
    sections.push(current);
  }
  return sections;
}

/** True, wenn der Text genug Struktur trägt, dass sich das Schneiden lohnt. */
export function hasMarkdownStructure(markdown: string): boolean {
  return splitMarkdownSections(markdown).some((section) => section.level > 0);
}

/**
 * Chunkt an Überschriften. Aufeinanderfolgende Abschnitte werden gebündelt,
 * solange sie zusammen unter `MAX_CHUNK_CHARS` bleiben — so wandern kurze
 * Unterabschnitte mit ihrem Elternabschnitt in denselben Chunk. Zu große
 * Einzelabschnitte fallen auf die Absatz-Zerlegung von `chunkPdfText` zurück.
 */
export function chunkMarkdownBySections(markdown: string): string[] {
  const sections = splitMarkdownSections(markdown);
  const chunks: string[] = [];
  let current = "";

  const flush = (): boolean => {
    const trimmed = current.trim();
    current = "";
    if (!trimmed) return true;
    if (chunks.length >= MAX_CHUNKS) return false;
    chunks.push(trimmed);
    return chunks.length < MAX_CHUNKS;
  };

  for (const section of sections) {
    const text = section.text.trim();
    if (!text) continue;

    if (text.length > MAX_CHUNK_CHARS) {
      if (!flush()) return chunks;
      for (const piece of chunkPdfText(text)) {
        if (chunks.length >= MAX_CHUNKS) return chunks;
        chunks.push(piece);
      }
      continue;
    }

    const combined = current ? current + "\n\n" + text : text;
    if (combined.length <= MAX_CHUNK_CHARS) {
      current = combined;
      continue;
    }
    if (!flush()) return chunks;
    current = text;
  }

  flush();
  return chunks;
}

/**
 * Wählt die passende Zerlegung: Überschriften, wenn welche da sind, sonst der
 * bisherige Absatz-Schnitt. Aufrufer müssen die Herkunft des Textes nicht kennen.
 */
export function chunkCampaignText(text: string): string[] {
  return hasMarkdownStructure(text) ? chunkMarkdownBySections(text) : chunkPdfText(text);
}
