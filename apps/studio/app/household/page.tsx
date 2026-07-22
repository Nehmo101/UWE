import Link from "next/link";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  classifyDue,
  createMaintenanceService,
  MAINTENANCE_INTERVALS,
  MAINTENANCE_INTERVAL_LABELS,
  type DueClass,
} from "@uwe/database/maintenance";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";
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

  const service = createMaintenanceService(brainPrisma, prisma);
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

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Einkaufslisten</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Einkaufslisten werden zentral in der Küche verwaltet — nicht hier doppelt.
            </p>
            <Link href="/kitchen/shopping" className={buttonVariants({ variant: "secondary" })}>
              Einkaufslisten in der Küche öffnen
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demnächst / überfällig</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine fälligen Aufgaben in den nächsten 14 Tagen.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {upcoming.map((task) => (
                  <li key={task.id}>
                    <strong>{task.title}</strong>
                    {task.category ? ` · ${task.category}` : ""} · fällig{" "}
                    {formatDate(task.nextDueAt)}{" "}
                    <Badge variant={task.overdue ? "danger" : "warning"}>
                      {task.overdue ? "überfällig" : "bald fällig"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neue Aufgabe</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createMaintenanceTaskAction} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="household-new-title">Titel</Label>
                <Input
                  id="household-new-title"
                  name="title"
                  required
                  placeholder="z. B. Rauchmelder prüfen"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="household-new-category">Kategorie</Label>
                <Input
                  id="household-new-category"
                  name="category"
                  placeholder="z. B. Rauchmelder, Müll, Auto"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="household-new-interval">Intervall</Label>
                <Select name="interval" defaultValue="yearly">
                  <SelectTrigger id="household-new-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_INTERVALS.map((interval) => (
                      <SelectItem key={interval} value={interval}>
                        {MAINTENANCE_INTERVAL_LABELS[interval]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="household-new-next-due">Nächste Fälligkeit</Label>
                <Input id="household-new-next-due" name="nextDueAt" type="date" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="household-new-notes">Notizen</Label>
                <Textarea id="household-new-notes" name="notes" rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Aufgabe anlegen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Alle Aufgaben ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <EmptyState
              title="Noch keine Aufgaben"
              description="Lege Mülltermine, Wartungen und wiederkehrende Erledigungen an."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => {
                const dueClass = classifyDue(task.nextDueAt, now);
                return (
                  <Card key={task.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{task.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <p className="text-sm text-muted-foreground">
                        {task.category ? `${task.category} · ` : ""}
                        {MAINTENANCE_INTERVAL_LABELS[task.interval]} · nächste Fälligkeit:{" "}
                        {formatDate(task.nextDueAt)} · {DUE_LABELS[dueClass]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Zuletzt erledigt: {formatDate(task.lastDoneAt)}
                      </p>
                      {task.notes ? <p className="text-sm">{task.notes}</p> : null}
                      <div className="flex flex-wrap gap-2">
                        <form action={markMaintenanceDoneAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <Button type="submit" size="sm">
                            Erledigt
                          </Button>
                        </form>
                        <form action={deleteMaintenanceTaskAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <Button type="submit" variant="secondary" size="sm">
                            Löschen
                          </Button>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
