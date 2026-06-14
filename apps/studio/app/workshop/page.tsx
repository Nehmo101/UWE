import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  prisma,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  WorkshopProjectTypeEnum,
  WorkshopStatusEnum,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createWorkshopAction,
  deleteWorkshopAction,
  updateWorkshopAction,
} from "../life-admin-actions";

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

export default async function WorkshopPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const service = createLifeAdminService(prisma);

  const statusFilter =
    filter === "active"
      ? (["in_progress", "planned", "material_missing"] as Array<
          import("@uwe/database/server").WorkshopStatus
        >)
      : filter === "material_missing"
        ? ("material_missing" as const)
        : filter === "done"
          ? ("done" as const)
          : filter === "dnd"
            ? undefined
            : undefined;

  const workshops = await service.listWorkshopProjects({
    status: statusFilter,
    limit: 200,
  });

  const visibleWorkshops =
    filter === "dnd" ? workshops.filter((item) => Boolean(item.worldId)) : workshops;

  return (
    <AdminModuleShell
      activePath="/workshop"
      title="Werkstatt"
      summary="Kunstwerke, Miniaturen, Terrain, 3D-Druck und Dioramen."
    >
      <nav className="uwe-inline-actions uwe-section">
        <Link href="/workshop">Alle</Link>
        <Link href="/workshop?filter=active">Aktiv</Link>
        <Link href="/workshop?filter=material_missing">Material fehlt</Link>
        <Link href="/workshop?filter=done">Fertig</Link>
        <Link href="/workshop?filter=dnd">DnD-verknüpft</Link>
      </nav>

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
            {visibleWorkshops.map((workshop) => (
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
                    {workshop.worldId ? " · DnD-verknüpft" : ""}
                  </p>
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Speichern
                  </button>
                </form>
                <form action={deleteWorkshopAction}>
                  <input type="hidden" name="id" value={workshop.id} />
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminModuleShell>
  );
}
