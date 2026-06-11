import Link from "next/link";
import { notFound } from "next/navigation";
import {
  WikiContent,
  WikiSidebar,
  VisibilityBadge,
  CATEGORY_LABELS,
} from "@uwe/shared-ui";
import { AiBrainSidebar } from "@/components/AiBrainSidebar";
import {
  getPageByPath,
  getWorldBySlug,
  getWikiStore,
  listPagesInWorld,
  pageHref,
  type PageCategory,
} from "@uwe/database";
import {
  findRelatedPages,
  getBacklinks,
  resolveWikiLinks,
  renderWikiContent,
} from "@uwe/wiki-engine";

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
}

export default async function StudioPageView({ params }: Props) {
  const { worldSlug, category, slug } = await params;
  const store = getWikiStore();
  const world = getWorldBySlug(store, worldSlug);

  if (!world) notFound();

  const page = getPageByPath(store, worldSlug, category as PageCategory, slug);
  if (!page) notFound();

  const href = pageHref(store, page)!;
  const resolved = resolveWikiLinks(store, world.id, page.id, page.content);
  const html = renderWikiContent(page.content, resolved);
  const backlinks = getBacklinks(store, page.id);
  const related = findRelatedPages(store, page.id);

  const navPages = listPagesInWorld(store, world.id);

  return (
    <div className="wiki-layout">
      <nav className="wiki-nav">
        <h2>{world.name}</h2>
        <ul>
          <li>
            <Link href="/worlds">← Welten</Link>
          </li>
          <li>
            <Link href={`/worlds/${worldSlug}`}>Seitenliste</Link>
          </li>
          {navPages.map((p) => {
            const pHref = pageHref(store, p);
            if (!pHref) return null;
            return (
              <li key={p.id}>
                <Link href={pHref}>{p.title}</Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="wiki-main">
        <div className="wiki-breadcrumb">
          <Link href="/worlds">Welten</Link> /{" "}
          <Link href={`/worlds/${worldSlug}`}>{world.name}</Link> /{" "}
          {CATEGORY_LABELS[page.category]} / {page.title}
        </div>

        <header className="wiki-header">
          <h1>{page.title}</h1>
          <div className="wiki-header-meta">
            <VisibilityBadge visibility={page.visibility} />
            <span className="wiki-meta">{href}</span>
            {page.aliases.length > 0 && (
              <span className="wiki-meta">
                Aliase: {page.aliases.join(", ")}
              </span>
            )}
            {page.tags.map((tag) => (
              <span key={tag} className="wiki-tag">
                {tag}
              </span>
            ))}
          </div>
        </header>

        <WikiContent html={html} />
      </main>

      <div className="wiki-sidebar-stack">
        <WikiSidebar
          backlinks={backlinks.map((b) => ({
            title: b.sourcePage.title,
            href: b.href,
          }))}
          relatedPages={related.map((r) => ({
            title: r.page.title,
            href: r.href,
            reasons: r.reasons,
          }))}
        />
        <AiBrainSidebar worldSlug={worldSlug} pageSlug={slug} />
      </div>
    </div>
  );
}
