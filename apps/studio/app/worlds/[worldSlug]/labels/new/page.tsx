import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createLabelService,
  getAppRepository,
} from "@uwe/database/server";
import { worldSidebar } from "../page";
import {
  createLabelFromSourceAction,
  createManualLabelAction,
} from "@/app/label-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function StudioNewLabelPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const templates = await labelService.listTemplates(world.id);
  const pages = await labelService.listSourcePagesForLabels(worldSlug);
  const roomPages = pages.filter((page) => page.type === "room");
  const handoutPages = pages.filter((page) =>
    ["handout", "item", "quest", "note", "encounter"].includes(page.type),
  );
  const blocks = await labelService.listSourceBlocksForLabels(worldSlug);
  const assets = await repo.listAssetsByWorld(worldSlug);

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={worldSidebar(worldSlug, "labels")}
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Labels", href: `/worlds/${worldSlug}/labels` },
              { label: "Neu" },
            ]}
          />
          <PageHeader
            title="Neues Label erstellen"
            summary="Quelle und Vorlage wählen — Inhalt wird aus bestehenden Pages, Räumen, Blöcken oder Assets übernommen."
          />

          {pages.length === 0 && blocks.length === 0 && assets.length === 0 ? (
            <section className="uwe-panel">
              <h2>Aus Seite, Raum, Block oder Asset</h2>
              <p className="uwe-empty">
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
                <select name="sourceRef" required defaultValue={pages[0] ? `page:${pages[0].id}` : ""}>
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
                <input type="checkbox" name="includeDmOnly" />
                DM-only Inhalte bewusst einschließen
              </label>

              <button type="submit" className="uwe-btn uwe-btn-primary">
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
              <button type="submit" className="uwe-btn">
                Leeres Label speichern
              </button>
            </form>
          </section>

          <p>
            <Link href={`/worlds/${worldSlug}/labels`}>← Zurück zur Bibliothek</Link>
          </p>
        </>
      }
      context={
        <SidebarSection title="Hinweis">
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
            Labels sind 6×4 Zoll. DM-only Inhalte werden standardmäßig ausgeschlossen.
            AI-Bild-/Textgenerierung ist als Platzhalter vorbereitet.
          </p>
        </SidebarSection>
      }
    />
  );
}
