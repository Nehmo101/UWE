import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  countMaterialsNeeded,
  createLifeAdminService,
  firstPhotoUrl,
  formatEuroFromCents,
  prisma,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  WorkshopProjectTypeEnum,
  WorkshopStatusEnum,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { createWorkshopAction } from "../workshop-actions";

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function formatCost(cents: number | null | undefined): string {
  if (cents == null) return "";
  return formatEuroFromCents(cents);
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
      summary="Hobby-Cockpit für Miniaturen, Terrain, 3D-Druck, Dioramen und Kunst."
    >
      <nav className="uwe-inline-actions uwe-section">
        <Link href="/workshop">Alle</Link>
        <Link href="/workshop?filter=active">Aktiv</Link>
        <Link href="/workshop?filter=material_missing">Material fehlt</Link>
        <Link href="/workshop?filter=done">Fertig</Link>
        <Link href="/workshop?filter=dnd">DnD-verknüpft</Link>
        <Link href="/workshop/recipes">Paint-Rezepte</Link>
        <Link href="/workshop/print-profiles">Druck-Profile</Link>
        <Link href="/workshop/rental">Terrain-Verleih</Link>
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
            description="Erfasse kreative Projekte per Capture oder lege hier direkt eines an."
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {visibleWorkshops.map((workshop) => {
              const thumb = firstPhotoUrl(
                workshop.resultPhotos,
                workshop.progressPhotos,
                workshop.referenceImages,
                workshop.imageGallery,
              );
              const materials = countMaterialsNeeded(workshop.materialsNeeded);

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
                    {workshop.worldId ? " · DnD-verknüpft" : ""}
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
                  <p>
                    <Link href={`/workshop/${workshop.id}`}>Cockpit öffnen →</Link>
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminModuleShell>
  );
}
