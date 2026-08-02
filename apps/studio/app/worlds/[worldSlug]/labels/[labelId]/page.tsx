import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContextActions,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  analyzeLabelExportWarnings,
  createLabelService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  LABEL_SOURCE_TYPE_LABELS,
  normalizeLabel,
} from "@uwe/database/server";
import { isLabelAiShortenAvailable } from "@/src/lib/label-ai-shorten";
import { LabelEditWorkspace } from "@/components/LabelEditWorkspace";
import {
  deleteLabelAction,
  duplicateLabelAction,
  resetLabelToTemplateAction,
  saveLabelAsTemplateAction,
  setLabelPrintStatusAction,
  updateLabelAction,
} from "@/app/label-actions";
import { addLabelToPrintListAction } from "@/app/print-list-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string; labelId: string }>;
  searchParams: Promise<{
    saved?: string;
    created?: string;
    duplicated?: string;
    reset?: string;
    status?: string;
  }>;
}

export default async function StudioLabelEditPage({ params, searchParams }: Props) {
  const { worldSlug, labelId } = await params;
  const { saved, created, duplicated, reset, status } = await searchParams;
  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const label = await labelService.getLabelById(labelId);
  if (!label || label.worldId !== world.id) notFound();

  const templates = await labelService.listTemplates(world.id);
  const lists = await createPrintListService().listByWorld(worldSlug);
  const parsed = normalizeLabel(label);
  const exportWarnings = analyzeLabelExportWarnings(parsed.content, parsed.layoutSettings);
  const assets = await repo.listAssetsByWorld(worldSlug);
  const imageAssets = assets
    .filter((a) => a.mimeType?.startsWith("image/"))
    .map((a) => ({
      id: a.id,
      title: a.title,
      url: `/api/assets/${a.id}/file`,
    }));

  return (
    <>
      <ShellBreadcrumb
        items={worldDetailBreadcrumb(
          world.name,
          worldSlug,
          "Labels",
          `/worlds/${worldSlug}/labels`,
          label.title,
          `/worlds/${worldSlug}/labels/${labelId}`,
        )}
      />
      <ShellContextPanel>
        <SidebarSection title="Export">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=html`}>
                HTML exportieren
              </a>
            </li>
            <li>
              <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=pdf`}>
                PDF exportieren
              </a>
            </li>
            <li>
              <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=png`}>
                PNG exportieren
              </a>
            </li>
            <li>
              <a href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`} target="_blank">
                Druckvorschau
              </a>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            PDF-Fallback: Bei Fehlern liefert der Server Print-HTML mit Header{" "}
            <code>X-UWE-Export-Fallback: 1</code> — Grund steht in{" "}
            <code>X-UWE-Export-Fallback-Reason</code>.
          </p>
        </SidebarSection>
        <SidebarSection title="Druckstatus">
          <form action={setLabelPrintStatusAction} className="flex flex-col gap-2">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="labelId" value={labelId} />
            <Select name="status" defaultValue={label.printStatus}>
              <SelectTrigger aria-label="Druckstatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="exported">Exportiert</SelectItem>
                <SelectItem value="printed">Gedruckt</SelectItem>
                <SelectItem value="archived">Archiviert</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm">Status setzen</Button>
          </form>
        </SidebarSection>
        <SidebarSection title="Template">
          <form action={saveLabelAsTemplateAction} className="flex flex-col gap-2">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="labelId" value={labelId} />
            <Input type="text" name="templateName" placeholder="Template-Name" required />
            <Button type="submit" size="sm">Als Template speichern</Button>
          </form>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title={label.title}
        summary={`Quelle: ${LABEL_SOURCE_TYPE_LABELS[label.sourceType]} · Vorlage: ${label.template.name} · Status: ${LABEL_PRINT_STATUS_LABELS[label.printStatus]}`}
        actions={
          <ContextActions
            secondary={
              <>
                <Link
                  href={`/worlds/${worldSlug}/labels/${labelId}/preview`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Vorschau
                </Link>
                <a
                  href={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
                  className={buttonVariants()}
                  target="_blank"
                  rel="noreferrer"
                >
                  Drucken
                </a>
              </>
            }
            danger={
              <form action={deleteLabelAction} className="inline">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="labelId" value={labelId} />
                <Button type="submit" variant="destructive">Löschen</Button>
              </form>
            }
          />
        }
      />

      <div className="flex flex-col gap-6">
        {(saved || created || duplicated || reset || status) && (
          <Alert tone="success">
            {created
              ? "Label erstellt."
              : duplicated
                ? "Label dupliziert."
                : reset
                  ? "Layout auf Vorlage zurückgesetzt."
                  : status
                    ? `Status: ${LABEL_PRINT_STATUS_LABELS[status as keyof typeof LABEL_PRINT_STATUS_LABELS] ?? status}`
                    : "Gespeichert."}
          </Alert>
        )}

        {exportWarnings.map((warning) => (
          <Alert key={`export-${warning.code}-${warning.message}`} tone="warning">
            Export: {warning.message}
          </Alert>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Druckvorbereitung</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Vorschau im Druckformat (6×4 Zoll) — prüfe Safe Area und Kürzung vor dem Export.
            </p>
            {/* Label-Print-Ausnahme (Theme-Policy, Kopf von packages/shared-ui/src/uwe.css):
                die WYSIWYG-Druckvorschau bleibt auf fixer Papierfarbe und wird bewusst nicht
                auf Tokens umgestellt — migriert ist nur die Card-Hülle drumherum. */}
            <iframe
              title="Label Druckvorbereitung"
              src={`/api/worlds/${worldSlug}/labels/${labelId}/export?format=print`}
              className="uwe-label-preview-iframe"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visueller Label-Editor</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateLabelAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="labelId" value={labelId} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="label-edit-title">Titel</Label>
                  <Input id="label-edit-title" type="text" name="title" defaultValue={label.title} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="label-edit-template">Vorlage</Label>
                  <Select name="templateId" defaultValue={label.templateId}>
                    <SelectTrigger id="label-edit-template">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <input type="hidden" name="contentTitle" value={parsed.content.title} />
              <input type="hidden" name="text" value={parsed.content.text} />

              <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Layout &amp; Kürzung</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="label-edit-layout-mode">Modus</Label>
                    <Select name="layoutMode" defaultValue={parsed.layoutSettings.mode}>
                      <SelectTrigger id="label-edit-layout-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image_text">Bild + Text</SelectItem>
                        <SelectItem value="text_only">Nur Text</SelectItem>
                        <SelectItem value="image_only">Nur Bild</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="label-edit-fit-mode">Kürzmodus</Label>
                    <Select name="fitMode" defaultValue={parsed.layoutSettings.fitMode ?? "normal"}>
                      <SelectTrigger id="label-edit-fit-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">Konservativ</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="aggressive">Aggressiv</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                  <label className="flex items-center gap-2 self-end text-sm">
                    <input
                      type="checkbox"
                      name="snapToGrid"
                      defaultChecked={parsed.layoutSettings.snapToGrid ?? true}
                      className="size-4 rounded border-input"
                    />
                    Snap-to-Grid (0.1 in)
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="truncateToPage"
                    defaultChecked={parsed.layoutSettings.truncateToPage}
                    className="size-4 rounded border-input"
                  />
                  Inhalt auf eine Seite kürzen
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="truncateLongWords"
                    defaultChecked={parsed.layoutSettings.truncateLongWords}
                    className="size-4 rounded border-input"
                  />
                  Lange Wörter kürzen
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="showSafeArea"
                    defaultChecked={parsed.layoutSettings.showSafeArea ?? true}
                    className="size-4 rounded border-input"
                  />
                  Safe Area anzeigen
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="showCropMarks"
                    defaultChecked={parsed.layoutSettings.showCropMarks ?? false}
                    className="size-4 rounded border-input"
                  />
                  Schnittmarken im Export
                </label>
              </fieldset>

              <LabelEditWorkspace
                initialElements={parsed.content.elements ?? []}
                imageAssets={imageAssets}
                worldSlug={worldSlug}
                originalText={parsed.content.originalText ?? parsed.content.text}
                currentText={parsed.content.text ?? ""}
                fitStatus={parsed.content.fitStatus ?? "fits"}
                fitApplied={parsed.content.fitApplied}
                snapToGrid={parsed.layoutSettings.snapToGrid ?? true}
                gridSize={parsed.layoutSettings.gridSize ?? 0.1}
                showSafeArea={parsed.layoutSettings.showSafeArea ?? true}
                aiAvailable={isLabelAiShortenAvailable()}
              />

              <div>
                <Button type="submit" name="action" value="save">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Druckliste</CardTitle>
          </CardHeader>
          <CardContent>
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Drucklisten.{" "}
                <Link href={`/worlds/${worldSlug}/labels?tab=print-lists`}>Druckliste erstellen</Link>
              </p>
            ) : (
              <form action={addLabelToPrintListAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="labelId" value={labelId} />
                <Select name="printListId" defaultValue={lists[0]?.id} required>
                  <SelectTrigger aria-label="Druckliste" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" name="copies" defaultValue={1} min={1} max={99} className="w-16" />
                <Button type="submit" size="sm">
                  Zur Druckliste hinzufügen
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <form action={duplicateLabelAction} className="inline">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="labelId" value={labelId} />
            <Button type="submit" variant="outline">Duplizieren</Button>
          </form>
          <form action={resetLabelToTemplateAction} className="inline">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="labelId" value={labelId} />
            <Button type="submit" variant="outline">Auf Vorlage zurücksetzen</Button>
          </form>
        </div>
      </div>
    </>
  );
}
