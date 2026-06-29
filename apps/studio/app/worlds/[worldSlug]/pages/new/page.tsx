import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
  PUBLISH_LABELS,
  CANONICAL_LABELS,
} from "@uwe/shared-ui";
import {
  createPageTemplateService,
  getAppRepository,
  prisma,
  PageTypeEnum,
  VisibilityEnum,
  PublishStatusEnum,
  CanonicalStatusEnum,
} from "@uwe/database/server";
import { WorldContextSidebar, WorldModuleShell } from "@/components/WorldModuleShell";
import { NewPageAiPanel } from "@/components/NewPageAiPanel";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { createPageAction } from "../../../../actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; template?: string; title?: string }>;
}

export default async function NewPageForm({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, template: templateId, title: prefillTitle } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const settings = await repo.getSystemSettings();
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const templateService = createPageTemplateService(prisma);
  const templates = await templateService.listTemplates();
  const template =
    (await templateService.getTemplate(templateId)) ??
    templates.find((entry) => entry.slug === "blank") ??
    templates[0];
  if (!template) notFound();

  const extraBlocks = template.blocks.slice(1);

  function templateHref(slug: string): string {
    const query = new URLSearchParams();
    if (campaignSlug) query.set("campaign", campaignSlug);
    if (slug !== "blank") query.set("template", slug);
    const qs = query.toString();
    return `/worlds/${worldSlug}/pages/new${qs ? `?${qs}` : ""}`;
  }

  return (
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="new-page"
      campaignSlug={campaignSlug}
      backLink={{ label: "← Seitenliste", href: `/worlds/${worldSlug}` }}
      breadcrumb={worldSectionBreadcrumb(world.name, worldSlug, "Neue Seite")}
      pageHeader={{
        title: "Neue Seite",
        summary: "Wähle eine Vorlage und lege los — Slug und DM-Notizblöcke werden automatisch angelegt.",
      }}
      sidebarExtra={
        <WorldContextSidebar
          items={[
            { label: "← Übersicht", href: `/worlds/${worldSlug}/dashboard` },
            { label: "Seitenliste", href: `/worlds/${worldSlug}` },
          ]}
        />
      }
      showSearch={false}
    >
      <div className="uwe-template-grid" role="group" aria-label="Seitenvorlagen">
        {templates.map((entry) => (
          <Link
            key={entry.id}
            href={templateHref(entry.slug)}
            className={`uwe-template-card${entry.id === template.id ? " active" : ""}`}
          >
            <strong>{entry.name}</strong>
            <span>{entry.description}</span>
          </Link>
        ))}
      </div>

      <NewPageAiPanel
        worldSlug={worldSlug}
        pageType={template.pageType}
        campaignSlug={campaignSlug}
      />

      <p className="uwe-form-hint">
        <Link href="/templates">Templates verwalten →</Link>
      </p>

      <form action={createPageAction} className="uwe-v2-form" key={template.id}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="template" value={template.slug} />

        <label>
          Titel
          <input name="title" required placeholder={template.titlePlaceholder} defaultValue={prefillTitle ?? ""} />
        </label>

        {campaigns.length > 0 && (
          <label>
            Kampagne
            <select name="campaignId" defaultValue={selectedCampaign?.id ?? ""}>
              <option value="">Keine Kampagne (weltweit)</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Slug (optional)
          <input name="slug" placeholder="leer lassen für automatischen Slug" />
        </label>

        <label>
          Typ
          <select name="type" defaultValue={template.pageType}>
            {Object.values(PageTypeEnum).map((type) => (
              <option key={type} value={type}>
                {PAGE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Zusammenfassung
          <textarea name="summary" rows={3} />
        </label>

        <label>
          Sichtbarkeit
          <select
            name="visibility"
            defaultValue={
              template.slug === "blank"
                ? settings.worlds.defaultVisibility
                : template.defaultVisibility
            }
          >
            {Object.values(VisibilityEnum).map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
            ))}
          </select>
          <small className="uwe-field-hint">
            „Portal sichtbar“ und „Share-Link“ sind nach dem
              Veröffentlichen für angemeldete Spieler im Portal sichtbar.
              „Nur GM“ erscheint dort niemals.
          </small>
        </label>

        <label>
          Publish Status
          <select name="publishStatus" defaultValue="draft">
            {Object.values(PublishStatusEnum).map((v) => (
              <option key={v} value={v}>{PUBLISH_LABELS[v]}</option>
            ))}
          </select>
        </label>

        <label>
          Canonical Status
          <select name="canonicalStatus" defaultValue={settings.worlds.defaultCanonicalStatus}>
            {Object.values(CanonicalStatusEnum).map((v) => (
              <option key={v} value={v}>{CANONICAL_LABELS[v]}</option>
            ))}
          </select>
        </label>

        <label>
          Tags (kommagetrennt)
          <input name="tags" placeholder="tag1, tag2" />
        </label>

        <label>
          Erster Inhaltsblock
          <textarea
            name="initialContent"
            rows={template.slug === "blank" ? 6 : 12}
            defaultValue={template.blocks[0]?.content ?? ""}
            placeholder="[[Wikilinks]] unterstützt"
          />
        </label>

        {extraBlocks.length > 0 && (
          <p className="uwe-form-hint">
            Diese Vorlage legt zusätzlich {extraBlocks.length}{" "}
            {extraBlocks.length === 1 ? "Block" : "Blöcke"} an:{" "}
            {extraBlocks
              .map((block) =>
                block.type === "gm_note" ? "DM-Notiz (nur für dich)" : "Inhaltsblock",
              )
              .join(", ")}
            .
          </p>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Seite erstellen</button>
          <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}`}>Abbrechen</Link>
        </div>
      </form>
    </WorldModuleShell>
  );
}
