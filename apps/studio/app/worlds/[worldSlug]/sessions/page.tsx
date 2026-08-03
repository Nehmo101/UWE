import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GameSessionStatusBadge,
  ResponsiveTable,
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
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { QuickCreateSessionDialog } from "@/src/components/world/QuickCreateSessionDialog";
import { Badge, buttonVariants, Card, CardContent, EmptyState } from "@/src/components/ui";

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
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "Sessions", `/worlds/${worldSlug}/sessions`)} />
      <ShellContextPanel>
        <CampaignSidebar
          items={campaignNavItems(`/worlds/${worldSlug}/sessions`, campaigns, campaignSlug)}
          manageHref={`/worlds/${worldSlug}/campaigns`}
        />
        <SidebarSection title="Kontext">
          <p className="text-sm text-muted-foreground">
            {totalCount} Sessions
            {selectedCampaign ? ` in „${selectedCampaign.name}“` : ""}
          </p>
        </SidebarSection>
      </ShellContextPanel>
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
            <Link
              className={buttonVariants({ variant: "ghost" })}
              href={`/worlds/${worldSlug}/sessions/new${campaignSlug ? `?campaign=${campaignSlug}` : ""}`}
            >
              Vollständiges Formular
            </Link>
          </div>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Status-Filter">
        <Link
          href={pageHref(1).replace(/\?page=\d+/, "").replace(/&page=\d+/, "")}
          className={buttonVariants({ variant: !statusFilter ? "default" : "outline", size: "sm" })}
        >
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
              className={buttonVariants({ variant: statusFilter === status ? "default" : "outline", size: "sm" })}
            >
              {GAME_SESSION_STATUS_LABELS[status]}
            </Link>
          );
        })}
      </nav>

      {sessions.length === 0 ? (
        <EmptyState
          title="Noch keine Sessions"
          description="Erstelle die erste Session für diese Kampagne."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveTable
              caption="Sessions"
              rowKey={(session) => session.id}
              rows={sessions}
              columns={[
                {
                  key: "title",
                  label: "Titel",
                  primary: true,
                  render: (session) => (
                    <Link href={`/worlds/${worldSlug}/sessions/${session.id}`}>
                      {session.title}
                    </Link>
                  ),
                },
                {
                  key: "number",
                  label: "#",
                  numeric: true,
                  render: (session) => session.sessionNumber,
                },
                {
                  key: "date",
                  label: "Datum",
                  render: (session) =>
                    session.date ? session.date.toLocaleDateString("de-DE") : "—",
                },
                {
                  key: "status",
                  label: "Status",
                  render: (session) => <GameSessionStatusBadge status={session.status} />,
                },
                {
                  key: "portal",
                  label: "Portal",
                  render: (session) =>
                    session.recapPublished ? (
                      <Badge variant="success">Veröffentlicht</Badge>
                    ) : (
                      <Badge variant="secondary">Entwurf</Badge>
                    ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <nav className="mt-4 flex flex-wrap items-center gap-3" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              ← Zurück
            </Link>
          ) : null}
          <span className="text-sm text-muted-foreground">
            Seite {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Weiter →
            </Link>
          ) : null}
        </nav>
      )}
    </>
  );
}
