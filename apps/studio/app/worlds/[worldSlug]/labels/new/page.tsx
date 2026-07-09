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
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { LabelTemplatePreviewPicker } from "@/src/components/labels/LabelTemplatePreviewPicker";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

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
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Labels",
            `/worlds/${worldSlug}/labels`,
            "Neu",
          )}
        />
      }
      contextPanel={
        <SidebarSection title="Hinweis">
          <p className="uwe-hint" style={{ margin: 0 }}>
            Labels sind 6×4 Zoll. DM-only Inhalte werden standardmäßig ausgeschlossen.
            AI-Bild-/Textgenerierung ist als Platzhalter vorbereitet.
          </p>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Neues Label erstellen"
        summary="Quelle und Vorlage wählen — Inhalt wird aus bestehenden Pages, Räumen, Blöcken oder Assets übernommen."
      />
      {pages.length === 0 && blocks.length === 0 && assets.length === 0 ? (
        <section className="uwe-panel">
          <h2>Aus Seite, Raum, Block oder Asset</h2>
          <p className="uwe-v2-empty">
            Noch keine Quellen vorhanden — erstelle zuerst Seiten oder lade Assets hoch.
            Alternativ kannst du unten ein leeres Label anlegen.
          </p>
        </section>
      ) : (
      <section className="uwe-panel">
        <h2>Aus Seite, Raum, Block oder Asset</h2>
        <form action={createLabelFromSourceAction} className="uwe-form-grid">
          <input type="hidden" name="worldSlug" value={worldSlug} />

          <label>
            Quelle
            <select name="sourceRef" required defaultValue={preselectedSource || (pages[0] ? `page:${pages[0].id}` : "")}>
              <optgroup label="Seiten">
                {pages.map((page) => (
                  <option key={page.id} value={`page:${page.id}`}>
                    {page.title} ({page.type})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Dungeon-Räume">
                {roomPages.map((page) => (
                  <option key={`room-${page.id}`} value={`dungeon_room:${page.id}`}>
                    {page.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Encounter / Loot / Handouts / Rätsel">
                {handoutPages.map((page) => (
                  <option key={`handout-${page.id}`} value={`page:${page.id}`}>
                    {page.title} ({page.type})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Inhaltsblöcke">
                {blocks.map((block) => (
                  <option key={block.id} value={`content_block:${block.id}`}>
                    {block.pageTitle} · {block.type}
                    {block.visibility === "dm_only" ? " (DM)" : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Assets / Bilder">
                {assets.map((asset) => (
                  <option key={asset.id} value={`asset:${asset.id}`}>
                    {asset.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <LabelTemplatePreviewPicker
            templates={templatePreviewOptions}
            defaultTemplateId={templates[0]?.id}
          />

          <label>
            Titel (optional)
            <input type="text" name="title" placeholder="Automatisch aus Quelle" />
          </label>

          <fieldset className="uwe-fieldset">
            <legend>Layout</legend>
            <label>
              Modus
              <select name="layoutMode" defaultValue="image_text">
                <option value="image_text">Bild + Text</option>
                <option value="text_only">Nur Text</option>
                <option value="image_only">Nur Bild</option>
              </select>
            </label>
            <label className="uwe-checkbox">
              <input type="checkbox" name="truncateToPage" defaultChecked />
              Inhalt auf eine Seite kürzen
            </label>
            <label className="uwe-checkbox">
              <input type="checkbox" name="truncateLongWords" defaultChecked />
              Lange Wörter kürzen
            </label>
          </fieldset>

          <label className="uwe-checkbox uwe-text-warning">
            <input
              type="checkbox"
              name="includeDmOnly"
              defaultChecked={includeDmOnly === "1"}
            />
            DM-only Inhalte bewusst einschließen
          </label>

          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Label erstellen
          </button>
        </form>
      </section>
      )}

      <section className="uwe-panel">
        <h2>Leeres Label (manuell)</h2>
        <form action={createManualLabelAction} className="uwe-form-grid">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <label>
            Titel
            <input type="text" name="title" required defaultValue="Neues Label" />
          </label>
          <label>
            Text
            <textarea name="text" rows={5} placeholder="Label-Inhalt…" />
          </label>
          <label>
            Vorlage
            <select name="templateId" defaultValue={templates[0]?.id} required>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modus
            <select name="layoutMode" defaultValue="text_only">
              <option value="image_text">Bild + Text</option>
              <option value="text_only">Nur Text</option>
              <option value="image_only">Nur Bild</option>
            </select>
          </label>
          <label className="uwe-checkbox">
            <input type="checkbox" name="truncateToPage" defaultChecked />
            Inhalt auf eine Seite kürzen
          </label>
          <label className="uwe-checkbox">
            <input type="checkbox" name="truncateLongWords" defaultChecked />
            Lange Wörter kürzen
          </label>
          <button type="submit" className="uwe-v2-btn">
            Leeres Label speichern
          </button>
        </form>
      </section>
    </WorldShell>
  );
}
