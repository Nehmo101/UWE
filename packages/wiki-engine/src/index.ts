/**
 * UWE Wiki Engine — placeholder for Phase 3.
 * Planned: Obsidian-style [[wikilinks]], backlinks, graph navigation.
 */

export const WIKI_ENGINE_VERSION = "0.1.0";

export interface WikiLink {
  source: string;
  target: string;
  label?: string;
}

/** Parse [[wikilink]] syntax from markdown text. */
export function parseWikiLinks(text: string): WikiLink[] {
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    links.push({
      source: "",
      target: match[1].trim(),
      label: match[2]?.trim(),
    });
  }

  return links;
}
