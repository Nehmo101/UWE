export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface SearxngSearchOptions {
  baseUrl: string;
  query: string;
  limit?: number;
  timeoutMs?: number;
  /** SearXNG category filter, e.g. "news". */
  categories?: string;
  /** SearXNG time range filter, e.g. "day" for today's results. */
  timeRange?: "day" | "week" | "month" | "year";
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function resolveSearxngUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.SEARXNG_URL?.trim() || env.UWE_SEARXNG_URL?.trim();
  return value || null;
}

export async function searchSearxng(options: SearxngSearchOptions): Promise<WebSearchResult[]> {
  const limit = options.limit ?? 8;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    const url = new URL("/search", `${normalizeBaseUrl(options.baseUrl)}/`);
    url.searchParams.set("q", options.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "de-DE");
    if (options.categories) {
      url.searchParams.set("categories", options.categories);
    }
    if (options.timeRange) {
      url.searchParams.set("time_range", options.timeRange);
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`SearXNG-Suche fehlgeschlagen (${response.status}).`);
    }

    const data = (await response.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string }>;
    };

    return (data.results ?? [])
      .filter((entry) => entry.url)
      .slice(0, limit)
      .map((entry) => ({
        url: entry.url!,
        title: entry.title?.trim() || entry.url!,
        snippet: entry.content?.trim() || "",
      }));
  } finally {
    clearTimeout(timer);
  }
}

export function buildResearchReport(query: string, results: WebSearchResult[]): string {
  const lines = [`# Research: ${query}`, "", "## Quellen", ""];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    lines.push(`${index + 1}. [${result.title}](${result.url})`);
    if (result.snippet) {
      lines.push(`   ${result.snippet}`);
    }
    lines.push("");
  }
  if (results.length === 0) {
    lines.push("_Keine Web-Treffer gefunden._");
  }
  return lines.join("\n");
}
