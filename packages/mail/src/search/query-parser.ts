/**
 * Parses a mail search box string into structured filters plus free text.
 * Supported operators: from:x  has:attachment  before:YYYY-MM-DD  after:YYYY-MM-DD
 * Everything else is treated as free-text terms. Pure and unit-testable.
 */

export interface ParsedMailQuery {
  text: string;
  from: string | null;
  hasAttachment: boolean;
  before: Date | null;
  after: Date | null;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseMailQuery(raw: string | null | undefined): ParsedMailQuery {
  const result: ParsedMailQuery = {
    text: "",
    from: null,
    hasAttachment: false,
    before: null,
    after: null,
  };
  if (!raw?.trim()) return result;

  const terms: string[] = [];
  // Split on whitespace but keep quoted phrases together.
  const tokens = raw.trim().match(/"[^"]+"|\S+/g) ?? [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.startsWith("from:")) {
      const value = token.slice(5).replace(/^"|"$/g, "").trim();
      if (value) result.from = value;
    } else if (lower === "has:attachment" || lower === "has:attachments") {
      result.hasAttachment = true;
    } else if (lower.startsWith("before:")) {
      result.before = parseDate(token.slice(7).trim());
    } else if (lower.startsWith("after:")) {
      result.after = parseDate(token.slice(6).trim());
    } else {
      terms.push(token.replace(/^"|"$/g, ""));
    }
  }
  result.text = terms.join(" ").trim();
  return result;
}

/**
 * Builds a safe FTS5 MATCH expression from free text: each term is quoted (so
 * FTS operators in user input are treated literally) and prefix-matched.
 * Returns null when there is no usable text to match.
 */
export function buildFtsMatchExpression(text: string): string | null {
  const terms = text
    .split(/\s+/)
    .map((t) => t.replace(/["]/g, "").trim())
    .filter((t) => t.length > 0);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term}"*`).join(" AND ");
}
