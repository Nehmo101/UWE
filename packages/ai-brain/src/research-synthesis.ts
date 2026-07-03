/**
 * Research synthesis: turns raw web-search hits into an LLM-written report.
 * Pure prompt/report helpers — the gateway call happens in the app layer,
 * where the personal-brain context loader lives.
 */

export interface ResearchSourceInput {
  url: string;
  title: string;
  snippet: string;
}

/** Prompt for the synthesize_research task: query + numbered web sources. */
export function buildResearchSynthesisPrompt(
  query: string,
  results: ResearchSourceInput[],
): string {
  const sources = results.map((result, index) => {
    const lines = [`[${index + 1}] ${result.title} — ${result.url}`];
    if (result.snippet) {
      lines.push(`    ${result.snippet}`);
    }
    return lines.join("\n");
  });

  return [
    `Recherche-Frage: ${query}`,
    "",
    "Web-Quellen (Titel + Auszug):",
    ...(sources.length > 0 ? sources : ["(keine Web-Treffer)"]),
    "",
    "Erstelle daraus einen strukturierten Recherche-Report auf Deutsch (Markdown):",
    "1. Kurzantwort (2–4 Sätze).",
    "2. Erkenntnisse als Stichpunkte, jeweils mit Quellenverweis [n].",
    "3. Offene Fragen / Unsicherheiten.",
    "Stütze dich nur auf die Quellen und klar gekennzeichnetes Allgemeinwissen. Erfinde keine Fakten.",
  ].join("\n");
}

/** Append the raw source list so the report stays traceable even after synthesis. */
export function appendResearchSources(
  reportMd: string,
  results: ResearchSourceInput[],
): string {
  const lines = [reportMd.trim(), "", "## Quellen", ""];
  if (results.length === 0) {
    lines.push("_Keine Web-Treffer gefunden._");
  }
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    lines.push(`${index + 1}. [${result.title}](${result.url})`);
  }
  return lines.join("\n");
}
