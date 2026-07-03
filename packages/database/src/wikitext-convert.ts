import { parseWikiLinks } from "./wikilink-utils";
import { normalizeLookupKey } from "./slug-utils";

/**
 * Wikitext conversion — the shared conversion core for single blocks and the
 * bulk "Alle Wikitexte konvertieren" admin action.
 *
 * Two deterministic, idempotent steps:
 * 1. `structureWikitext` — normalizes the markdown structure (headings,
 *    lists, blank lines) without touching code fences.
 * 2. `autoLinkWikitext` — turns the first plain-text mention of another
 *    page (title or alias) into a [[Wikilink]] so the world graph gets
 *    real connections. Existing links, code, and headings stay untouched.
 */

export interface WikitextLinkTerm {
  /** Text to match in prose (a page title or alias). */
  term: string;
  /** Canonical wikilink target (the page title). */
  target: string;
}

export interface WikitextAddedLink {
  target: string;
  matched: string;
}

export interface WikitextConversionResult {
  content: string;
  changed: boolean;
  /** Structure normalization changed the text. */
  structured: boolean;
  /** Wikilinks added by auto-linking. */
  addedLinks: WikitextAddedLink[];
}

export interface WikitextConversionOptions {
  /** Normalize markdown structure (default true). */
  structure?: boolean;
  /** Auto-link mentions of known pages (default true). */
  autoLink?: boolean;
  /** Minimum term length for auto-linking (default 3). */
  minTermLength?: number;
}

interface ProtectedRange {
  start: number;
  end: number;
}

const DEFAULT_MIN_TERM_LENGTH = 3;

function isFenceLine(line: string): RegExpExecArray | null {
  return /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
}

/**
 * Normalize markdown structure without changing meaning:
 * - CRLF → LF, trailing whitespace stripped
 * - `#Titel` → `# Titel`, trailing `###` decorations removed
 * - `*` / `+` bullets → `-`
 * - blank lines before/after headings, runs of blank lines collapsed
 * - code fences (``` / ~~~) pass through untouched
 */
