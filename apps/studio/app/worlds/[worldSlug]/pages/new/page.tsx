import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PAGE_TYPE_LABELS,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
  PUBLISH_LABELS,
  CANONICAL_LABELS,
} from "@uwe/shared-ui";
import {
  getAppRepository,
  getPageTemplate,
  PAGE_TEMPLATES,
  PageTypeEnum,
  VisibilityEnum,
  PublishStatusEnum,
  CanonicalStatusEnum,
} from "@uwe/database/server";
import { createPageAction } from "../../../../actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; template?: string }>;
}

export default async function NewPageForm({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, template: templateId } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const settings = await repo.getSystemSettings();
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : campaigns[0];

  const template = getPageTemplate(templateId) ?? getPageTemplate("blank")!;
  const extraBlocks = template.blocks.slice(1);

  function templateHref(id: string): string {
    const query = new URLSearchParams();
    if (campaignSlug) query.set("campaign", campaignSlug);
    if (id !== "blank") query.set("template", id);
    const qs = query.toString();
    return `/worlds/${worldSlug}/pages/new${qs ? `?${qs}` : ""}`;
  }

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Neue Seite" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Übersicht", href: `/worlds/${worldSlug}/dashboard` },
              { label: "Seitenliste", href: `/worlds/${worldSlug}` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Neue Seite" },
            ]}
          />

          <PageHeader
            title="Neue Seite"
            summary="Wähle eine Vorlage und lege los — Slug und DM-Notizblöcke werden automatisch angelegt."
          />

          <div className="uwe-template-grid" role="group" aria-label="Seitenvorlagen">
            {PAGE_TEMPLATES.map((entry) => (
              <Link
                key={entry.id}
                href={templateHref(entry.id)}
                className={`uwe-template-card${entry.id === template.id ? " active" : ""}`}
              >
                <strong>{entry.name}</strong>
                <span>{entry.description}</span>
              </Link>
            ))}
          </div>

          <form action={createPageAction} className="uwe-form" key={template.id}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="template" value={template.id} />
            {selectedCampaign && (
              <input type="hidden" name="campaignId" value={selectedCampaign.id} />
            )}

            <label>
              Titel
              <input name="title" required placeholder={template.titlePlaceholder} />
            </label>

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
                  template.id === "blank"
                    ? settings.worlds.defaultVisibility
                    : template.defaultVisibility
                }
              >
                {Object.values(VisibilityEnum).map((v) => (
                  <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                ))}
              </select>
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
                rows={template.id === "blank" ? 6 : 12}
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
              <button type="submit" className="uwe-btn uwe-btn-primary">Seite erstellen</button>
              <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}`}>Abbrechen</Link>
            </div>
          </form>
        </>
      }
    />
  );
}
