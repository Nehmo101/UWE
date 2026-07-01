import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  countMaterialsNeeded,
  createLifeAdminService,
  firstPhotoUrl,
  formatEuroFromCents,
  getNextWorkshopStatus,
  prisma,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  WorkshopProjectTypeEnum,
  WorkshopStatusEnum,
  type WorkshopStatus,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { advanceWorkshopStatusAction } from "../life-admin-actions";
import { createWorkshopAction } from "../workshop-actions";

const WORKSHOP_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "active", label: "Aktiv" },
  { value: "material_missing", label: "Material fehlt" },
  { value: "done", label: "Fertig" },
  { value: "dnd", label: "DnD-verknüpft" },
] as const;

type WorkshopFilter = (typeof WORKSHOP_FILTERS)[number]["value"];

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function resolveFilter(raw: string | undefined): WorkshopFilter {
  if (raw && WORKSHOP_FILTERS.some((item) => item.value === raw)) {
    return raw as WorkshopFilter;
  }
  return "all";
}

function formatCost(cents: number | null | undefined): string {
  if (cents == null) return "";
  return formatEuroFromCents(cents);
}

export default async function WorkshopPage({ searchParams }: Props) {
  const { filter: filterRaw } = await searchParams;
  const filter = resolveFilter(filterRaw);
  const service = createLifeAdminService(prisma);

  const statusFilter =
    filter === "active"
      ? (["in_progress", "planned", "material_missing", "idea"] as WorkshopStatus[])
      : filter === "material_missing"
        ? ("material_missing" as const)
        : filter === "done"
          ? ("done" as const)
          : undefined;

  const [workshops, filterCounts] = await Promise.all([
    service.listWorkshopProjects({
      status: statusFilter,
      limit: 200,
    }),
    service.getWorkshopFilterCounts(),
  ]);

  const visibleWorkshops =
    filter === "dnd" ? workshops.filter((item) => Boolean(item.worldId)) : workshops;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Werkstatt" }]} />}>
      <PageHeader
        title="Werkstatt"
        summary="Hobby-Cockpit für Miniaturen, Terrain, 3D-Druck, Dioramen und Kunst — mit Status-Workflow."
      />
      <section className="uwe-today-attention" aria-label="Werkstatt-Filter">
        <div className="uwe-today-quick-chips">
          {WORKSHOP_FILTERS.map((item) => {
            const count = filterCounts[item.value];
            const active = filter === item.value;
            return (
              <Link
                key={item.value}
                href={item.value === "all" ? "/workshop" : `/workshop?filter=${item.value}`}
                className="uwe-today-quick-chip"
                data-severity={active ? "warn" : "info"}
                aria-current={active ? "page" : undefined}
              >
                {item.label} ({count})
              </Link>
            );
          })}
        </div>
      </section>

      <nav className="uwe-inline-actions uwe-v2-section">
        <Link href="/workshop/recipes">Paint-Rezepte</Link>
        <Link href="/workshop/print-profiles">Druck-Profile</Link>
        <Link href="/workshop/rental">Terrain-Verleih</Link>
        <Link href="/miniatures">Miniaturen-Sammlung</Link>
      </nav>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neues Werkstatt-Projekt</h2>
        <form action={createWorkshopAction} className="uwe-brain-create-form">
          <label>
            Titel
            <input name="title" required />
          </label>
          <label>
            Typ
            <select name="projectType" defaultValue="dnd_terrain">
              {Object.values(WorkshopProjectTypeEnum).map((type) => (
                <option key={type} value={type}>
                  {WORKSHOP_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue="idea">
              {Object.values(WorkshopStatusEnum).map((status) => (
                <option key={status} value={status}>
                  {WORKSHOP_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nächster Schritt
            <input name="nextAction" placeholder="z. B. Grundierung auftragen" />
          </label>
          <label>
            Materialien (Name | Menge | ja/nein)
            <textarea
              name="materialsNeeded"
              rows={3}
              placeholder={"XPS-Schaum | 2 Platten | nein\nCitadel Abaddon Black | 1 Flasche | ja"}
            />
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={3} />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Werkstatt-Projekt anlegen
          </button>
        </form>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Projekte ({visibleWorkshops.length})</h2>
        {visibleWorkshops.length === 0 ? (
          <EmptyState
            title="Noch keine Werkstatt-Projekte"
            description="Erfasse kreative Projekte per Capture oder lege hier direkt eines an."
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {visibleWorkshops.map((workshop) => {
              const nextStatus = getNextWorkshopStatus(workshop.status);
              const thumb = firstPhotoUrl(
                workshop.resultPhotos,
                workshop.progressPhotos,
                workshop.referenceImages,
                workshop.imageGallery,
              );
              const materials = countMaterialsNeeded(workshop.materialsNeeded);
              const world = "world" in workshop ? workshop.world : null;

              return (
                <article key={workshop.id} className="uwe-today-card">
                  <div className="uwe-inline-actions">
                    <h3>
                      <Link href={`/workshop/${workshop.id}`}>{workshop.title}</Link>
                    </h3>
                  </div>
                  {thumb && (
                    <p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt=""
                        style={{ maxWidth: "100%", maxHeight: 140, borderRadius: 8 }}
                      />
                    </p>
                  )}
                  <p className="uwe-dashboard-muted">
                    {WORKSHOP_TYPE_LABELS[workshop.projectType]} ·{" "}
                    {WORKSHOP_STATUS_LABELS[workshop.status]}
                    {world ? (
                      <>
                        {" "}
                        · <Link href={`/worlds/${world.slug}/dashboard`}>{world.name}</Link>
                      </>
                    ) : workshop.worldId ? (
                      " · DnD-verknüpft"
                    ) : null}
                    {workshop.costCents != null ? ` · ${formatCost(workshop.costCents)}` : ""}
                  </p>
                  {workshop.nextAction && (
                    <p>
                      <strong>Nächster Schritt:</strong> {workshop.nextAction}
                    </p>
                  )}
                  {materials.total > 0 && (
                    <p className="uwe-dashboard-muted">
                      Material: {materials.total - materials.missing}/{materials.total} bereit
                      {materials.missing > 0 ? ` · ${materials.missing} fehlen` : ""}
                    </p>
                  )}
                  {workshop.description && <p>{workshop.description}</p>}
                  <div className="uwe-inline-actions">
                    <Link href={`/workshop/${workshop.id}`} className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                      Cockpit öffnen
                    </Link>
                    {nextStatus && (
                      <form action={advanceWorkshopStatusAction}>
                        <input type="hidden" name="id" value={workshop.id} />
                        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
                          → {WORKSHOP_STATUS_LABELS[nextStatus]}
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/mail/compose?kind=terrain_rental&sourceId=${workshop.id}`}
                      className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                    >
                      Terrain-Mail
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </StudioShell>
  );
}
