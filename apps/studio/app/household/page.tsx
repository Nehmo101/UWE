import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  classifyDue,
  createMaintenanceService,
  MAINTENANCE_INTERVALS,
  MAINTENANCE_INTERVAL_LABELS,
  type DueClass,
} from "@uwe/database/maintenance";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  createMaintenanceTaskAction,
  deleteMaintenanceTaskAction,
  markMaintenanceDoneAction,
} from "../household-actions";

const DUE_LABELS: Record<DueClass, string> = {
  overdue: "Überfällig",
  soon: "Bald fällig",
  later: "Später",
  none: "Ohne Termin",
};

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function HouseholdPage() {
  await requireStudioAccess();

  const service = createMaintenanceService(prisma);
  const now = new Date();
  const [tasks, upcoming] = await Promise.all([
    service.list(),
    service.getUpcoming(14, now),
  ]);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Haushalts-Cockpit" }]} />}>
      <PageHeader
        title="Haushalts-Cockpit"
        summary="Wiederkehrende Haushalts- und Wartungsaufgaben — Mülltermine, Rauchmelder, Auto, Heizung, Filter. Erinnerungen sind aus dem nächsten Fälligkeitsdatum abgeleitet."
      />

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Einkaufslisten</h2>
        <p className="uwe-dashboard-muted">
          Einkaufslisten werden zentral in der Küche verwaltet — nicht hier doppelt.
        </p>
        <Link href="/kitchen/shopping" className="uwe-v2-btn uwe-v2-btn-secondary">
          Einkaufslisten in der Küche öffnen
        </Link>
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Demnächst / überfällig</h2>
        {upcoming.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Keine fälligen Aufgaben in den nächsten 14 Tagen.
          </p>
        ) : (
          <ul className="uwe-inspector-findings">
            {upcoming.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong>
                {task.category ? ` · ${task.category}` : ""} · fällig{" "}
                {formatDate(task.nextDueAt)}{" "}
                <span
                  className={
                    task.overdue
                      ? "uwe-v2-badge uwe-v2-badge-danger"
                      : "uwe-v2-badge uwe-v2-badge-warning"
                  }
                >
                  {task.overdue ? "überfällig" : "bald fällig"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neue Aufgabe</h2>
        <form action={createMaintenanceTaskAction} className="uwe-brain-create-form">
          <label>
            Titel
            <input name="title" required placeholder="z. B. Rauchmelder prüfen" />
          </label>
          <label>
            Kategorie
            <input name="category" placeholder="z. B. Rauchmelder, Müll, Auto" />
          </label>
          <label>
            Intervall
            <select name="interval" defaultValue="yearly">
              {MAINTENANCE_INTERVALS.map((interval) => (
                <option key={interval} value={interval}>
                  {MAINTENANCE_INTERVAL_LABELS[interval]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nächste Fälligkeit
            <input name="nextDueAt" type="date" />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Aufgabe anlegen
          </button>
        </form>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Alle Aufgaben ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <EmptyState
            title="Noch keine Aufgaben"
            description="Lege Mülltermine, Wartungen und wiederkehrende Erledigungen an."
          />
        ) : (
          <div className="uwe-today-card-list">
            {tasks.map((task) => {
              const dueClass = classifyDue(task.nextDueAt, now);
              return (
                <article key={task.id} className="uwe-today-card">
                  <h3 className="uwe-v2-section-title">{task.title}</h3>
                  <p className="uwe-dashboard-muted">
                    {task.category ? `${task.category} · ` : ""}
                    {MAINTENANCE_INTERVAL_LABELS[task.interval]} · nächste Fälligkeit:{" "}
                    {formatDate(task.nextDueAt)} · {DUE_LABELS[dueClass]}
                  </p>
                  <p className="uwe-dashboard-muted">
                    Zuletzt erledigt: {formatDate(task.lastDoneAt)}
                  </p>
                  {task.notes ? <p>{task.notes}</p> : null}
                  <div className="uwe-brain-create-form">
                    <form action={markMaintenanceDoneAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        type="submit"
                        className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm"
                      >
                        Erledigt
                      </button>
                    </form>
                    <form action={deleteMaintenanceTaskAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        type="submit"
                        className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                      >
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
    </StudioShell>
  );
}
