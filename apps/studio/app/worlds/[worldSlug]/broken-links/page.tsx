import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorldBySlug, getWikiStore } from "@uwe/database";
import { findBrokenLinksReport } from "@uwe/wiki-engine";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function BrokenLinksPage({ params }: Props) {
  const { worldSlug } = await params;
  const store = getWikiStore();
  const world = getWorldBySlug(store, worldSlug);

  if (!world) notFound();

  const report = findBrokenLinksReport(store, world.id);
  if (!report) notFound();

  return (
    <div className="wiki-layout">
      <nav className="wiki-nav">
        <h2>{world.name}</h2>
        <ul>
          <li>
            <Link href={`/worlds/${worldSlug}`}>← Seitenliste</Link>
          </li>
        </ul>
      </nav>

      <main className="wiki-main">
        <header className="wiki-header">
          <h1>Broken Links</h1>
          <p className="wiki-meta">
            Nicht aufgelöste Wikilinks in {world.name}
          </p>
        </header>

        {report.brokenLinks.length === 0 ? (
          <p className="wiki-empty">Keine broken links — alles verlinkt!</p>
        ) : (
          <table className="wiki-broken-table">
            <thead>
              <tr>
                <th>Ziel</th>
                <th>Quellseite</th>
              </tr>
            </thead>
            <tbody>
              {report.brokenLinks.map((link, i) => (
                <tr key={`${link.sourceHref}-${link.target}-${i}`}>
                  <td>
                    <span className="wiki-link-broken">
                      {link.label ? `${link.target}|${link.label}` : link.target}
                    </span>
                  </td>
                  <td>
                    <Link href={link.sourceHref}>{link.sourcePage.title}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <aside className="wiki-sidebar">
        <section className="wiki-sidebar-section">
          <h3>Hinweis</h3>
          <p className="wiki-meta">
            Links zu GM-only Seiten gelten für die DM-Ansicht als aufgelöst.
          </p>
        </section>
      </aside>
    </div>
  );
}
