import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
import {
  classifyDue,
  createMaintenanceService,
  MAINTENANCE_INTERVALS,
  MAINTENANCE_INTERVAL_LABELS,
  type DueClass,
} from "@uwe/database/maintenance";
import { prisma } from "@uwe/database/server";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import {
  createMaintenanceTaskAction,
  deleteMaintenanceTaskAction,
  markMaintenanceDoneAction,
} from "../household-actions";

/**
 * Haushalts-Cockpit — wiederkehrende Aufgaben: Müll, Rauchmelder, Auto,
 * Heizung, Filter.
 *
 * Erinnerungen sind aus `nextDueAt` abgeleitet, es gibt kein eigenes
 * Benachrichtigungssystem. Wer die Aufgabe erledigt, drückt „Erledigt" — der
 * nächste Termin ergibt sich aus dem Intervall.
 */

export const dynamic = "force-dynamic";

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

export default async function FamilyHouseholdPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/household" title="Haushalt">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const service = createMaintenanceService(familyPrisma, prisma);
  const now = new Date();
  const [tasks, upcoming] = await Promise.all([service.list(), service.getUpcoming(14, now)]);
  const overdue = upcoming.filter((task) => task.overdue).length;

  return (
    <FamilyShell
      active="/household"
      title="Haushalt"
      eyebrow="Gemeinsamer Bereich"
      lede="Wiederkehrende Aufgaben mit Fälligkeit. Wer sie erledigt, hakt sie ab — der nächste Termin rechnet sich aus dem Intervall."
    >
      <div className="family-kpis">
        <div className="family-kpi">
          <strong>{tasks.length}</strong>
          <span>Aufgaben</span>
        </div>
        <div className="family-kpi">
          <strong>{upcoming.length}</strong>
          <span>in 14 Tagen</span>
        </div>
        <div className="family-kpi">
          <strong>{overdue}</strong>
          <span>überfällig</span>
        </div>
      </div>

      {upcoming.length > 0 ? (
        <section className="family-section">
          <h2>Demnächst · {upcoming.length}</h2>
          <ul className="family-list">
            {upcoming.map((task) => (
              <li
                key={task.id}
                className={
                  task.overdue
                    ? "family-callout family-callout-warn"
                    : "family-callout"
                }
              >
                <strong>{task.title}</strong>
                {task.category ? ` · ${task.category}` : ""} — fällig {formatDate(task.nextDueAt)}
                {task.overdue ? " (überfällig)" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="family-section">
        <h2>Neue Aufgabe</h2>
        <form action={createMaintenanceTaskAction} className="family-form family-card">
          <div className="family-form-row">
            <label>
              Titel
              <input name="title" required placeholder="z. B. Rauchmelder prüfen" />
            </label>
            <label>
              Kategorie
              <input name="category" placeholder="z. B. Müll, Auto" />
            </label>
          </div>
          <div className="family-form-row">
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
          </div>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <div>
            <button type="submit" className="family-btn">
              Aufgabe anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="family-section">
        <h2>Alle · {tasks.length}</h2>
        {tasks.length === 0 ? (
          <p className="family-muted">
            Noch nichts erfasst — Mülltermine, Wartungen und wiederkehrende Erledigungen gehören
            hierher.
          </p>
        ) : (
          <ul className="family-list">
            {tasks.map((task) => {
              const dueClass = classifyDue(task.nextDueAt, now);
              return (
                <li key={task.id} className="family-row">
                  <div className="family-row-head">
                    <strong>{task.title}</strong>
                    <span className="family-tag">{MAINTENANCE_INTERVAL_LABELS[task.interval]}</span>
                    <span
                      className={
                        dueClass === "overdue" ? "family-tag family-tag-warn" : "family-tag"
                      }
                    >
                      {DUE_LABELS[dueClass]}
                    </span>
                    <span className="family-muted">
                      {task.category ? `${task.category} · ` : ""}
                      fällig {formatDate(task.nextDueAt)} · zuletzt {formatDate(task.lastDoneAt)}
                    </span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                      <form action={markMaintenanceDoneAction}>
                        <input type="hidden" name="id" value={task.id} />
                        <button type="submit" className="family-btn family-btn-sm">
                          Erledigt
                        </button>
                      </form>
                      <form action={deleteMaintenanceTaskAction}>
                        <input type="hidden" name="id" value={task.id} />
                        <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                          Löschen
                        </button>
                      </form>
                    </span>
                  </div>
                  {task.notes ? <p className="family-muted">{task.notes}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="family-muted">
        Einkaufslisten stehen in der <Link href="/kitchen/shopping">Küche</Link> — einmal, nicht
        zweimal.
      </p>
    </FamilyShell>
  );
}
