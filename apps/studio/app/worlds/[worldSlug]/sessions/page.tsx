import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  GameSessionStatusBadge,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";

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
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/" },
                { label: "Seiten", href: `/worlds/${worldSlug}` },
                { label: "Sessions", href: `/worlds/${worldSlug}/sessions`, active: true },
                { label: "Spielernotizen", href: `/worlds/${worldSlug}/notes` },
                { label: "Soundboard", href: `/worlds/${worldSlug}/soundboard` },
                { label: "Neue Session", href: `/worlds/${worldSlug}/sessions/new` },
              ]}
            />
          </SidebarSection>
          <SidebarSection title="Kampagnen">
            <SidebarNav
              items={[
                { label: "Alle", href: `/worlds/${worldSlug}/sessions`, active: !campaignSlug },
                ...campaigns.map((c) => ({
                  label: c.name,
                  href: `/worlds/${worldSlug}/sessions?campaign=${c.slug}`,
                  active: campaignSlug === c.slug,
                })),
              ]}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Sessions" },
            ]}
          />
          <PageHeader
            title="Sessions"
            summary="Vorbereiten, spielen und nachbereiten — Recaps fürs Portal veröffentlichen."
            actions={
              <Link className="uwe-btn uwe-btn-primary" href={`/worlds/${worldSlug}/sessions/new`}>
                Neue Session
              </Link>
            }
          />

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
                  <td>{session.sessionNumber}</td>
                  <td>
                    <Link href={`/worlds/${worldSlug}/sessions/${session.id}`}>
                      {session.title}
                    </Link>
                  </td>
                  <td>
                    {session.date
                      ? session.date.toLocaleDateString("de-DE")
                      : "—"}
                  </td>
                  <td><GameSessionStatusBadge status={session.status} /></td>
                  <td>
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
            <p className="uwe-empty">Noch keine Sessions. Erstelle die erste Session für diese Kampagne.</p>
          )}
        </>
      }
      context={
        <SidebarSection title="Kontext">
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
            {sessions.length} Sessions
            {selectedCampaign ? ` in „${selectedCampaign.name}"` : ""}
          </p>
        </SidebarSection>
      }
    />
  );
}
