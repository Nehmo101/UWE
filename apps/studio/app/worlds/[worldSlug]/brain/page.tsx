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
  searchParams: Promise<{ campaign?: string; page?: string }>;
}

const BRAIN_PAGE_SIZE = 25;

export default async function StudioBrainPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? "1") || 1);
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
      limit: BRAIN_PAGE_SIZE,
      offset: (page - 1) * BRAIN_PAGE_SIZE,
    }),
    brain.listFacts(worldSlug, {
      campaignId: selectedCampaign?.id,
      accessContext: "dm",
    }),
    brain.getWorldSummary(worldSlug),
  ]);

  await db.$disconnect();

  const documentTotal = summary?.documentCount ?? documents.length;
  const totalPages = Math.max(1, Math.ceil(documentTotal / BRAIN_PAGE_SIZE));

  function brainPageHref(nextPage: number): string {
    const paramsObj = new URLSearchParams();
    if (campaignSlug) paramsObj.set("campaign", campaignSlug);
    if (nextPage > 1) paramsObj.set("page", String(nextPage));
    const qs = paramsObj.toString();
    return `/worlds/${worldSlug}/brain${qs ? `?${qs}` : ""}`;
  }

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
              Brain-Wissen wird dauerhaft in UWE gespeichert — getrennt vom privaten Life-Brain.
              KI-Generierung läuft über den RTX Connector (lokal, kein Cloud-Fallback für Weltwissen).
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
        {totalPages > 1 && (
          <nav className="uwe-inline-actions" aria-label="Brain-Dokumente Pagination">
            {page > 1 ? <Link href={brainPageHref(page - 1)}>← Zurück</Link> : null}
            <span className="uwe-dashboard-muted">
              Seite {page} / {totalPages}
            </span>
            {page < totalPages ? <Link href={brainPageHref(page + 1)}>Weiter →</Link> : null}
          </nav>
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

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Manuell anlegen</h2>
        <div className="uwe-brain-create-grid">
          <form action={createBrainDocumentAction} className="uwe-brain-create-form">
            <h3>Neues Dokument</h3>
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
            <h3>Neuer Fakt</h3>
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
        </div>
      </section>

      <BrainAiGeneratePanel worldSlug={worldSlug} campaignId={selectedCampaign?.id} />
    </WorldShell>
  );
}
