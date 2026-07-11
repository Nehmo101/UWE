import Link from "next/link";
import { notFound } from "next/navigation";
import {
  asLinkList,
  buildPageUrl,
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  formatEuroFromCents,
  formatLinksForForm,
  PersonalProjectCategoryEnum,
  PersonalProjectStatusEnum,
  prisma,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@uwe/database/server";
import { AdminEntityLinksPanel } from "@/components/admin/AdminEntityLinksPanel";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";
import {
  addProjectStepAction,
  deleteProjectAction,
  deleteProjectStepAction,
  toggleProjectStepAction,
  updateProjectAction,
  updateProjectStatusAction,
} from "../../life-admin-actions";
import { ProjectMediaLibrary } from "./ProjectMediaLibrary";
import { QuickCaptureForm } from "@/components/capture/QuickCaptureForm";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await createLifeAdminService(prisma).getPersonalProjectDetail(id);

  if (!detail) {
    notFound();
  }

  const { project, linkedCaptures } = detail;
  const links = asLinkList(project.links);
  const steps = project.steps;
  const doneStepCount = steps.filter((step) => step.done).length;

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Projekte", href: "/projects" },
            { label: project.name },
          ]}
        />
      }
    >
      <PageHeader
        title={project.name}
        summary={`${PROJECT_CATEGORY_LABELS[project.category]} · ${PROJECT_STATUS_LABELS[project.status]}`}
      />
      <p className="text-sm text-muted-foreground">
        <Link href="/projects">← Alle Projekte</Link> ·{" "}
        <Link href={`/projects?category=${project.category}`}>
          {PROJECT_CATEGORY_LABELS[project.category]} filtern
        </Link>{" "}
        · <a href="#projekt-bearbeiten">Projekt bearbeiten ↓</a>
      </p>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Schnell erfassen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Idee oder Notiz direkt ins Capture — mit Rückkehr zu diesem Projekt.
            </p>
            <QuickCaptureForm returnTo={`/projects/${project.id}`} compact />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domänen-Module</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {project.category === "uwe" && (
                <>
                  <li>
                    <Link href="/ideas">Ideen & Feature-Registry →</Link>
                  </li>
                  <li>
                    <Link href="/command">NL-Befehlszentrale →</Link>
                  </li>
                </>
              )}
              {project.category === "hardware_homelab" && (
                <li>
                  <Link href="/hardware">Hardware / Homelab →</Link>
                </li>
              )}
              {project.category === "dnd" && (
                <li>
                  <Link href={project.world ? `/worlds/${project.world.slug}/dashboard` : "/worlds"}>
                    {project.world ? `DnD-Welt: ${project.world.name}` : "Welten-Übersicht"} →
                  </Link>
                </li>
              )}
              {(project.category === "art_workshop" || project.category === "printing_3d") && (
                <li>
                  <Link href="/workshop">Werkstatt →</Link>
                </li>
              )}
              {project.category === "other" && (
                <li>
                  <Link href="/capture">Capture-Inbox →</Link>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status wechseln</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.values(PersonalProjectStatusEnum).map((status) =>
                status === project.status ? (
                  <Badge key={status} variant="accent" aria-current="true">
                    {PROJECT_STATUS_LABELS[status]} (aktuell)
                  </Badge>
                ) : (
                  <form key={status} action={updateProjectStatusAction} className="inline-flex">
                    <input type="hidden" name="id" value={project.id} />
                    <input type="hidden" name="status" value={status} />
                    <Button type="submit" variant="secondary" size="sm">
                      {PROJECT_STATUS_LABELS[status]}
                    </Button>
                  </form>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        {(project.nextAction || project.nextActionDate) && (
          <Card>
            <CardHeader>
              <CardTitle>Nächster Schritt</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {project.nextAction && <p className="text-sm">{project.nextAction}</p>}
              {project.nextActionDate && (
                <p className="text-sm text-muted-foreground">
                  Fällig: {DATE_FORMAT.format(project.nextActionDate)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              Schritte
              {steps.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  ({doneStepCount}/{steps.length} erledigt)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {steps.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {steps.map((step) => (
                  <li
                    key={step.id}
                    className="flex items-center gap-2.5 rounded-[var(--radius)] border border-border bg-card/60 px-3 py-2"
                  >
                    <form action={toggleProjectStepAction} className="inline-flex">
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="stepId" value={step.id} />
                      <input type="hidden" name="done" value={step.done ? "0" : "1"} />
                      {/* TODO(design-kit): Kit hat keinen Checkbox-Toggle-Button — nächstliegend: Button, auf Checkbox-Maß verkleinert. */}
                      <Button
                        type="submit"
                        variant={step.done ? "default" : "outline"}
                        size="icon"
                        className="h-6 w-6 shrink-0 rounded-[0.4rem] p-0 text-xs"
                        aria-label={step.done ? "Als offen markieren" : "Als erledigt markieren"}
                        aria-pressed={step.done}
                      >
                        {step.done ? "✓" : ""}
                      </Button>
                    </form>
                    <span
                      className={cn(
                        "min-w-0 flex-1 break-words text-sm",
                        step.done && "text-muted-foreground line-through",
                      )}
                    >
                      {step.title}
                    </span>
                    <form action={deleteProjectStepAction}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="stepId" value={step.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label="Schritt löschen">
                        Löschen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Schritte. Lege unten den ersten an.
              </p>
            )}
            <form action={addProjectStepAction} className="flex gap-2">
              <input type="hidden" name="projectId" value={project.id} />
              <Input
                name="title"
                placeholder="Neuen Schritt hinzufügen…"
                required
                aria-label="Neuer Schritt"
                className="flex-1"
              />
              <Button type="submit" variant="secondary" size="sm">
                Hinzufügen
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mediathek</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectMediaLibrary
              projectId={project.id}
              initialImages={project.images.map((image) => ({
                id: image.id,
                caption: image.caption,
                originalFilename: image.originalFilename,
              }))}
            />
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Übersicht</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status & Kategorie</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <p>{PROJECT_STATUS_LABELS[project.status]}</p>
                <p className="text-muted-foreground">{PROJECT_CATEGORY_LABELS[project.category]}</p>
                <p className="text-muted-foreground">
                  Angelegt {DATE_FORMAT.format(project.createdAt)} · Aktualisiert{" "}
                  {DATE_FORMAT.format(project.updatedAt)}
                </p>
              </CardContent>
            </Card>
            {(project.world || project.page) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Welt & Seite</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  {project.world && (
                    <p>
                      <Link href={`/worlds/${project.world.slug}/dashboard`}>{project.world.name}</Link>
                    </p>
                  )}
                  {project.page && (
                    <p>
                      <Link
                        href={buildPageUrl(
                          project.page.world.slug,
                          project.page.type,
                          project.page.slug,
                        )}
                      >
                        {project.page.title}
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kosten</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>{project.costCents != null ? formatEuroFromCents(project.costCents) : "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Links</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {links.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {links.map((entry) => (
                      <li key={entry.url}>
                        <a href={entry.url} target="_blank" rel="noreferrer">
                          {entry.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Keine Links</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {project.description && (
          <Card>
            <CardHeader>
              <CardTitle>Beschreibung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{project.description}</p>
            </CardContent>
          </Card>
        )}

        {project.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notizen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{project.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card id="projekt-bearbeiten">
          <CardHeader>
            <CardTitle>Projekt bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateProjectAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={project.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-edit-name">Name</Label>
                <Input id="project-edit-name" name="name" defaultValue={project.name} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-edit-category">Kategorie</Label>
                <Select name="category" defaultValue={project.category}>
                  <SelectTrigger id="project-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PersonalProjectCategoryEnum).map((category) => (
                      <SelectItem key={category} value={category}>
                        {PROJECT_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-edit-status">Status</Label>
                <Select name="status" defaultValue={project.status}>
                  <SelectTrigger id="project-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PersonalProjectStatusEnum).map((status) => (
                      <SelectItem key={status} value={status}>
                        {PROJECT_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-edit-next-action">Nächste Aktion</Label>
                <Input
                  id="project-edit-next-action"
                  name="nextAction"
                  defaultValue={project.nextAction ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-edit-next-action-date">Fälligkeitsdatum</Label>
                <Input
                  id="project-edit-next-action-date"
                  name="nextActionDate"
                  type="date"
                  defaultValue={
                    project.nextActionDate ? project.nextActionDate.toISOString().slice(0, 10) : ""
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-edit-cost">Kosten (Cent)</Label>
                <Input
                  id="project-edit-cost"
                  name="costCents"
                  type="number"
                  min={0}
                  defaultValue={project.costCents ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="project-edit-description">Beschreibung</Label>
                <Textarea
                  id="project-edit-description"
                  name="description"
                  rows={3}
                  defaultValue={project.description}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="project-edit-notes">Notizen</Label>
                <Textarea id="project-edit-notes" name="notes" rows={2} defaultValue={project.notes} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="project-edit-links" className="flex flex-wrap items-baseline gap-1.5">
                  Links
                  <span className="text-xs font-normal text-muted-foreground">
                    eine Zeile pro Link: Label | https://…
                  </span>
                </Label>
                <Textarea
                  id="project-edit-links"
                  name="links"
                  rows={3}
                  className="font-mono text-sm"
                  placeholder="Anleitung | https://example.com/kintsugi"
                  defaultValue={formatLinksForForm(project.links)}
                />
              </div>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                {formatEuroFromCents(project.costCents ?? 0)} · Aktualisiert{" "}
                {DATE_FORMAT.format(project.updatedAt)}
              </p>
              <div className="sm:col-span-2">
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {linkedCaptures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Quellen / Captures</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {linkedCaptures.map((capture) => (
                <Card key={capture.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link href={`/capture/${capture.id}`}>{capture.title || "Capture"}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 text-sm">
                    <p className="text-muted-foreground">
                      {CAPTURE_TYPE_LABELS[capture.captureType]} ·{" "}
                      {DATE_FORMAT.format(capture.capturedAt)}
                    </p>
                    {capture.content && <p>{capture.content}</p>}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        <AdminEntityLinksPanel sourceType="personal_project" sourceId={project.id} />

        <form action={deleteProjectAction}>
          <input type="hidden" name="id" value={project.id} />
          <Button type="submit" variant="secondary" size="sm">
            Projekt löschen
          </Button>
        </form>
      </div>
    </StudioShell>
  );
}
