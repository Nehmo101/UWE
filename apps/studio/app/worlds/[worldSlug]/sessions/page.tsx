import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GameSessionStatusBadge,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { WorldCampaignSidebar, WorldModuleShell } from "@/components/WorldModuleShell";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

export default async function StudioSessionsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const sessions = await auth.listGameSessionsForDm(
    worldSlug,
    selectedCampaign?.id ?? undefined,
  );
  await db.$disconnect();

  return (
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="sessions"
      breadcrumb={worldSectionBreadcrumb(world.name, worldSlug, "Sessions", `/worlds/${worldSlug}/sessions`)}
      contextTitle="Kontext"
      pageHeader={{
        title: "Sessions",
        summary: "Vorbereiten, spielen und nachbereiten — Recaps fürs Portal veröffentlichen.",
        actions: (
          <Link className="uwe-v2-btn uwe-v2-btn-primary" href={`/worlds/${worldSlug}/sessions/new`}>
            Neue Session
          </Link>
        ),
      }}
      sidebarExtra={
        <WorldCampaignSidebar
          items={campaignNavItems(`/worlds/${worldSlug}/sessions`, campaigns, campaignSlug)}
        />
      }
      context={
        <SidebarSection title="Kontext">
          <p className="uwe-hint" style={{ margin: 0 }}>
            {sessions.length} Sessions
            {selectedCampaign ? ` in „${selectedCampaign.name}"` : ""}
          </p>
        </SidebarSection>
      }
    >
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
    </WorldModuleShell>
  );
}
