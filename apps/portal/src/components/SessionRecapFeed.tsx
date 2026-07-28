import Link from "next/link";
import type { PortalGameSessionView } from "@uwe/database/server";

interface SessionRecapFeedProps {
  worldSlug: string;
  session: PortalGameSessionView;
}

export function SessionRecapFeed({ worldSlug, session }: SessionRecapFeedProps) {
  return (
    <div className="portal-recap-feed">
      <section className="auth-block">
        <h2>Was zuletzt geschah</h2>
        {session.summaryPlayer ? (
          <div className="portal-recap-text">{session.summaryPlayer}</div>
        ) : (
          <p className="auth-muted">Kein Recap-Text vorhanden.</p>
        )}
      </section>

      {session.playerDecisions && (
        <section className="auth-block">
          <h2>Was die Charaktere wissen</h2>
          <div className="portal-recap-text">{session.playerDecisions}</div>
        </section>
      )}

      {session.openPlots && (
        <section className="auth-block">
          <h2>Offene Fragen</h2>
          <div className="portal-recap-text">{session.openPlots}</div>
        </section>
      )}


      {session.linkedPages.length > 0 && (
        <section className="auth-block">
          <h2>Verknüpfte Inhalte</h2>
          <ul className="auth-page-list">
            {session.linkedPages.map((page) => (
              <li key={page.id}>
                <Link href={`/auth/worlds/${worldSlug}/${page.slug}`}>{page.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
