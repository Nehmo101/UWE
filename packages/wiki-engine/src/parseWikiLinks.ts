import {
  parseWikiLinks as parseWikiLinksFromDatabase,
  type ParsedWikiLink,
} from "@uwe/database";

export type { ParsedWikiLink };
export { parseWikiLinksFromDatabase as parseWikiLinks };

/** Legacy-compatible shape used by older tests. */
export interface WikiLink {
  source: string;
  target: string;
  label?: string;
}

export function parseWikiLinksLegacy(text: string): WikiLink[] {
  return parseWikiLinksFromDatabase(text).map((link) => ({
    source: "",
    target: link.target,
    label: link.label,
  }));
}
