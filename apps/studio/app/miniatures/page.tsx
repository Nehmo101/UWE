import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createLifeAdminService,
  createMiniatureCollectionService,
  MINIATURE_COLLECTION_STATUS_LABELS,
  MiniatureCollectionStatusEnum,
  prisma,
  type MiniatureCollectionStatus,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  badgeVariants,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from "@/src/components/ui";
import { MiniatureCollectionPanel } from "@/components/miniatures/MiniatureCollectionPanel";

const FILTER_ALL = "all";

interface Props {
  searchParams: Promise<{
    status?: string;
    manufacturer?: string;
    gameSystem?: string;
    selected?: string;
  }>;
}

function resolveStatus(raw: string | undefined): MiniatureCollectionStatus | typeof FILTER_ALL {
  if (!raw || raw === FILTER_ALL) return FILTER_ALL;
  if (Object.values(MiniatureCollectionStatusEnum).includes(raw as MiniatureCollectionStatus)) {
    return raw as MiniatureCollectionStatus;
  }
  return FILTER_ALL;
}

function buildFilterHref(
  current: { status?: string; manufacturer?: string; gameSystem?: string },
  patch: Partial<{ status: string; manufacturer: string; gameSystem: string }>,
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.status && next.status !== FILTER_ALL) params.set("status", next.status);
  if (next.manufacturer && next.manufacturer !== FILTER_ALL) params.set("manufacturer", next.manufacturer);
  if (next.gameSystem && next.gameSystem !== FILTER_ALL) params.set("gameSystem", next.gameSystem);
  const query = params.toString();
  return query ? `/miniatures?${query}` : "/miniatures";
}

export default async function MiniaturesPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = resolveStatus(params.status);
  const manufacturerFilter = params.manufacturer?.trim() || FILTER_ALL;
  const gameSystemFilter = params.gameSystem?.trim() || FILTER_ALL;

  const miniatureService = createMiniatureCollectionService(brainPrisma);
  const workshopService = createLifeAdminService(brainPrisma, prisma);

  const [allItems, filteredItems, workshopProjects] = await Promise.all([
    miniatureService.listItems({ limit: 500 }),
    miniatureService.listItems({
      ...(statusFilter !== FILTER_ALL ? { status: statusFilter } : {}),
      ...(manufacturerFilter !== FILTER_ALL ? { manufacturer: manufacturerFilter } : {}),
      ...(gameSystemFilter !== FILTER_ALL ? { gameSystem: gameSystemFilter } : {}),
      limit: 500,
    }),
    workshopService.listWorkshopProjects({ limit: 200 }),
  ]);

  const manufacturers = [...new Set(allItems.map((item) => item.manufacturer).filter(Boolean))].sort() as string[];
  const gameSystems = [...new Set(allItems.map((item) => item.gameSystem).filter(Boolean))].sort() as string[];

  const filterState = {
    status: statusFilter === FILTER_ALL ? undefined : statusFilter,
    manufacturer: manufacturerFilter === FILTER_ALL ? undefined : manufacturerFilter,
    gameSystem: gameSystemFilter === FILTER_ALL ? undefined : gameSystemFilter,
  };

  const statusCounts = Object.fromEntries(
    Object.values(MiniatureCollectionStatusEnum).map((status) => [
      status,
      allItems.filter((item) => item.status === status).length,
    ]),
  ) as Record<MiniatureCollectionStatus, number>;

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Werkstatt", href: "/workshop" },
            { label: "Miniaturen-Sammlung" },
          ]}
        />
      }
    >
      <PageHeader
        title="Miniaturen-Sammlung"
        summary="Sammlung verwalten, Fortschritt tracken und Referenz- mit Vergleichsfotos gegenüberstellen."
      />

      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Fortschritt">
          {Object.values(MiniatureCollectionStatusEnum).map((status) => {
            const count = statusCounts[status];
            const percent = allItems.length > 0 ? Math.round((count / allItems.length) * 100) : 0;
            return (
              <div key={status} className="rounded-[var(--radius)] border border-border p-4">
                <div className="text-2xl font-semibold">{count}</div>
                <div className="text-sm text-muted-foreground">
                  {MINIATURE_COLLECTION_STATUS_LABELS[status]} ({percent}%)
                </div>
              </div>
            );
          })}
        </section>

        <nav className="flex flex-wrap gap-3 text-sm" aria-label="Werkstatt-Bereiche">
          <Link href="/workshop">Werkstatt</Link>
          <Link href="/workshop/recipes">Paint-Rezepte</Link>
          <Link href="/workshop/print-profiles">Druck-Profile</Link>
        </nav>

        <nav className="flex flex-wrap gap-2" aria-label="Status-Filter">
          <Link
            href={buildFilterHref(filterState, { status: FILTER_ALL })}
            aria-current={statusFilter === FILTER_ALL ? "page" : undefined}
            className={cn(
              badgeVariants({ variant: statusFilter === FILTER_ALL ? "accent" : "default" }),
              "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Alle ({allItems.length})
          </Link>
          {Object.values(MiniatureCollectionStatusEnum).map((status) => {
            const active = statusFilter === status;
            return (
              <Link
                key={status}
                href={buildFilterHref(filterState, { status })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  badgeVariants({ variant: active ? "accent" : "default" }),
                  "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {MINIATURE_COLLECTION_STATUS_LABELS[status]} ({statusCounts[status]})
              </Link>
            );
          })}
        </nav>

        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {manufacturers.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Hersteller</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildFilterHref(filterState, { manufacturer: FILTER_ALL })}
                    aria-current={manufacturerFilter === FILTER_ALL ? "page" : undefined}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Alle
                  </Link>
                  {manufacturers.map((manufacturer) => (
                    <Link
                      key={manufacturer}
                      href={buildFilterHref(filterState, { manufacturer })}
                      aria-current={manufacturerFilter === manufacturer ? "page" : undefined}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      {manufacturer}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {gameSystems.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Spielsystem</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildFilterHref(filterState, { gameSystem: FILTER_ALL })}
                    aria-current={gameSystemFilter === FILTER_ALL ? "page" : undefined}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Alle
                  </Link>
                  {gameSystems.map((gameSystem) => (
                    <Link
                      key={gameSystem}
                      href={buildFilterHref(filterState, { gameSystem })}
                      aria-current={gameSystemFilter === gameSystem ? "page" : undefined}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      {gameSystem}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {(manufacturerFilter !== FILTER_ALL || gameSystemFilter !== FILTER_ALL) && (
              <Link
                href={buildFilterHref(filterState, { manufacturer: FILTER_ALL, gameSystem: FILTER_ALL })}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Hersteller- und Systemfilter zurücksetzen
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neue Miniatur</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniatureCollectionPanel mode="create" workshopProjects={workshopProjects} />
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Sammlung ({filteredItems.length})</h2>
          {filteredItems.length === 0 ? (
            <EmptyState
              title="Noch keine Miniaturen"
              description="Lege die erste Miniatur an oder passe die Filter an."
              action={
                <Link href="/workshop" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Zur Werkstatt
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  id={item.id}
                  data-selected={params.selected === item.id ? "true" : undefined}
                >
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {MINIATURE_COLLECTION_STATUS_LABELS[item.status]}
                      {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                    </span>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {[item.manufacturer, item.gameSystem, item.faction].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <MiniatureCollectionPanel
                      mode="edit"
                      item={item}
                      workshopProjects={workshopProjects}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
