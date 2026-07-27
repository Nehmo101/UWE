import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalSearchForm, PageTypeBadge } from "@uwe/shared-ui";
import { NAV_CATEGORY_LABELS, navCategoryForPageType, type NavCategory } from "@uwe/database/server";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

const NAV_ORDER: NavCategory[] = [
  "lore",
  "orte",
  "npcs",
  "fraktionen",
  "sessions",
  "handouts",
  "karten",
];

export default async function AuthWorldWikiPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let pages;
  try {
    pages = await auth.listPagesForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  const query = q?.trim().toLocaleLowerCase("de") ?? "";
  const filtered = query
    ? pages.filter((page) => {
        const haystack = [page.title, page.slug, page.summary ?? ""]
          .join(" ")
          .toLocaleLowerCase("de");
        return haystack.includes(query);
      })
    : pages;

  const grouped = new Map<NavCategory, typeof filtered>();
  for (const page of filtered) {
    const category = navCategoryForPageType(page.type);
    const bucket = grouped.get(category) ?? [];
    bucket.push(page);
    grouped.set(category, bucket);
  }

  return (
    <>
      <PageHeader
        title="Wiki"
        summary="Alle Wiki-Seiten dieser Welt."
      />

      <GlobalSearchForm
        action={`/auth/worlds/${worldSlug}/wiki`}
        query={q ?? ""}
        placeholder="Wiki durchsuchen…"
      />

      {NAV_ORDER.map((category) => {
        const items = grouped.get(category);
        if (!items?.length) return null;

        return (
          <section key={category} className="mt-6">
            <header className="mb-3 border-b border-border pb-2">
              <h2 className="text-lg font-semibold">{NAV_CATEGORY_LABELS[category]}</h2>
            </header>
            <ul className="grid gap-2">
              {items.map((page) => (
                <li key={page.id}>
                  <Link
                    href={`/auth/worlds/${worldSlug}/${page.slug}`}
                    className="block rounded-[var(--radius)] border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <strong>{page.title}</strong>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <PageTypeBadge type={page.type} />
                    </div>
                    {page.summary ? (
                      <p className="mt-2 text-sm text-muted-foreground">{page.summary}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {filtered.length === 0 ? (
        <PortalEmptyState
          title={query ? "Keine passenden Wiki-Seiten gefunden" : "Keine Wiki-Seiten freigegeben"}
          description={query ? "Probiere einen anderen Suchbegriff." : undefined}
          icon="book-open"
        />
      ) : null}
    </>
  );
}
