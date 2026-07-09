import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalSearchForm, PageTypeBadge, VisibilityBadge } from "@uwe/shared-ui";
import { NAV_CATEGORY_LABELS, navCategoryForPageType, type NavCategory } from "@uwe/database/server";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";

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
    <section className="portal-content-card">
      <h1>Wiki</h1>
      <p className="auth-lead">
        Alle Wiki-Seiten, die für deine Rolle ({ctx.effectiveRole}) sichtbar sind.
      </p>

      <GlobalSearchForm
        action={`/auth/worlds/${worldSlug}/wiki`}
        query={q ?? ""}
        placeholder="Wiki durchsuchen…"
      />

      {NAV_ORDER.map((category) => {
        const items = grouped.get(category);
        if (!items?.length) return null;

        return (
          <section key={category} className="portal-dash-section">
            <header className="portal-dash-section-header">
              <h2>{NAV_CATEGORY_LABELS[category]}</h2>
            </header>
            <ul className="auth-page-list">
              {items.map((page) => (
                <li key={page.id}>
                  <Link href={`/auth/worlds/${worldSlug}/${page.slug}`}>
                    <strong>{page.title}</strong>
                    <span className="auth-page-list-badges">
                      <PageTypeBadge type={page.type} />
                      <VisibilityBadge visibility={page.visibility} />
                    </span>
                    {page.summary && <p className="portal-dash-summary">{page.summary}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <PortalEmptyState
          title={query ? "Keine passenden Wiki-Seiten gefunden" : "Keine Wiki-Seiten freigegeben"}
          description={
            query
              ? "Probiere einen anderen Suchbegriff."
              : undefined
          }
          icon="book-open"
        />
      )}
    </section>
  );
}
