import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ResponsiveTable,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createLabelService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  LABEL_SOURCE_TYPE_LABELS,
  summarizePrintList,
} from "@uwe/database/server";
import {
  deleteTemplateAction,
  duplicateLabelAction,
  duplicateTemplateAction,
  renameTemplateAction,
} from "@/app/label-actions";
import { createPrintListAction } from "@/app/print-list-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  badgeVariants,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  Input,
} from "@/src/components/ui";

const TAB_LINK_CLASS =
  "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    deleted?: string;
    duplicated?: string;
    tab?: string;
    templateSaved?: string;
    renamed?: string;
  }>;
}

export default async function StudioLabelsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { deleted, duplicated, tab, templateSaved, renamed } = await searchParams;
  const activeTab = tab === "templates" ? "templates" : tab === "print-lists" ? "print-lists" : "labels";

  const repo = getAppRepository();
  const labelService = createLabelService();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const labelRows = await labelService.listLabelsByWorld(worldSlug);
  const templates = await labelService.listTemplates(world.id);
  const worldTemplates = templates.filter((t) => t.worldId === world.id);
  const printLists = await printListService.listByWorld(worldSlug);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Labels", `/worlds/${worldSlug}/labels`)}
        />
      }
      contextPanel={
        <SidebarSection title="Kontext">
          <p className="m-0 text-sm text-muted-foreground">
            {labelRows.length} Labels · {printLists.length} Drucklisten · Format 6×4 Zoll
          </p>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Label-Bibliothek"
        summary="6×4 Zoll Labels, Karten und Handouts erstellen, bearbeiten und drucken."
        actions={
          <Link href={`/worlds/${worldSlug}/labels/new`} className={buttonVariants()}>
            Neues Label
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {(deleted || duplicated || templateSaved || renamed) && (
          <Alert tone="success">
            {deleted
              ? "Gelöscht."
              : duplicated
                ? "Dupliziert."
                : templateSaved
                  ? "Template gespeichert."
                  : renamed
                    ? "Template umbenannt."
                    : "Erfolgreich."}
          </Alert>
        )}

        <details className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
          <summary className="cursor-pointer font-medium">Druck-Workflow — Kurzanleitung</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Label erstellen oder aus Seite/Handout generieren</li>
            <li>Druckliste anlegen und Labels hinzufügen</li>
            <li>PDF exportieren oder über RTX-Druck senden</li>
          </ol>
        </details>

        <nav className="flex flex-wrap gap-2" aria-label="Label-Bereiche">
          <Link
            href={`/worlds/${worldSlug}/labels`}
            aria-current={activeTab === "labels" ? "page" : undefined}
            className={cn(badgeVariants({ variant: activeTab === "labels" ? "accent" : "default" }), TAB_LINK_CLASS)}
          >
            Labels ({labelRows.length})
          </Link>
          <Link
            href={`/worlds/${worldSlug}/labels?tab=templates`}
            aria-current={activeTab === "templates" ? "page" : undefined}
            className={cn(badgeVariants({ variant: activeTab === "templates" ? "accent" : "default" }), TAB_LINK_CLASS)}
          >
            Templates ({templates.length})
          </Link>
          <Link
            href={`/worlds/${worldSlug}/labels?tab=print-lists`}
            aria-current={activeTab === "print-lists" ? "page" : undefined}
            className={cn(badgeVariants({ variant: activeTab === "print-lists" ? "accent" : "default" }), TAB_LINK_CLASS)}
          >
            Drucklisten ({printLists.length})
          </Link>
          <Link href={`/worlds/${worldSlug}/labels/print`} className={cn(badgeVariants(), TAB_LINK_CLASS)}>
            RTX-Druck
          </Link>
        </nav>

        {activeTab === "labels" && (
          <>
            {labelRows.length === 0 ? (
              <EmptyState
                title="Noch keine Labels"
                description="Noch keine Labels für diese Welt erstellt."
                action={
                  <Link
                    href={`/worlds/${worldSlug}/labels/new`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Erstes Label erstellen
                  </Link>
                }
              />
            ) : (
              <ResponsiveTable
                caption="Etiketten dieser Welt"
                rows={labelRows}
                rowKey={(label) => label.id}
                columns={[
                  {
                    key: "title",
                    label: "Titel",
                    primary: true,
                    render: (label) => label.title,
                  },
                  {
                    key: "source",
                    label: "Quelle",
                    render: (label) => LABEL_SOURCE_TYPE_LABELS[label.sourceType],
                  },
                  {
                    key: "template",
                    label: "Vorlage",
                    render: (label) => label.template.name,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (label) => LABEL_PRINT_STATUS_LABELS[label.printStatus],
                  },
                  {
                    // Das Datum sagt auf dem Telefon am wenigsten aus und
                    // faellt dort als Erstes weg.
                    key: "updated",
                    label: "Aktualisiert",
                    priority: "low",
                    render: (label) => label.updatedAt.toLocaleDateString("de-DE"),
                  },
                  {
                    key: "actions",
                    label: "Aktionen",
                    render: (label) => (
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`/worlds/${worldSlug}/labels/${label.id}`}>Bearbeiten</Link>
                        <Link href={`/worlds/${worldSlug}/labels/${label.id}/preview`}>
                          Vorschau
                        </Link>
                        <form action={duplicateLabelAction} className="inline">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="labelId" value={label.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Duplizieren
                          </Button>
                        </form>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}

        {activeTab === "templates" && (
          <>
            <ResponsiveTable
              caption="Etiketten-Vorlagen"
              rows={templates}
              rowKey={(template) => template.id}
              columns={[
                {
                  key: "name",
                  label: "Name",
                  primary: true,
                  render: (template) => template.name,
                },
                {
                  key: "type",
                  label: "Typ",
                  render: (template) => (template.isSystem ? "System" : "Welt"),
                },
                {
                  key: "description",
                  label: "Beschreibung",
                  priority: "low",
                  render: (template) => template.description ?? "—",
                },
                {
                  key: "actions",
                  label: "Aktionen",
                  render: (template) => (
                    <div className="flex flex-wrap items-center gap-3">
                      {!template.isSystem && (
                        <>
                          <form
                            action={renameTemplateAction}
                            className="inline-flex items-center gap-1"
                          >
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="templateId" value={template.id} />
                            <Input
                              type="text"
                              name="name"
                              defaultValue={template.name}
                              aria-label={`Neuer Name für ${template.name}`}
                              className="h-9 w-32"
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              Umbenennen
                            </Button>
                          </form>
                          <form action={deleteTemplateAction} className="inline">
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="templateId" value={template.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-warning"
                            >
                              Löschen
                            </Button>
                          </form>
                        </>
                      )}
                      <form action={duplicateTemplateAction} className="inline">
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="templateId" value={template.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Duplizieren
                        </Button>
                      </form>
                    </div>
                  ),
                },
              ]}
            />
            {worldTemplates.length === 0 && templates.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Nur System-Templates vorhanden. Speichere ein Label als Template, um eigene Vorlagen anzulegen.
              </p>
            )}
          </>
        )}

        {activeTab === "print-lists" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Neue Druckliste</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createPrintListAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <Input type="text" name="name" placeholder="Name" required className="w-48" />
                  <Input type="text" name="description" placeholder="Beschreibung (optional)" className="w-64" />
                  {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="forNextSession" className="size-4 rounded border-input" />
                    Für nächste Session
                  </label>
                  <Button type="submit">Erstellen</Button>
                </form>
              </CardContent>
            </Card>

            {printLists.length === 0 ? (
              <EmptyState title="Noch keine Drucklisten" description="Lege oben eine neue Druckliste an." />
            ) : (
              <ResponsiveTable
                caption="Drucklisten dieser Welt"
                rows={printLists}
                rowKey={(list) => list.id}
                columns={[
                  {
                    key: "name",
                    label: "Name",
                    primary: true,
                    render: (list) => (
                      <>
                        {list.name}
                        {list.forNextSession && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Für nächste Session
                          </p>
                        )}
                      </>
                    ),
                  },
                  {
                    key: "labels",
                    label: "Labels",
                    numeric: true,
                    render: (list) => summarizePrintList(list).labelCount,
                  },
                  {
                    key: "copies",
                    label: "Kopien",
                    numeric: true,
                    render: (list) => summarizePrintList(list).totalCopies,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (list) => LABEL_PRINT_STATUS_LABELS[list.status],
                  },
                  {
                    key: "created",
                    label: "Erstellt",
                    priority: "low",
                    render: (list) => list.createdAt.toLocaleDateString("de-DE"),
                  },
                  {
                    key: "actions",
                    label: "Aktionen",
                    render: (list) => (
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`/worlds/${worldSlug}/labels/print-lists/${list.id}`}>
                          Öffnen
                        </Link>
                        <a
                          href={`/api/worlds/${worldSlug}/print-lists/${list.id}/export?format=print`}
                          target="_blank"
                        >
                          Drucken
                        </a>
                        <a
                          href={`/api/worlds/${worldSlug}/print-lists/${list.id}/export?format=pdf`}
                        >
                          PDF
                        </a>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}
      </div>
    </WorldShell>
  );
}
