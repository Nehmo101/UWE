import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  getNextWorkshopStatus,
  prisma,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  WorkshopProjectTypeEnum,
  WorkshopStatusEnum,
  type WorkshopStatus,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  advanceWorkshopStatusAction,
  createWorkshopAction,
  deleteWorkshopAction,
  updateWorkshopAction,
} from "../life-admin-actions";

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

function formatMaterials(materials: unknown): string[] {
  if (!Array.isArray(materials)) return [];
  return materials
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) {
        const name = String((item as { name?: string }).name ?? "");
        const quantity = (item as { quantity?: string }).quantity;
        return quantity ? `${name} (${quantity})` : name;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
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
    <AdminModuleShell
      activePath="/workshop"
      title="Werkstatt"
      summary="Kunstwerke, Miniaturen, Terrain, 3D-Druck und Dioramen — mit Status-Workflow."
    >
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

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Neues Werkstatt-Projekt</h2>
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
            Materialien (eine Zeile pro Eintrag)
            <textarea name="materialsNeeded" rows={3} />
          </label>
          <label>
            Nächste Aktion
            <input name="nextAction" />
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={3} />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-primary">
            Werkstatt-Projekt anlegen
          </button>
        </form>
      </section>

      <section className="uwe-section">
        <h2 className="uwe-section-title">Projekte ({visibleWorkshops.length})</h2>
        {visibleWorkshops.length === 0 ? (
          <EmptyState
            title="Noch keine Werkstatt-Projekte"
            description="Erfasse kreative Projekte oder lege hier direkt eines an."
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {visibleWorkshops.map((workshop) => {
              const nextStatus = getNextWorkshopStatus(workshop.status);
              const materials = formatMaterials(workshop.materialsNeeded);
              const world = "world" in workshop ? workshop.world : null;

              return (
                <article key={workshop.id} className="uwe-today-card">
                  <form action={updateWorkshopAction} className="uwe-brain-create-form">
                    <input type="hidden" name="id" value={workshop.id} />
                    <label>
                      Titel
                      <input name="title" defaultValue={workshop.title} required />
                    </label>
                    <label>
                      Typ
                      <select name="projectType" defaultValue={workshop.projectType}>
                        {Object.values(WorkshopProjectTypeEnum).map((type) => (
                          <option key={type} value={type}>
                            {WORKSHOP_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select name="status" defaultValue={workshop.status}>
                        {Object.values(WorkshopStatusEnum).map((status) => (
                          <option key={status} value={status}>
                            {WORKSHOP_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nächste Aktion
                      <input name="nextAction" defaultValue={workshop.nextAction ?? ""} />
                    </label>
                    <label>
                      Beschreibung
                      <textarea name="description" rows={2} defaultValue={workshop.description} />
                    </label>
                    <p className="uwe-dashboard-muted">
                      {WORKSHOP_TYPE_LABELS[workshop.projectType]} ·{" "}
                      {WORKSHOP_STATUS_LABELS[workshop.status]}
                      {world ? (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={`/worlds/${world.slug}/dashboard`}>{world.name}</Link>
                        </>
                      ) : null}
                    </p>
                    {materials.length > 0 && (
                      <ul className="uwe-dashboard-muted">
                        {materials.map((material) => (
                          <li key={material}>{material}</li>
                        ))}
                      </ul>
                    )}
                    <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                      Speichern
                    </button>
                  </form>
                  <div className="uwe-inline-actions">
                    {nextStatus && (
                      <form action={advanceWorkshopStatusAction}>
                        <input type="hidden" name="id" value={workshop.id} />
                        <button type="submit" className="uwe-btn uwe-btn-primary uwe-btn-sm">
                          → {WORKSHOP_STATUS_LABELS[nextStatus]}
                        </button>
                      </form>
                    )}
                    <form action={deleteWorkshopAction}>
                      <input type="hidden" name="id" value={workshop.id} />
                      <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminModuleShell>
  );
}
