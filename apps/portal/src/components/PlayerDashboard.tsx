import Link from "next/link";
import type { PageType, PortalDashboardData } from "@uwe/database/server";
import { PageTypeBadge, PlayerNoteStatusBadge } from "@uwe/shared-ui";

interface PlayerDashboardProps {
  worldSlug: string;
  dashboard: PortalDashboardData;
}

function DashboardSection({
  title,
  href,
  children,
  empty,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
  empty?: string;
}) {
  return (
    <section className="portal-dash-section">
      <header className="portal-dash-section-header">
        <h2>{title}</h2>
        {href && (
          <Link href={href} className="portal-dash-more">
            Alle
          </Link>
        )}
      </header>
      {children}
      {empty && <p className="auth-muted">{empty}</p>}
    </section>
  );
}

function PageLinks({
  worldSlug,
  items,
}: {
  worldSlug: string;
  items: Array<{ id: string; title: string; slug: string; type?: string; summary?: string | null }>;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="portal-dash-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/auth/worlds/${worldSlug}/${item.slug}`}>
            <strong>{item.title}</strong>
            {item.type && (
              <span className="portal-dash-meta">
                <PageTypeBadge type={item.type as PageType} />
              </span>
            )}
            {item.summary && <p className="portal-dash-summary">{item.summary}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PlayerDashboard({ worldSlug, dashboard }: PlayerDashboardProps) {
  return (
    <div className="portal-dashboard">
      {dashboard.characterName && (
        <p className="auth-lead">
          Willkommen, <strong>{dashboard.characterName}</strong>
        </p>
      )}

      <div className="portal-dash-grid">
        <DashboardSection
          title="Nächste Session"
          href={`/auth/worlds/${worldSlug}/sessions`}
          empty={dashboard.nextSession ? undefined : "Keine geplante Session bekannt."}
        >
          {dashboard.nextSession && (
            <div className="portal-dash-highlight">
              <Link href={`/auth/worlds/${worldSlug}/sessions/${dashboard.nextSession.id}`}>
                <strong>
                  Session {dashboard.nextSession.sessionNumber}: {dashboard.nextSession.title}
                </strong>
              </Link>
              {dashboard.nextSession.date && (
                <p className="auth-muted">
                  {dashboard.nextSession.date.toLocaleDateString("de-DE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              )}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Letztes Recap"
          href={`/auth/worlds/${worldSlug}/sessions`}
          empty={dashboard.lastRecap ? undefined : "Noch kein veröffentlichtes Recap."}
        >
          {dashboard.lastRecap && (
            <div className="portal-dash-highlight">
              <Link href={`/auth/worlds/${worldSlug}/sessions/${dashboard.lastRecap.id}`}>
                <strong>
                  Session {dashboard.lastRecap.sessionNumber}: {dashboard.lastRecap.title}
                </strong>
              </Link>
              {dashboard.lastRecap.summaryPlayer && (
                <p className="portal-dash-summary">{dashboard.lastRecap.summaryPlayer}</p>
              )}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Offene Quests"
          empty={dashboard.openQuests.length === 0 ? "Keine sichtbaren Quests." : undefined}
        >
          <PageLinks worldSlug={worldSlug} items={dashboard.openQuests} />
        </DashboardSection>

        <DashboardSection
          title="Bekannte NPCs"
          empty={dashboard.knownNpcs.length === 0 ? "Noch keine NPCs freigeschaltet." : undefined}
        >
          <PageLinks worldSlug={worldSlug} items={dashboard.knownNpcs} />
        </DashboardSection>

        <DashboardSection
          title="Bekannte Orte"
          empty={dashboard.knownPlaces.length === 0 ? "Noch keine Orte freigeschaltet." : undefined}
        >
          <PageLinks worldSlug={worldSlug} items={dashboard.knownPlaces} />
        </DashboardSection>

        <DashboardSection
          title="Neue Handouts"
          href={`/auth/worlds/${worldSlug}/assets`}
          empty={dashboard.newHandouts.length === 0 ? "Keine neuen Handouts." : undefined}
        >
          <PageLinks worldSlug={worldSlug} items={dashboard.newHandouts} />
        </DashboardSection>

        <DashboardSection
          title="Eigene Notizen"
          href={`/auth/worlds/${worldSlug}/notes`}
          empty={dashboard.myNotes.length === 0 ? "Noch keine Notizen — schreib eine auf einer Seite oder Session." : undefined}
        >
          {dashboard.myNotes.length > 0 && (
            <ul className="portal-dash-list">
              {dashboard.myNotes.map((note) => (
                <li key={note.id}>
                  <div className="portal-dash-note">
                    <PlayerNoteStatusBadge status={note.status} />
                    <p className="portal-dash-summary">{note.content}</p>
                    {(note.pageSlug || note.sessionNumber) && (
                      <p className="auth-muted">
                        {note.pageSlug && (
                          <Link href={`/auth/worlds/${worldSlug}/${note.pageSlug}`}>
                            {note.pageTitle}
                          </Link>
                        )}
                        {note.sessionNumber && (
                          <span>Session {note.sessionNumber}</span>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        {dashboard.characterPages.length > 0 && (
          <DashboardSection title="Dein Charakter">
            <PageLinks worldSlug={worldSlug} items={dashboard.characterPages} />
          </DashboardSection>
        )}
      </div>
    </div>
  );
}
