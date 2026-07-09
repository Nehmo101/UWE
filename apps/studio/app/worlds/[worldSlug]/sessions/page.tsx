import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GameSessionStatusBadge,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createGameSessionService,
  createPrismaClient,
  GameSessionStatusEnum,
  getAppRepository,
  GAME_SESSION_STATUS_LABELS,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { QuickCreateSessionDialog } from "@/src/components/world/QuickCreateSessionDialog";

const PAGE_SIZE = 20;

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; status?: string; page?: string }>;
}

function parseStatus(raw: string | undefined) {
  if (raw && Object.values(GameSessionStatusEnum).includes(raw as (typeof GameSessionStatusEnum)[keyof typeof GameSessionStatusEnum])) {
    return raw as (typeof GameSessionStatusEnum)[keyof typeof GameSessionStatusEnum];
  }
  return undefined;
}

export default async function StudioSessionsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, status: statusRaw, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? "1") || 1);
  const statusFilter = parseStatus(statusRaw);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const gameSessions = createGameSessionService();

  const [sessions, totalCount] = await Promise.all([
    auth.listGameSessionsForDm(worldSlug, selectedCampaign?.id ?? undefined, {
      status: statusFilter,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    gameSessions.listByWorld(worldSlug, {
      campaignId: selectedCampaign?.id,
      status: statusFilter,
    }).then((rows) => rows.length),
  ]);
  await db.$disconnect();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(nextPage: number): string {
    const paramsObj = new URLSearchParams();
    if (campaignSlug) paramsObj.set("campaign", campaignSlug);
    if (statusFilter) paramsObj.set("status", statusFilter);
    if (nextPage > 1) paramsObj.set("page", String(nextPage));
    const qs = paramsObj.toString();
    return `/worlds/${worldSlug}/sessions${qs ? `?${qs}` : ""}`;
  }

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Sessions", `/worlds/${worldSlug}/sessions`)}
        />
      }
      contextPanel={
        <>
          <CampaignSidebar
            items={campaignNavItems(`/worlds/${worldSlug}/sessions`, campaigns, campaignSlug)}
          />
          <SidebarSection title="Kontext">
            <p className="uwe-hint" style={{ margin: 0 }}>
              {totalCount} Sessions
              {selectedCampaign ? ` in „${selectedCampaign.name}“` : ""}
            </p>
          </SidebarSection>
        </>
      }
    >
      <PageHeader
        title="Sessions"
        summary="Vorbereiten, spielen und nachbereiten — Recaps fürs Portal veröffentlichen."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <QuickCreateSessionDialog
              worldSlug={worldSlug}
              campaigns={campaigns.map((c) => ({ slug: c.slug, name: c.name }))}
              defaultCampaignSlug={campaignSlug}
            />
            <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}/sessions/new${campaignSlug ? `?campaign=${campaignSlug}` : ""}`}>
              Vollständiges Formular
            </Link>
          </div>
        }
      />

      <nav className="uwe-today-quick-chips uwe-v2-section" aria-label="Status-Filter">
        <Link href={pageHref(1).replace(/\?page=\d+/, "").replace(/&page=\d+/, "")} className="uwe-today-quick-chip" data-severity={!statusFilter ? "warn" : "info"}>
          Alle
        </Link>
        {Object.values(GameSessionStatusEnum).map((status) => {
          const paramsObj = new URLSearchParams();
          if (campaignSlug) paramsObj.set("campaign", campaignSlug);
          paramsObj.set("status", status);
          return (
            <Link
              key={status}
              href={`/worlds/${worldSlug}/sessions?${paramsObj}`}
              className="uwe-today-quick-chip"
              data-severity={statusFilter === status ? "warn" : "info"}
            >
              {GAME_SESSION_STATUS_LABELS[status]}
            </Link>
          );
        })}
      </nav>

      <table className="uwe-page-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Titel</th>
            <th>Datum</th>
            <th>Status</th>
            <th>Portal</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td data-label="#">{session.sessionNumber}</td>
              <td data-label="Titel">
                <Link href={`/worlds/${worldSlug}/sessions/${session.id}`}>
                  {session.title}
                </Link>
              </td>
              <td data-label="Datum">
                {session.date
                  ? session.date.toLocaleDateString("de-DE")
                  : "—"}
              </td>
              <td data-label="Status"><GameSessionStatusBadge status={session.status} /></td>
              <td data-label="Portal">
                {session.recapPublished ? (
                  <span className="uwe-badge uwe-badge-published">Veröffentlicht</span>
                ) : (
                  <span className="uwe-badge uwe-badge-draft">Entwurf</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sessions.length === 0 && (
        <p className="uwe-v2-empty">Noch keine Sessions. Erstelle die erste Session für diese Kampagne.</p>
      )}

      {totalPages > 1 && (
        <nav className="uwe-inline-actions uwe-v2-section" aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)}>← Zurück</Link> : null}
          <span className="uwe-dashboard-muted">
            Seite {page} / {totalPages}
          </span>
          {page < totalPages ? <Link href={pageHref(page + 1)}>Weiter →</Link> : null}
        </nav>
      )}
    </WorldShell>
  );
}
