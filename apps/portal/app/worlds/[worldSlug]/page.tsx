import Link from "next/link";
import { notFound } from "next/navigation";
import { WikiPageList, type WikiNavItem } from "@uwe/shared-ui";
import {
  getWorldBySlug,
  getWikiStore,
  listPlayerVisiblePages,
  pageHref,
} from "@uwe/database";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalWorldOverviewPage({ params }: Props) {
  const { worldSlug } = await params;
  const store = getWikiStore();
  const world = getWorldBySlug(store, worldSlug);

  if (!world) notFound();

  const pages: WikiNavItem[] = listPlayerVisiblePages(store, world.id).flatMap((page) => {
    const href = pageHref(store, page);
    if (!href) return [];
    return [{
      title: page.title,
      href,
      category: page.category,
      visibility: page.visibility,
    }];
  });

  return (
    <div className="wiki-layout">
      <nav className="wiki-nav">
        <h2>{world.name}</h2>
        <ul>
          <li>
            <Link href="/worlds">← Alle Welten</Link>
          </li>
        </ul>
      </nav>

      <main className="wiki-main">
        <div className="wiki-breadcrumb">
          <Link href="/worlds">Welten</Link> / {world.name}
        </div>
        <header className="wiki-header">
          <h1>{world.name}</h1>
          {world.description && <p>{world.description}</p>}
        </header>
        <WikiPageList pages={pages} />
      </main>

      <aside className="wiki-sidebar">
        <section className="wiki-sidebar-section">
          <h3>Spielerportal</h3>
          <p className="wiki-meta">
            Nur veröffentlichte Inhalte — keine GM-Geheimnisse.
          </p>
        </section>
      </aside>
    </div>
  );
}
