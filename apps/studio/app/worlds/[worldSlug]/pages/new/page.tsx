import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PAGE_TYPE_LABELS,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
  PUBLISH_LABELS,
  CANONICAL_LABELS,
} from "@uwe/shared-ui";
import {
  getAppRepository,
  PageTypeEnum,
  VisibilityEnum,
  PublishStatusEnum,
  CanonicalStatusEnum,
} from "@uwe/database/server";
import { createPageAction } from "../../../../actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

export default async function NewPageForm({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : campaigns[0];

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Neue Seite" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Seitenliste", href: `/worlds/${worldSlug}` },
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

          <form action={createPageAction} className="uwe-form">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            {selectedCampaign && (
              <input type="hidden" name="campaignId" value={selectedCampaign.id} />
            )}

            <label>
              Titel
              <input name="title" required placeholder="Seitentitel" />
            </label>

            <label>
              Slug
              <input name="slug" required placeholder="seiten-slug" />
            </label>

            <label>
              Typ
              <select name="type" defaultValue="lore">
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
              <select name="visibility" defaultValue="dm_only">
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
              <select name="canonicalStatus" defaultValue="draft">
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
              <textarea name="initialContent" rows={6} placeholder="[[Wikilinks]] unterstützt" />
            </label>

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
