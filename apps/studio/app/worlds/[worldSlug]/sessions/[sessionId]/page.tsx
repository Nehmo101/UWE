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
  updateGameSessionAction,
} from "../../../../session-actions";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
  searchParams: Promise<{ saved?: string; published?: string; linked?: string }>;
}

export default async function StudioSessionDetailPage({ params, searchParams }: Props) {
  const { worldSlug, sessionId } = await params;
  const { saved, published, linked } = await searchParams;
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
      topBar={<TopBarBrand appName="UWE Studio" subtitle={session.title} href="/" />}
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
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Sessions", href: `/worlds/${worldSlug}/sessions` },
              { label: session.title },
            ]}
          />

          {saved && <p className="uwe-flash uwe-flash-success">Session gespeichert.</p>}
          {published && <p className="uwe-flash uwe-flash-success">Recap fürs Portal veröffentlicht.</p>}
          {linked && <p className="uwe-flash uwe-flash-success">Seite verknüpft.</p>}

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
            <input
              type="hidden"
              name="linkedPageIds"
              value={session.linkedPages.map((p) => p.id).join(",")}
            />

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
            <h2 style={{ fontSize: "1rem", color: "#94a3b8" }}>Verknüpfte Seiten</h2>
            {session.linkedPages.length > 0 ? (
              <ul className="uwe-linked-list">
                {session.linkedPages.map((page) => (
                  <li key={page.id}>
                    <Link href={dbBuildPageUrl(worldSlug, page.type, page.slug)}>
                      {page.title}
                    </Link>
                    <PageTypeBadge type={page.type} />
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
        <SidebarSection title="Workflow">
          <ol style={{ fontSize: "0.875rem", color: "#94a3b8", paddingLeft: "1.25rem" }}>
            <li>Geplant → Vorbereiten (DM-Notizen)</li>
            <li>Gespielt → Nachbereiten</li>
            <li>Recap schreiben → Portal veröffentlichen</li>
          </ol>
        </SidebarSection>
      }
    />
  );
}
