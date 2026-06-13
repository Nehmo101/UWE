import type { AiContextPage } from "../types";

export function serializePageForBudget(page: AiContextPage): string {
  const blocks = page.contentBlocks.map((b) => `[${b.type}] ${b.content}`).join("\n");
  const relations = page.relations
    .map(
      (r) =>
        `- ${r.direction === "outgoing" ? "→" : "←"} ${r.targetTitle} (${r.targetPageId}): ${r.relationType}`,
    )
    .join("\n");
  const backlinks = page.backlinks
    .map((b) => `- ← ${b.sourceTitle} (${b.sourcePageId})`)
    .join("\n");

  return [
    `## ${page.title} (${page.pageId})`,
    `Typ: ${page.pageType}`,
    `Sichtbarkeit: ${page.visibility}`,
    `Kanon: ${page.canonicalStatus}`,
    page.summary ? `Zusammenfassung: ${page.summary}` : "",
    page.tags.length ? `Tags: ${page.tags.join(", ")}` : "",
    page.aliases.length ? `Aliase: ${page.aliases.join(", ")}` : "",
    relations ? `Relationen:\n${relations}` : "",
    backlinks ? `Backlinks:\n${backlinks}` : "",
    blocks,
  ]
    .filter(Boolean)
    .join("\n");
}

export function truncateContextPages(
  pages: AiContextPage[],
  maxChars: number,
): { pages: AiContextPage[]; truncated: boolean; usedChars: number } {
  let total = 0;
  const result: AiContextPage[] = [];
  let truncated = false;

  for (const page of pages) {
    const serialized = serializePageForBudget(page);
    if (total + serialized.length > maxChars) {
      truncated = true;
      const remaining = maxChars - total;
      if (remaining > 200) {
        result.push({
          ...page,
          contentBlocks: [
            {
              blockId: "truncated",
              type: "truncated",
              visibility: page.visibility,
              content: `${serialized.slice(0, remaining - 20)}… [gekürzt]`,
            },
          ],
        });
        total = maxChars;
      }
      break;
    }
    total += serialized.length;
    result.push(page);
  }

  return { pages: result, truncated, usedChars: total };
}