export function structureWikitext(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const normalized: Array<{ text: string; inFence: boolean }> = [];

  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (const line of lines) {
    const fenceMatch = isFenceLine(line);

    if (inFence) {
      normalized.push({ text: line, inFence: true });
      if (
        fenceMatch &&
        fenceMatch[2][0] === fenceChar &&
        fenceMatch[2].length >= fenceLength &&
        fenceMatch[3].trim() === ""
      ) {
        inFence = false;
      }
      continue;
    }

    if (fenceMatch) {
      inFence = true;
      fenceChar = fenceMatch[2][0];
      fenceLength = fenceMatch[2].length;
      normalized.push({ text: line, inFence: true });
      continue;
    }

    let text = line.replace(/\s+$/, "");

    // "#Titel" → "# Titel", "## Titel ##" → "## Titel"
    const headingMatch = /^(#{1,6})(\s*)(.*)$/.exec(text);
    if (headingMatch && (headingMatch[2] || headingMatch[3] === "")) {
      const title = headingMatch[3].replace(/\s+#+$/, "").trim();
      text = title ? `${headingMatch[1]} ${title}` : headingMatch[1];
    } else if (headingMatch) {
      // "#Titel" without space — but leave hashtags like "#42" or "#tag" that
      // are not intended as headings? Markdown treats "#Titel" as plain text,
      // ATX headings require a space. We only promote it when the rest looks
      // like a title (starts with a letter), which matches how these texts
      // are written in practice.
      const rest = headingMatch[3].replace(/\s+#+$/, "").trim();
      if (/^\p{L}/u.test(rest)) {
        text = `${headingMatch[1]} ${rest}`;
      }
    }

    // "* Punkt" / "+ Punkt" → "- Punkt"
    text = text.replace(/^(\s*)[*+](\s+)/, "$1-$2");

    normalized.push({ text, inFence: false });
  }

  // Blank lines around headings + collapse blank runs (outside fences).
  const out: Array<{ text: string; inFence: boolean }> = [];
  for (const line of normalized) {
    const isBlank = !line.inFence && line.text.trim() === "";
    const isHeading = !line.inFence && /^#{1,6}(\s|$)/.test(line.text);
    const last = out[out.length - 1];

    if (isBlank) {
      if (!last || (last.text.trim() === "" && !last.inFence)) continue;
      out.push({ text: "", inFence: false });
      continue;
    }

    if (isHeading && last && !(last.text.trim() === "" && !last.inFence)) {
      out.push({ text: "", inFence: false });
    }
    out.push(line);

    if (isHeading) {
      out.push({ text: "", inFence: false });
    }
  }

  // Trim leading/trailing blank lines.
  while (out.length > 0 && out[0].text.trim() === "" && !out[0].inFence) out.shift();
  while (
    out.length > 0 &&
    out[out.length - 1].text.trim() === "" &&
    !out[out.length - 1].inFence
  ) {
    out.pop();
  }

  return out.map((line) => line.text).join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordChar(char: string | undefined): boolean {
  if (!char) return false;
  return /[\p{L}\p{N}]/u.test(char);
}

function overlaps(ranges: ProtectedRange[], start: number, end: number): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

/** Collect regions that auto-linking must never touch. */
function collectProtectedRanges(content: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];

  for (const link of parseWikiLinks(content)) {
    ranges.push({ start: link.start, end: link.end });
  }

  // Markdown links/images: [Text](url) / ![Alt](url)
  const mdLinkPattern = /!?\[[^\]\n]*\]\([^)\n]*\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLinkPattern.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Inline code spans — CommonMark allows runs of N backticks as delimiter
  // (e.g. ``code with ` inside``), so match same-length runs, not just one.
  const inlineCodePattern = /(`+)[^\n]*?(?<!`)\1(?!`)/g;
  while ((match = inlineCodePattern.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Heading lines and fenced code blocks (line-based, offset-tracked).
  let offset = 0;
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  for (const line of content.split("\n")) {
    const lineEnd = offset + line.length;
    const fenceMatch = isFenceLine(line);

    if (inFence) {
      ranges.push({ start: offset, end: lineEnd });
      if (
        fenceMatch &&
        fenceMatch[2][0] === fenceChar &&
        fenceMatch[2].length >= fenceLength &&
        fenceMatch[3].trim() === ""
      ) {
        inFence = false;
      }
    } else if (fenceMatch) {
      inFence = true;
      fenceChar = fenceMatch[2][0];
      fenceLength = fenceMatch[2].length;
      ranges.push({ start: offset, end: lineEnd });
    } else if (/^#{1,6}\s/.test(line)) {
      ranges.push({ start: offset, end: lineEnd });
    }

    offset = lineEnd + 1;
  }

  return ranges;
}

/**
 * Link the first plain-text mention of each known page. Longer terms win over
 * shorter ones ("Schwarzer Turm" before "Turm"); every term links at most
 * once per text so prose does not drown in duplicate links.
 */
export function autoLinkWikitext(
  content: string,
  terms: WikitextLinkTerm[],
  options?: { minTermLength?: number },
): { content: string; addedLinks: WikitextAddedLink[] } {
  const minLength = options?.minTermLength ?? DEFAULT_MIN_TERM_LENGTH;

  const seen = new Set<string>();
  const candidates = terms
    .filter((entry) => entry.term.trim().length >= minLength)
    .filter((entry) => {
      const key = normalizeLookupKey(entry.term);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.term.length - a.term.length || a.term.localeCompare(b.term, "de"));

  if (candidates.length === 0) {
    return { content, addedLinks: [] };
  }

  const protectedRanges = collectProtectedRanges(content);
  const insertions: Array<{ start: number; end: number; replacement: string; link: WikitextAddedLink }> = [];
  const linkedTargets = new Set<string>();

  for (const candidate of candidates) {
    if (linkedTargets.has(normalizeLookupKey(candidate.target))) continue;

    const pattern = new RegExp(escapeRegExp(candidate.term.trim()), "giu");
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (isWordChar(content[start - 1]) || isWordChar(content[end])) continue;
      if (overlaps(protectedRanges, start, end)) continue;
      if (overlaps(insertions, start, end)) continue;

      const matched = match[0];
      const replacement =
        matched === candidate.target ? `[[${matched}]]` : `[[${candidate.target}|${matched}]]`;

      insertions.push({
        start,
        end,
        replacement,
        link: { target: candidate.target, matched },
      });
      linkedTargets.add(normalizeLookupKey(candidate.target));
      break;
    }
  }

  if (insertions.length === 0) {
    return { content, addedLinks: [] };
  }

  insertions.sort((a, b) => a.start - b.start);

  let result = "";
  let cursor = 0;
  for (const insertion of insertions) {
    result += content.slice(cursor, insertion.start) + insertion.replacement;
    cursor = insertion.end;
  }
  result += content.slice(cursor);

  return {
    content: result,
    addedLinks: insertions.map((insertion) => insertion.link),
  };
}

/** Structure first, then auto-link — the full conversion for one text block. */
export function convertWikitext(
  content: string,
  terms: WikitextLinkTerm[],
  options?: WikitextConversionOptions,
): WikitextConversionResult {
  const structureEnabled = options?.structure ?? true;
  const autoLinkEnabled = options?.autoLink ?? true;

  const structuredContent = structureEnabled ? structureWikitext(content) : content;
  const structured = structuredContent !== content;

  const linked = autoLinkEnabled
    ? autoLinkWikitext(structuredContent, terms, { minTermLength: options?.minTermLength })
    : { content: structuredContent, addedLinks: [] };

  return {
    content: linked.content,
    changed: linked.content !== content,
    structured,
    addedLinks: linked.addedLinks,
  };
}

/**
 * Build auto-link terms for one page from the world's page index:
 * titles and aliases of all *other* pages, titles before aliases so the
 * canonical name wins when both normalize to the same key.
 */
export function buildWikitextLinkTerms(
  pages: Array<{ id: string; title: string; aliases: string[] }>,
  currentPageId: string,
): WikitextLinkTerm[] {
  const titleTerms: WikitextLinkTerm[] = [];
  const aliasTerms: WikitextLinkTerm[] = [];

  for (const page of pages) {
    if (page.id === currentPageId) continue;
    const title = page.title.trim();
    if (!title) continue;

    titleTerms.push({ term: title, target: title });
    for (const alias of page.aliases) {
      const trimmed = alias.trim();
      if (trimmed) {
        aliasTerms.push({ term: trimmed, target: title });
      }
    }
  }

  return [...titleTerms, ...aliasTerms];
}
