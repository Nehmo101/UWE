import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createLabelService,
  getAppRepository,
} from "@uwe/database/server";
import {
  createLabelFromSourceAction,
  createManualLabelAction,
} from "@/app/label-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { LabelTemplatePreviewPicker } from "@/src/components/labels/LabelTemplatePreviewPicker";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ sourceRef?: string; includeDmOnly?: string }>;
}

export default async function StudioNewLabelPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { sourceRef: preselectedSource, includeDmOnly } = await searchParams;
  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const templates = await labelService.listTemplates(world.id);
  const templatePreviewOptions = templates.map((template) => {
    const layout =
      template.layoutSettings && typeof template.layoutSettings === "object"
        ? (template.layoutSettings as { mode?: string; widthInches?: number; heightInches?: number })
        : {};
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      widthInches: layout.widthInches ?? 6,
      heightInches: layout.heightInches ?? 4,
      mode: layout.mode ?? "image_text",
    };
  });
  const pages = await labelService.listSourcePagesForLabels(worldSlug);
  const roomPages = pages.filter((page) => page.type === "room");
  const handoutPages = pages.filter((page) =>
    ["handout", "item", "quest", "note", "encounter"].includes(page.type),
  );
  const blocks = await labelService.listSourceBlocksForLabels(worldSlug);
  const assets = await repo.listAssetsByWorld(worldSlug);

  return (
    <>
      <ShellBreadcrumb
        items={worldDetailBreadcrumb(
          world.name,
          worldSlug,
          "Labels",
          `/worlds/${worldSlug}/labels`,
          "Neu",
        )}
      />
      <ShellContextPanel>
        <SidebarSection title="Hinweis">
          <p className="m-0 text-sm text-muted-foreground">
            Labels sind 6×4 Zoll. DM-only Inhalte werden standardmäßig ausgeschlossen.
            AI-Bild-/Textgenerierung ist als Platzhalter vorbereitet.
          </p>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Neues Label erstellen"
        summary="Quelle und Vorlage wählen — Inhalt wird aus bestehenden Pages, Räumen, Blöcken oder Assets übernommen."
      />

      <div className="flex flex-col gap-6">
        {pages.length === 0 && blocks.length === 0 && assets.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aus Seite, Raum, Block oder Asset</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Noch keine Quellen vorhanden"
                description="Erstelle zuerst Seiten oder lade Assets hoch. Alternativ kannst du unten ein leeres Label anlegen."
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Aus Seite, Raum, Block oder Asset</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createLabelFromSourceAction} className="flex flex-col gap-4">
                <input type="hidden" name="worldSlug" value={worldSlug} />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-label-source">Quelle</Label>
                  {/* TODO(design-kit): Select-Kit hat keine SelectLabel-Komponente für Optgroups —
                      Gruppenüberschriften als einfache Divs simuliert. */}
                  <Select
                    name="sourceRef"
                    required
                    defaultValue={preselectedSource || (pages[0] ? `page:${pages[0].id}` : "")}
                  >
                    <SelectTrigger id="new-label-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.length > 0 && (
                        <SelectGroup>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Seiten</div>
                          {pages.map((page) => (
                            <SelectItem key={page.id} value={`page:${page.id}`}>
                              {page.title} ({page.type})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {roomPages.length > 0 && (
                        <SelectGroup>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Dungeon-Räume
                          </div>
                          {roomPages.map((page) => (
                            <SelectItem key={`room-${page.id}`} value={`dungeon_room:${page.id}`}>
                              {page.title}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {handoutPages.length > 0 && (
                        <SelectGroup>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Encounter / Loot / Handouts / Rätsel
                          </div>
                          {handoutPages.map((page) => (
                            <SelectItem key={`handout-${page.id}`} value={`page:${page.id}`}>
                              {page.title} ({page.type})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {blocks.length > 0 && (
                        <SelectGroup>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Inhaltsblöcke
                          </div>
                          {blocks.map((block) => (
                            <SelectItem key={block.id} value={`content_block:${block.id}`}>
                              {block.pageTitle} · {block.type}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {assets.length > 0 && (
                        <SelectGroup>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Assets / Bilder
                          </div>
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={`asset:${asset.id}`}>
                              {asset.title}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <LabelTemplatePreviewPicker
                  templates={templatePreviewOptions}
                  defaultTemplateId={templates[0]?.id}
                />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-label-title">Titel (optional)</Label>
                  <Input id="new-label-title" type="text" name="title" placeholder="Automatisch aus Quelle" />
                </div>

                <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
                  <legend className="px-1 text-sm font-medium text-foreground">Layout</legend>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="new-label-layout-mode">Modus</Label>
                    <Select name="layoutMode" defaultValue="image_text">
                      <SelectTrigger id="new-label-layout-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image_text">Bild + Text</SelectItem>
                        <SelectItem value="text_only">Nur Text</SelectItem>
                        <SelectItem value="image_only">Nur Bild</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="truncateToPage"
                      defaultChecked
                      className="size-4 rounded border-input"
                    />
                    Inhalt auf eine Seite kürzen
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="truncateLongWords"
                      defaultChecked
                      className="size-4 rounded border-input"
                    />
                    Lange Wörter kürzen
                  </label>
                </fieldset>

                <label className="flex items-center gap-2 text-sm text-warning">
                  <input
                    type="checkbox"
                    name="includeDmOnly"
                    defaultChecked={includeDmOnly === "1"}
                    className="size-4 rounded border-input"
                  />
                  DM-only Inhalte bewusst einschließen
                </label>

                <div>
                  <Button type="submit">Label erstellen</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Leeres Label (manuell)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createManualLabelAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-label-manual-title">Titel</Label>
                <Input id="new-label-manual-title" type="text" name="title" required defaultValue="Neues Label" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-label-manual-text">Text</Label>
                <Textarea id="new-label-manual-text" name="text" rows={5} placeholder="Label-Inhalt…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-label-manual-template">Vorlage</Label>
                <Select name="templateId" defaultValue={templates[0]?.id} required>
                  <SelectTrigger id="new-label-manual-template">
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-label-manual-layout-mode">Modus</Label>
                <Select name="layoutMode" defaultValue="text_only">
                  <SelectTrigger id="new-label-manual-layout-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image_text">Bild + Text</SelectItem>
                    <SelectItem value="text_only">Nur Text</SelectItem>
                    <SelectItem value="image_only">Nur Bild</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="truncateToPage"
                  defaultChecked
                  className="size-4 rounded border-input"
                />
                Inhalt auf eine Seite kürzen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="truncateLongWords"
                  defaultChecked
                  className="size-4 rounded border-input"
                />
                Lange Wörter kürzen
              </label>
              <div>
                <Button type="submit" variant="outline">Leeres Label speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
