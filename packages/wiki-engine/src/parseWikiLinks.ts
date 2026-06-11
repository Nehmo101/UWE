export interface ParsedWikiLink {
  /** Raw target text inside [[...]] before the pipe. */
  target: string;
  /** Optional display label after the pipe. */
  label?: string;
  /** Character offset where the wikilink starts in source text. */
  start: number;
  /** Character offset where the wikilink ends in source text. */
  end: number;
}

/** Parse [[wikilink]] syntax from markdown text. */
export function parseWikiLinks(text: string): ParsedWikiLink[] {
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: ParsedWikiLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    links.push({
      target: match[1].trim(),
      label: match[2]?.trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return links;
}

/** Legacy-compatible shape used by older tests. */
export interface WikiLink {
  source: string;
  target: string;
  label?: string;
}

export function parseWikiLinksLegacy(text: string): WikiLink[] {
  return parseWikiLinks(text).map((link) => ({
    source: "",
    target: link.target,
    label: link.label,
  }));
}
