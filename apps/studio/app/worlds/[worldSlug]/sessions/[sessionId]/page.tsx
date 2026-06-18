import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  GAME_SESSION_STATUS_LABELS,
  GameSessionStatusBadge,
  PageHeader,
  PageTypeBadge,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  buildPageUrl as dbBuildPageUrl,
  createAuthService,
  createPrismaClient,
  GameSessionStatusEnum,
  getAppRepository,
} from "@uwe/database/server";
import {
  linkPageToSessionAction,
  publishSessionRecapAction,
  unlinkPageFromSessionAction,
  updateGameSessionAction,
} from "../../../../session-actions";
import { AiContextPanel } from "@/components/AiContextPanel";
import { preparePrintListFromSessionAction } from "@/app/label-actions";
import { pageLabelNewHref } from "@/src/lib/label-links";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
  searchParams: Promise<{ saved?: string; published?: string; linked?: string; unlinked?: string }>;
}

export default async function StudioSessionDetailPage({ params, searchParams }: Props) {
  const { worldSlug, sessionId } = await params;
  const { saved, published, linked, unlinked } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const session = await auth.getGameSessionForDm(worldSlug, sessionId);
  await db.$disconnect();

  if (!session) notFound();

  const allPages = await repo.listPagesByWorld(worldSlug, {
    campaignId: session.campaignId,
  });
  const linkedIds = new Set(session.linkedPages.map((p) => p.id));
  const linkablePages = allPages.filter((p) => !linkedIds.has(p.id));

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={session.title} href="/studio" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Sessions", href: `/worlds/${worldSlug}/sessions` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Sessions", href: `/worlds/${worldSlug}/sessions` },
              { label: session.title },
            ]}
          />

          {saved && <p className="uwe-flash uwe-flash-success">Session gespeichert.</p>}
          {published && <p className="uwe-flash uwe-flash-success">Recap fürs Portal veröffentlicht.</p>}
          {linked && <p className="uwe-flash uwe-flash-success">Seite verknüpft.</p>}
          {unlinked && <p className="uwe-flash uwe-flash-success">Verknüpfung entfernt.</p>}

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
              </>
            }
            actions={
              !session.recapPublished ? (
                <form action={publishSessionRecapAction}>
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <button type="submit" className="uwe-btn uwe-btn-primary">
                    Fürs Portal veröffentlichen
                  </button>
                </form>
              ) : undefined
            }
          />

          <form action={updateGameSessionAction} className="uwe-edit-form">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="sessionId" value={sessionId} />

            <label>
              Titel
              <input name="title" defaultValue={session.title} required />
            </label>

            <label>
              Session-Nummer
              <input name="sessionNumber" type="number" min={1} defaultValue={session.sessionNumber} required />
            </label>

            <label>
              Datum
              <input
                type="date"
                name="date"
                defaultValue={session.date ? session.date.toISOString().slice(0, 10) : ""}
              />
            </label>

            <label>
              Status
              <select name="status" defaultValue={session.status}>
                {Object.values(GameSessionStatusEnum).map((status) => (
                  <option key={status} value={status}>
                    {GAME_SESSION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="uwe-fieldset">
              <legend>DM-Notizen (nur Studio)</legend>
              <label>
                DM-Zusammenfassung
                <textarea name="summaryDm" rows={5} defaultValue={session.summaryDm ?? ""} />
              </label>
              <label>
                Vorbereitungsnotizen
                <textarea name="notes" rows={4} defaultValue={session.notes ?? ""} />
              </label>
            </fieldset>

            <fieldset className="uwe-fieldset">
              <legend>Spieler-Recap</legend>
              <label>
                Recap für Spieler
                <textarea name="summaryPlayer" rows={5} defaultValue={session.summaryPlayer ?? ""} />
              </label>
              <p className="uwe-hint">
                <Link
                  href={`/mail/compose?kind=session_recap&worldSlug=${worldSlug}&sourceId=${sessionId}`}
                >
                  Mail aus Spieler-Recap vorbereiten
                </Link>
                {" "}(nur player-sichtbarer Text — DM-only wird nicht übernommen)
              </p>
            </fieldset>

            <fieldset className="uwe-fieldset">
              <legend>Nachbereitung</legend>
              <label>
                Offene Plots
                <textarea name="openPlots" rows={4} defaultValue={session.openPlots ?? ""} />
              </label>
              <label>
                Spielerentscheidungen
                <textarea name="playerDecisions" rows={4} defaultValue={session.playerDecisions ?? ""} />
              </label>
            </fieldset>

            <div className="uwe-form-actions">
              <button type="submit" className="uwe-btn uwe-btn-primary">Speichern</button>
            </div>
          </form>

          <section style={{ marginTop: "2rem" }}>
            <h2 className="uwe-dashboard-muted" style={{ fontSize: "1rem" }}>Labels für nächste Session</h2>
            {session.linkedPages.length > 0 ? (
              <form action={preparePrintListFromSessionAction} className="uwe-form-inline">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="name" value={`${session.title} — Handouts`} />
                <label className="uwe-checkbox">
                  <input type="checkbox" name="forNextSession" defaultChecked />
                  Für nächste Session markieren
                </label>
                <button type="submit" className="uwe-btn uwe-btn-primary">
                  Druckliste aus Session vorbereiten
                </button>
              </form>
            ) : (
              <p className="uwe-empty">Verknüpfe Seiten, um Labels vorzubereiten.</p>
            )}
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2 className="uwe-dashboard-muted" style={{ fontSize: "1rem" }}>Verknüpfte Seiten</h2>
            {session.linkedPages.length > 0 ? (
              <ul className="uwe-linked-list">
                {session.linkedPages.map((page) => (
                  <li key={page.id}>
                    <Link href={dbBuildPageUrl(worldSlug, page.type, page.slug)}>
                      {page.title}
                    </Link>
                    <PageTypeBadge type={page.type} />
                    <Link
                      className="uwe-btn uwe-btn-ghost uwe-btn-small"
                      href={pageLabelNewHref(worldSlug, page.type, page.id)}
                    >
                      Label
                    </Link>
                    <form action={unlinkPageFromSessionAction} style={{ display: "inline" }}>
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <input type="hidden" name="pageId" value={page.id} />
                      <button type="submit" className="uwe-btn uwe-btn-ghost uwe-btn-small">
                        Entfernen
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="uwe-empty">Noch keine verknüpften Seiten.</p>
            )}

            {linkablePages.length > 0 && (
              <form action={linkPageToSessionAction} className="uwe-inline-form" style={{ marginTop: "1rem" }}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="sessionId" value={sessionId} />
                <select name="pageId" required>
                  <option value="">Seite verknüpfen…</option>
                  {linkablePages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title} ({page.type})
                    </option>
                  ))}
                </select>
                <button type="submit" className="uwe-btn uwe-btn-ghost">Verknüpfen</button>
              </form>
            )}
          </section>
        </>
      }
      context={
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
    />
  );
}
