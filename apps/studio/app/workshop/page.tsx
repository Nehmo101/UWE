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
import {
  AdminCreateCard,
  AdminEntityForm,
  AdminFilterChips,
  AdminModulePage,
  BreadcrumbTrail,
} from "@/src/components/admin";
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

  const [workshops, filterCounts, activeWorkshops] = await Promise.all([
    service.listWorkshopProjects({
      status: statusFilter,
      limit: 200,
    }),
    service.getWorkshopFilterCounts(),
    service.listWorkshopProjects({
      status: ["in_progress", "planned", "material_missing", "idea"],
      limit: 3,
    }),
  ]);

  const visibleWorkshops =
    filter === "dnd" ? workshops.filter((item) => Boolean(item.worldId)) : workshops;

  return (
    <AdminModulePage
      breadcrumb={<BreadcrumbTrail items={[{ label: "Werkstatt" }]} />}
      title="Werkstatt"
      summary="Hobby-Cockpit für Miniaturen, Terrain, 3D-Druck, Dioramen und Kunst — mit Status-Workflow."
    >
      <AdminFilterChips
        ariaLabel="Werkstatt-Filter"
        chips={WORKSHOP_FILTERS.map((item) => ({
          href: item.value === "all" ? "/workshop" : `/workshop?filter=${item.value}`,
          label: item.label,
          count: filterCounts[item.value],
          active: filter === item.value,
        }))}
      />

      <nav className="uwe-inline-actions uwe-v2-section">
        <Link href="/workshop/recipes">Paint-Anleitungen</Link>
        <Link href="/workshop/print-profiles">Druck-Profile</Link>
        <Link href="/workshop/rental">Terrain-Verleih</Link>
        <Link href="/miniatures">Miniaturen-Sammlung</Link>
      </nav>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">
          Aktive Projekte ({filterCounts.active})
        </h2>
        {activeWorkshops.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine aktiven Werkstatt-Projekte.</p>
        ) : (
          <ul className="uwe-today-card-list">
            {activeWorkshops.map((workshop) => (
              <li key={workshop.id} className="uwe-today-card">
                <h3>
                  <Link href={`/workshop/${workshop.id}`}>{workshop.title}</Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  {WORKSHOP_STATUS_LABELS[workshop.status]}
                  {workshop.nextAction ? ` · ${workshop.nextAction}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        {filterCounts.active > activeWorkshops.length ? (
          <p className="uwe-dashboard-muted">
            <Link href="/workshop?filter=active">Alle aktiven Projekte anzeigen →</Link>
          </p>
        ) : null}
      </section>

      <AdminCreateCard title="Neues Werkstatt-Projekt">
        <AdminEntityForm
          action={createWorkshopAction}
          submitLabel="Werkstatt-Projekt anlegen"
          fields={[
            { name: "title", label: "Titel", required: true },
            {
              name: "projectType",
              label: "Typ",
              type: "select",
              defaultValue: "dnd_terrain",
              options: Object.values(WorkshopProjectTypeEnum).map((type) => ({
                value: type,
                label: WORKSHOP_TYPE_LABELS[type],
              })),
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              defaultValue: "idea",
              options: Object.values(WorkshopStatusEnum).map((status) => ({
                value: status,
                label: WORKSHOP_STATUS_LABELS[status],
              })),
            },
            {
              name: "nextAction",
              label: "Nächster Schritt",
              placeholder: "z. B. Grundierung auftragen",
            },
            {
              name: "materialsNeeded",
              label: "Materialien (Name | Menge | ja/nein)",
              type: "textarea",
              rows: 3,
              placeholder: "XPS-Schaum | 2 Platten | nein\nCitadel Abaddon Black | 1 Flasche | ja",
            },
            { name: "description", label: "Beschreibung", type: "textarea", rows: 3 },
          ]}
        />
      </AdminCreateCard>

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
    </AdminModulePage>
  );
}
