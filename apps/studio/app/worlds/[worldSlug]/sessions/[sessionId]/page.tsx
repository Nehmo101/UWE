import { notFound } from "next/navigation";
import {
  GameSessionStatusBadge,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
  navCategoryForPageType,
} from "@uwe/database/server";
import { publishSessionRecapAction } from "../../../../session-actions";
import {
  AVAILABILITY_LABELS,
  createSessionAvailabilityService,
} from "@uwe/player-hub";
import { AiContextPanel } from "@/components/AiContextPanel";
import { SessionDetailClient } from "@/components/sessions/SessionDetailClient";
import { StudioWikiPageView } from "@/components/StudioWikiPageView";
import { isLikelyGameSessionId } from "@/src/lib/session-route";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
  searchParams: Promise<{
    saved?: string;
    published?: string;
    linked?: string;
    unlinked?: string;
    preview?: string;
  }>;
}

export default async function StudioSessionDetailPage({ params, searchParams }: Props) {
  const { worldSlug, sessionId } = await params;
  const { saved, published, linked, unlinked, preview } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const session = isLikelyGameSessionId(sessionId)
    ? await auth.getGameSessionForDm(worldSlug, sessionId)
    : null;
  const availability =
    session && (session.status === "planned" || session.status === "prepared")
      ? (await createSessionAvailabilityService(db).listForSessions([session.id])).get(session.id)
      : undefined;
  await db.$disconnect();

  if (!session) {
    const rawPage = await repo.getPageBySlug(worldSlug, sessionId);
    if (rawPage && navCategoryForPageType(rawPage.type) === "sessions") {
      return (
        <StudioWikiPageView
          worldSlug={worldSlug}
          category="sessions"
          slug={sessionId}
          preview={preview}
        />
      );
    }
    notFound();
  }

  const allPages = await repo.listPagesByWorld(worldSlug, {
    campaignId: session.campaignId,
  });
  const linkedIds = new Set(session.linkedPages.map((p) => p.id));
  const linkablePages = allPages.filter((p) => !linkedIds.has(p.id));

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Sessions",
            `/worlds/${worldSlug}/sessions`,
            session.title,
          )}
        />
      }
      contextPanel={
        <>
          <AiContextPanel
            kind="session"
            worldSlug={worldSlug}
            sessionId={sessionId}
          />
          <SidebarSection title="Workflow">
            <ol className="uwe-hint" style={{ paddingLeft: "1.25rem" }}>
              <li>Geplant → Vorbereiten (DM-Notizen)</li>
              <li>Gespielt → Nachbereiten</li>
              <li>Recap schreiben → Portal veröffentlichen</li>
            </ol>
          </SidebarSection>
        </>
      }
    >
      <PageHeader
        title={`Session ${session.sessionNumber}: ${session.title}`}
        meta={
          <>
            <GameSessionStatusBadge status={session.status} />
            {session.date && (
              <span style={{ marginLeft: "0.5rem" }}>
                {session.date.toLocaleDateString("de-DE")}
              </span>
            )}
            {session.recapPublished && (
              <span className="uwe-badge uwe-badge-published" style={{ marginLeft: "0.5rem" }}>
                Im Portal sichtbar
              </span>
            )}
            {session.playerVisibleSchedule && !session.recapPublished && (
              <span className="uwe-badge" style={{ marginLeft: "0.5rem" }}>
                Termin im Portal angekündigt
              </span>
            )}
          </>
        }
        actions={!session.recapPublished ? (
          <form action={publishSessionRecapAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Fürs Portal veröffentlichen
            </button>
          </form>
        ) : undefined}
      />
      {saved && <p className="uwe-flash uwe-flash-success">Session gespeichert.</p>}
      {published && <p className="uwe-flash uwe-flash-success">Recap fürs Portal veröffentlicht.</p>}
      {linked && <p className="uwe-flash uwe-flash-success">Seite verknüpft.</p>}
      {unlinked && <p className="uwe-flash uwe-flash-success">Verknüpfung entfernt.</p>}

      {(session.status === "planned" || session.status === "prepared") &&
        !session.playerVisibleSchedule &&
        !session.recapPublished && (
          <p className="uwe-notice uwe-notice-warn">
            Diese Session ist für Spieler im Portal noch unsichtbar. Aktiviere unten
            „Termin für Spieler im Portal ankündigen“, damit Datum und Titel im
            Spieler-Dashboard erscheinen — ohne DM-Prep oder Recap preiszugeben.
          </p>
        )}

      {availability && (
        <section className="uwe-v2-card uwe-v2-card-padded" style={{ marginBottom: "1rem" }}>
          <h2 className="uwe-v2-section-title">Spieler-Verfügbarkeit</h2>
          <p>
            Zusagen: <strong>{availability.counts.yes}</strong> · Vielleicht:{" "}
            <strong>{availability.counts.maybe}</strong> · Absagen:{" "}
            <strong>{availability.counts.no}</strong>
          </p>
          {availability.votes.length > 0 ? (
            <ul className="uwe-hint" style={{ paddingLeft: "1.25rem" }}>
              {availability.votes.map((vote) => (
                <li key={vote.userId}>
                  {vote.displayName}: {AVAILABILITY_LABELS[vote.status]}
                  {vote.note ? ` — ${vote.note}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="uwe-dashboard-muted">
              Noch keine Rückmeldungen — Spieler stimmen im Portal unter „Sessions“ ab.
            </p>
          )}
        </section>
      )}

      <SessionDetailClient
        worldSlug={worldSlug}
        sessionId={sessionId}
        session={session}
        linkablePages={linkablePages.map((page) => ({
          id: page.id,
          title: page.title,
          type: page.type,
          slug: page.slug,
        }))}
        flash={{ saved, published, linked, unlinked }}
      />
    </WorldShell>
  );
}
