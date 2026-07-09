import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  createMiniatureCollectionService,
  MINIATURE_COLLECTION_STATUS_LABELS,
  MiniatureCollectionStatusEnum,
  prisma,
  type MiniatureCollectionStatus,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
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

  const miniatureService = createMiniatureCollectionService(prisma);
  const workshopService = createLifeAdminService(prisma);

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

      <section className="uwe-stat-grid uwe-v2-section" aria-label="Fortschritt">
        {Object.values(MiniatureCollectionStatusEnum).map((status) => {
          const count = statusCounts[status];
          const percent = allItems.length > 0 ? Math.round((count / allItems.length) * 100) : 0;
          return (
            <div key={status} className="uwe-stat">
              <span className="uwe-stat-value">{count}</span>
              <span className="uwe-stat-label">
                {MINIATURE_COLLECTION_STATUS_LABELS[status]} ({percent}%)
              </span>
            </div>
          );
        })}
      </section>

      <nav className="uwe-inline-actions uwe-v2-section">
        <Link href="/workshop">Werkstatt</Link>
        <Link href="/workshop/recipes">Paint-Rezepte</Link>
        <Link href="/workshop/print-profiles">Druck-Profile</Link>
      </nav>

      <section className="uwe-today-attention" aria-label="Status-Filter">
        <div className="uwe-today-quick-chips">
          <Link
            href={buildFilterHref(filterState, { status: FILTER_ALL })}
            className="uwe-today-quick-chip"
            data-severity={statusFilter === FILTER_ALL ? "warn" : "info"}
            aria-current={statusFilter === FILTER_ALL ? "page" : undefined}
          >
            Alle ({allItems.length})
          </Link>
          {Object.values(MiniatureCollectionStatusEnum).map((status) => {
            const active = statusFilter === status;
            return (
              <Link
                key={status}
                href={buildFilterHref(filterState, { status })}
                className="uwe-today-quick-chip"
                data-severity={active ? "warn" : "info"}
                aria-current={active ? "page" : undefined}
              >
                {MINIATURE_COLLECTION_STATUS_LABELS[status]} ({statusCounts[status]})
              </Link>
            );
          })}
        </div>
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Filter</h2>
        {manufacturers.length > 0 ? (
          <div className="uwe-v2-section">
            <p className="uwe-dashboard-muted">Hersteller</p>
            <div className="uwe-inline-actions">
              <Link
                href={buildFilterHref(filterState, { manufacturer: FILTER_ALL })}
                className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                aria-current={manufacturerFilter === FILTER_ALL ? "page" : undefined}
              >
                Alle
              </Link>
              {manufacturers.map((manufacturer) => (
                <Link
                  key={manufacturer}
                  href={buildFilterHref(filterState, { manufacturer })}
                  className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                  aria-current={manufacturerFilter === manufacturer ? "page" : undefined}
                >
                  {manufacturer}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {gameSystems.length > 0 ? (
          <div className="uwe-v2-section">
            <p className="uwe-dashboard-muted">Spielsystem</p>
            <div className="uwe-inline-actions">
              <Link
                href={buildFilterHref(filterState, { gameSystem: FILTER_ALL })}
                className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                aria-current={gameSystemFilter === FILTER_ALL ? "page" : undefined}
              >
                Alle
              </Link>
              {gameSystems.map((gameSystem) => (
                <Link
                  key={gameSystem}
                  href={buildFilterHref(filterState, { gameSystem })}
                  className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                  aria-current={gameSystemFilter === gameSystem ? "page" : undefined}
                >
                  {gameSystem}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {(manufacturerFilter !== FILTER_ALL || gameSystemFilter !== FILTER_ALL) && (
          <Link href={buildFilterHref(filterState, { manufacturer: FILTER_ALL, gameSystem: FILTER_ALL })}>
            Hersteller- und Systemfilter zurücksetzen
          </Link>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neue Miniatur</h2>
        <MiniatureCollectionPanel mode="create" workshopProjects={workshopProjects} />
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Sammlung ({filteredItems.length})</h2>
        {filteredItems.length === 0 ? (
          <EmptyState
            title="Noch keine Miniaturen"
            description="Lege die erste Miniatur an oder passe die Filter an."
            action={<Link href="/workshop">Zur Werkstatt</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                id={item.id}
                className="uwe-today-card uwe-v2-card uwe-v2-card-padded"
                data-selected={params.selected === item.id ? "true" : undefined}
              >
                <header className="uwe-inline-actions">
                  <h3>{item.name}</h3>
                  <span className="uwe-dashboard-muted">
                    {MINIATURE_COLLECTION_STATUS_LABELS[item.status]}
                    {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                  </span>
                </header>
                <p className="uwe-dashboard-muted">
                  {[item.manufacturer, item.gameSystem, item.faction].filter(Boolean).join(" · ") || "—"}
                </p>
                <MiniatureCollectionPanel
                  mode="edit"
                  item={item}
                  workshopProjects={workshopProjects}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </StudioShell>
  );
}
