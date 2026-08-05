import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalSearchForm, PageTypeBadge } from "@uwe/shared-ui";
import {
  NAV_CATEGORIES,
  NAV_CATEGORY_LABELS,
  navCategoryForPageType,
  type NavCategory,
} from "@uwe/database/server";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { PageHeader } from "@/src/components/shell";
import { cn } from "@/src/components/ui/cn";
import { badgeVariants } from "@/src/components/ui/badge";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string; typ?: string }>;
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

function parseTypeFilter(raw: string | undefined): NavCategory | null {
  return raw && (NAV_CATEGORIES as readonly string[]).includes(raw) ? (raw as NavCategory) : null;
}

export default async function AuthWorldWikiPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q, typ } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const typeFilter = parseTypeFilter(typ);

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let pages;
  try {
    pages = await auth.listPagesForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  const query = q?.trim().toLocaleLowerCase("de") ?? "";
  const filtered = pages
    .filter((page) => !typeFilter || navCategoryForPageType(page.type) === typeFilter)
    .filter((page) => {
      if (!query) return true;
      const haystack = [page.title, page.slug, page.summary ?? ""]
        .join(" ")
        .toLocaleLowerCase("de");
      return haystack.includes(query);
    });

  const grouped = new Map<NavCategory, typeof filtered>();
  for (const page of filtered) {
    const category = navCategoryForPageType(page.type);
    const bucket = grouped.get(category) ?? [];
    bucket.push(page);
    grouped.set(category, bucket);
  }

  const wikiBase = `/auth/worlds/${worldSlug}/wiki`;

  // Nur Gruppen anbieten, in denen es freigegebene Seiten gibt — ein Filter,
  // hinter dem garantiert nichts steht, ist eine Sackgasse mit Klick.
  const availableCategories = new Set(pages.map((page) => navCategoryForPageType(page.type)));

  return (
    <>
      <PageHeader
        title="Wiki"
        summary="Alle Wiki-Seiten dieser Welt."
      />

      <GlobalSearchForm
        action={wikiBase}
        query={q ?? ""}
        placeholder="Wiki durchsuchen…"
      />

      {/*
        Dieselbe Vorgruppierung wie im Studio unter Wiki/Seiten: eine Reihe
        Typ-Filter über der Liste. Die Suche reist im Link mit, damit ein
        Filterwechsel sie nicht verwirft.
      */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`${wikiBase}${query ? `?q=${encodeURIComponent(q!.trim())}` : ""}`}
          className={cn(badgeVariants({ variant: !typeFilter ? "accent" : "default" }))}
        >
          Alle Typen
        </Link>
        {NAV_ORDER.filter((category) => availableCategories.has(category)).map((category) => (
          <Link
            key={category}
            href={`${wikiBase}?${new URLSearchParams({
              typ: category,
              ...(query ? { q: q!.trim() } : {}),
            }).toString()}`}
            className={cn(badgeVariants({ variant: typeFilter === category ? "accent" : "default" }))}
          >
            {NAV_CATEGORY_LABELS[category]}
          </Link>
        ))}
      </div>

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
          title={
            query || typeFilter
              ? "Keine passenden Wiki-Seiten gefunden"
              : "Keine Wiki-Seiten freigegeben"
          }
          description={query || typeFilter ? "Probiere einen anderen Filter oder Suchbegriff." : undefined}
          icon="book-open"
        />
      ) : null}
    </>
  );
}
