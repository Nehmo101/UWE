import type { PageSummary } from "@uwe/database/server";
import { parseStringArray } from "@uwe/database/server";
import { staticExportCategoryForPageType } from "./paths";

export interface StaticSearchEntry {
  title: string;
  slug: string;
  category: string;
  href: string;
  summary: string;
  tags: string[];
  aliases: string[];
}

export function buildSearchIndex(
  pages: PageSummary[],
): StaticSearchEntry[] {
  return pages
    .map((page) => {
      const category = staticExportCategoryForPageType(page.type);
      return {
        title: page.title,
        slug: page.slug,
        category,
        href: `${category}/${page.slug}/`,
        summary: page.summary ?? "",
        tags: parseStringArray(page.tags),
        aliases: parseStringArray(page.aliases),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}
