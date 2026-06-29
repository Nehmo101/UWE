import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
  VisibilityBadge,
} from "@uwe/shared-ui";
import type { Visibility } from "@uwe/database/enums";
import {
  BRAIN_DOCUMENT_TYPE_LABELS,
  BRAIN_FACT_TYPE_LABELS,
  BRAIN_STATUS_LABELS,
  BRAIN_VISIBILITY_LABELS,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { createBrainDocumentAction, createBrainFactAction } from "../../../brain-actions";
import { BrainAiGeneratePanel } from "@/components/BrainAiGeneratePanel";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

export default async function StudioBrainPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const db = createPrismaClient();
  const brain = createBrainStoreService();

  const [documents, facts, summary] = await Promise.all([
    brain.listDocuments(worldSlug, {
      campaignId: selectedCampaign?.id,
      accessContext: "dm",
    }),
    brain.listFacts(worldSlug, {
      campaignId: selectedCampaign?.id,
      accessContext: "dm",
    }),
    brain.getWorldSummary(worldSlug),
  ]);

  await db.$disconnect();

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Brain Store", `/worlds/${worldSlug}/brain`)}
        />
      }
      contextPanel={
        <>
          <CampaignSidebar
            items={campaignNavItems(`/worlds/${worldSlug}/brain`, campaigns, campaignSlug)}
          />
          <SidebarSection title="Kontext">
            <p className="uwe-hint" style={{ margin: 0 }}>
              Brain-Wissen wird dauerhaft in UWE gespeichert (alter Laptop).
            </p>
          </SidebarSection>
        </>
      }
    >
      <PageHeader
        title="Brain Knowledge Store"
        summary="Dauerhaftes Welt- und Kampagnenwissen in UWE — Sichtbarkeit dm_only, player_visible und public."
      />
      {summary && (
        <p className="uwe-brain-summary">
          {summary.documentCount} Dokumente · {summary.factCount} Fakten ·{" "}
          {summary.chunkCount} Chunks · {summary.linkCount} Links
        </p>
      )}

      <BrainAiGeneratePanel
        worldSlug={worldSlug}
        campaignId={selectedCampaign?.id}
      />

      <section className="uwe-brain-create-grid">
        <form action={createBrainDocumentAction} className="uwe-brain-create-form">
          <h2>Neues Dokument</h2>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          {selectedCampaign && (
            <input type="hidden" name="campaignId" value={selectedCampaign.id} />
          )}
          <label>
            Titel
            <input name="title" required className="uwe-input" placeholder="Dokumenttitel" />
          </label>
          <label>
            Inhalt
            <textarea name="content" className="uwe-input" rows={3} placeholder="Wissenstext…" />
          </label>
          <label>
            Typ
            <select name="documentType" className="uwe-input">
              {Object.entries(BRAIN_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sichtbarkeit
            <select name="visibility" className="uwe-input" defaultValue="dm_only">
              {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Dokument anlegen
          </button>
        </form>

        <form action={createBrainFactAction} className="uwe-brain-create-form">
          <h2>Neuer Fakt</h2>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          {selectedCampaign && (
            <input type="hidden" name="campaignId" value={selectedCampaign.id} />
          )}
          <label>
            Titel
            <input name="title" required className="uwe-input" placeholder="Fakt-Titel" />
          </label>
          <label>
            Inhalt
            <textarea name="content" className="uwe-input" rows={3} placeholder="Fakt-Inhalt…" />
          </label>
          <label>
            Typ
            <select name="factType" className="uwe-input">
              {Object.entries(BRAIN_FACT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sichtbarkeit
            <select name="visibility" className="uwe-input" defaultValue="dm_only">
              {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Fakt anlegen
          </button>
        </form>
      </section>

      <section className="uwe-brain-section">
        <h2>Dokumente</h2>
        {documents.length === 0 ? (
          <p className="uwe-v2-empty">Noch keine Brain-Dokumente.</p>
        ) : (
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Sichtbarkeit</th>
                <th>Status</th>
                <th>Quelle</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td data-label="Titel">
                    <Link href={`/worlds/${worldSlug}/brain/${doc.id}`}>{doc.title}</Link>
                  </td>
                  <td data-label="Typ">{BRAIN_DOCUMENT_TYPE_LABELS[doc.documentType]}</td>
                  <td data-label="Sichtbarkeit">
                    <VisibilityBadge visibility={doc.visibility as Visibility} />
                  </td>
                  <td data-label="Status">{BRAIN_STATUS_LABELS[doc.status]}</td>
                  <td data-label="Quelle">{doc.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="uwe-brain-section">
        <h2>Fakten</h2>
        {facts.length === 0 ? (
          <p className="uwe-v2-empty">Noch keine Brain-Fakten.</p>
        ) : (
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Sichtbarkeit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((fact) => (
                <tr key={fact.id}>
                  <td data-label="Titel">
                    <Link href={`/worlds/${worldSlug}/brain/facts/${fact.id}`}>
                      {fact.title}
                    </Link>
                  </td>
                  <td data-label="Typ">{BRAIN_FACT_TYPE_LABELS[fact.factType]}</td>
                  <td data-label="Sichtbarkeit">
                    <VisibilityBadge visibility={fact.visibility as Visibility} />
                  </td>
                  <td data-label="Status">{BRAIN_STATUS_LABELS[fact.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </WorldShell>
  );
}
