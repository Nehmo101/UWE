"use client";

import Link from "next/link";
import {
  DashboardWidgetGrid,
  PageTypeBadge,
  PlayerNoteStatusBadge,
} from "@uwe/shared-ui";
import type { PageType } from "@uwe/database/enums";
import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { PortalDashboardData } from "@uwe/database/server";

interface PortalWorldDashboardClientProps {
  worldSlug: string;
  dashboard: PortalDashboardData;
  widgets: DashboardWidgetConfig[];
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

export function PortalWorldDashboardClient({
  worldSlug,
  dashboard,
  widgets,
}: PortalWorldDashboardClientProps) {

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.widgetType) {
      case "next-session":
        return (
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
        );
      case "last-recap":
        return (
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
        );
      case "open-quests":
        return (
          <DashboardSection
            title="Offene Quests"
            empty={dashboard.openQuests.length === 0 ? "Keine sichtbaren Quests." : undefined}
          >
            <PageLinks worldSlug={worldSlug} items={dashboard.openQuests} />
          </DashboardSection>
        );
      case "known-npcs":
        return (
          <DashboardSection
            title="Bekannte NPCs"
            href={`/auth/worlds/${worldSlug}/npcs`}
            empty={dashboard.knownNpcs.length === 0 ? "Noch keine NPCs freigeschaltet." : undefined}
          >
            <PageLinks worldSlug={worldSlug} items={dashboard.knownNpcs} />
          </DashboardSection>
        );
      case "known-places":
        return (
          <DashboardSection
            title="Bekannte Orte"
            empty={dashboard.knownPlaces.length === 0 ? "Noch keine Orte freigeschaltet." : undefined}
          >
            <PageLinks worldSlug={worldSlug} items={dashboard.knownPlaces} />
          </DashboardSection>
        );
      case "new-handouts":
        return (
          <DashboardSection
            title="Neue Handouts"
            href={`/auth/worlds/${worldSlug}/assets`}
            empty={dashboard.newHandouts.length === 0 ? "Keine neuen Handouts." : undefined}
          >
            <PageLinks worldSlug={worldSlug} items={dashboard.newHandouts} />
          </DashboardSection>
        );
      case "my-notes":
        return (
          <DashboardSection
            title="Eigene Notizen"
            href={`/auth/worlds/${worldSlug}/notes`}
            empty={
              dashboard.myNotes.length === 0
                ? "Noch keine Notizen — schreib eine auf einer Seite oder Session."
                : undefined
            }
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
                          {note.sessionNumber && <span>Session {note.sessionNumber}</span>}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        );
      case "character-pages":
        return dashboard.characterPages.length > 0 ? (
          <DashboardSection title="Dein Charakter">
            <PageLinks worldSlug={worldSlug} items={dashboard.characterPages} />
          </DashboardSection>
        ) : (
          <DashboardSection title="Dein Charakter" empty="Noch keine Charakterseiten freigegeben.">
            {null}
          </DashboardSection>
        );
      default:
        return null;
    }
  };

  return (
    <div className="portal-dashboard">
      {dashboard.characterName && (
        <p className="auth-lead">
          Willkommen, <strong>{dashboard.characterName}</strong>
        </p>
      )}

      <DashboardWidgetGrid widgets={widgets} renderWidget={renderWidget} />
    </div>
  );
}
