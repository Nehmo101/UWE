import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  PageTypeBadge,
  PublishBadge,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VisibilityBadge,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  getAppRepository,
  NAV_CATEGORIES,
  NAV_CATEGORY_LABELS,
  type NavCategory,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; type?: string }>;
}

export default async function StudioWorldPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, type: typeFilter } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) return null;

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const pages = await repo.listPagesByWorld(worldSlug, {
    campaignId: selectedCampaign?.id,
    navCategory: typeFilter as NavCategory | undefined,
  });

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/" },
                { label: "Seiten", href: `/worlds/${worldSlug}`, active: true },
                { label: "Sessions", href: `/worlds/${worldSlug}/sessions` },
                { label: "Neue Seite", href: `/worlds/${worldSlug}/pages/new` },
              ]}
            />
          </SidebarSection>
          <SidebarSection title="Kampagnen">
            <SidebarNav
              items={[
                { label: "Alle", href: `/worlds/${worldSlug}`, active: !campaignSlug },
                ...campaigns.map((c) => ({
                  label: c.name,
                  href: `/worlds/${worldSlug}?campaign=${c.slug}`,
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
              { label: world.name },
            ]}
          />
          <PageHeader
            title={world.name}
            summary={world.description}
            actions={
              <Link className="uwe-btn uwe-btn-primary" href={`/worlds/${worldSlug}/pages/new`}>
                Seite erstellen
              </Link>
            }
          />

          <div className="uwe-filter-bar">
            <Link href={`/worlds/${worldSlug}${campaignSlug ? `?campaign=${campaignSlug}` : ""}`} className={!typeFilter ? "active" : undefined}>
              Alle Typen
            </Link>
            {NAV_CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/worlds/${worldSlug}?${new URLSearchParams({
                  ...(campaignSlug ? { campaign: campaignSlug } : {}),
                  type: cat,
                }).toString()}`}
                className={typeFilter === cat ? "active" : undefined}
              >
                {NAV_CATEGORY_LABELS[cat]}
              </Link>
            ))}
          </div>

          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Sichtbarkeit</th>
                <th>Publish</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id}>
                  <td>
                    <Link href={buildPageUrl(worldSlug, page.type, page.slug)}>
                      {page.title}
                    </Link>
                  </td>
                  <td><PageTypeBadge type={page.type} /></td>
                  <td><VisibilityBadge visibility={page.visibility} /></td>
                  <td><PublishBadge status={page.publishStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {pages.length === 0 && (
            <p className="uwe-empty">Keine Seiten für diesen Filter.</p>
          )}
        </>
      }
      context={
        <SidebarSection title="Kontext">
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
            {pages.length} Seiten
            {selectedCampaign ? ` in „${selectedCampaign.name}"` : ""}
          </p>
        </SidebarSection>
      }
    />
  );
}
