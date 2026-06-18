import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  DungeonPrepStatusBadge,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createDungeonCockpitService,
  getAppRepository,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

export default async function StudioDungeonsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const dungeons = createDungeonCockpitService();
  const dungeonList = await dungeons.listDungeons(
    worldSlug,
    selectedCampaign?.id ? { campaignId: selectedCampaign.id } : undefined,
  );

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/studio" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/studio" },
                { label: "Seiten", href: `/worlds/${worldSlug}` },
                { label: "Dungeons", href: `/worlds/${worldSlug}/dungeons`, active: true },
                { label: "Sessions", href: `/worlds/${worldSlug}/sessions` },
                { label: "Neuer Dungeon", href: `/worlds/${worldSlug}/dungeons/new` },
              ]}
            />
          </SidebarSection>
          <SidebarSection title="Kampagnen">
            <SidebarNav
              items={[
                { label: "Alle", href: `/worlds/${worldSlug}/dungeons`, active: !campaignSlug },
                ...campaigns.map((c) => ({
                  label: c.name,
                  href: `/worlds/${worldSlug}/dungeons?campaign=${c.slug}`,
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
              { label: "Dashboard", href: "/studio" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Dungeons" },
            ]}
          />
          <PageHeader
            title="Dungeon Cockpit"
            summary="Dungeons, Ebenen und Räume strukturiert vorbereiten — mit Vorlesetext, GM-Notizen und zugeordneten Assets."
            actions={
              <Link className="uwe-btn uwe-btn-primary" href={`/worlds/${worldSlug}/dungeons/new`}>
                Neuer Dungeon
              </Link>
            }
          />

          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Status</th>
                <th>Zusammenfassung</th>
              </tr>
            </thead>
            <tbody>
              {dungeonList.map((dungeon) => (
                <tr key={dungeon.id}>
                  <td>
                    <Link href={`/worlds/${worldSlug}/dungeons/${dungeon.slug}`}>
                      {dungeon.title}
                    </Link>
                  </td>
                  <td><DungeonPrepStatusBadge status={dungeon.prepStatus} /></td>
                  <td>{dungeon.summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {dungeonList.length === 0 && (
            <p className="uwe-empty">Noch keine Dungeons. Erstelle den ersten Dungeon für diese Welt.</p>
          )}
        </>
      }
    />
  );
}
