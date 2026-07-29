import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
} from "@uwe/shared-ui";
import {
  BRAIN_DOCUMENT_TYPE_LABELS,
  BRAIN_FACT_TYPE_LABELS,
  BRAIN_STATUS_LABELS,
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
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; page?: string }>;
}

const BRAIN_PAGE_SIZE = 25;

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

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
      limit: BRAIN_PAGE_SIZE,
      offset: (page - 1) * BRAIN_PAGE_SIZE,
    }),
    brain.listFacts(worldSlug, {
      campaignId: selectedCampaign?.id,
    }),
    brain.getWorldSummary(worldSlug),
  ]);

  await db.$disconnect();

  const documentTotal = summary?.documentCount ?? documents.length;
  const totalPages = Math.max(1, Math.ceil(documentTotal / BRAIN_PAGE_SIZE));
  const documentTypeKeys = Object.keys(BRAIN_DOCUMENT_TYPE_LABELS);
  const factTypeKeys = Object.keys(BRAIN_FACT_TYPE_LABELS);

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
            <p className="text-sm text-muted-foreground">
              Brain-Wissen wird dauerhaft in UWE gespeichert — getrennt vom privaten Life-Brain.
              KI-Generierung läuft über den Maschinenraum (lokal, kein Cloud-Fallback für Weltwissen).
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
        <p className="text-sm text-muted-foreground">
          {summary.documentCount} Dokumente · {summary.factCount} Fakten ·{" "}
          {summary.chunkCount} Chunks · {summary.linkCount} Links
        </p>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dokumente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {documents.length === 0 ? (
              <EmptyState title="Noch keine Brain-Dokumente." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Titel</th>
                      <th className={TH_CLASS}>Typ</th>
                      <th className={TH_CLASS}>Sichtbarkeit</th>
                      <th className={TH_CLASS}>Status</th>
                      <th className={TH_CLASS}>Quelle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className={TD_CLASS}>
                          <Link href={`/worlds/${worldSlug}/brain/${doc.id}`}>{doc.title}</Link>
                        </td>
                        <td className={TD_CLASS}>{BRAIN_DOCUMENT_TYPE_LABELS[doc.documentType]}</td>
                        <td className={TD_CLASS}>
                        </td>
                        <td className={TD_CLASS}>{BRAIN_STATUS_LABELS[doc.status]}</td>
                        <td className={TD_CLASS}>{doc.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center gap-3" aria-label="Brain-Dokumente Pagination">
                {page > 1 ? (
                  <Link
                    href={brainPageHref(page - 1)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    ← Zurück
                  </Link>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  Seite {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={brainPageHref(page + 1)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Weiter →
                  </Link>
                ) : null}
              </nav>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fakten</CardTitle>
          </CardHeader>
          <CardContent>
            {facts.length === 0 ? (
              <EmptyState title="Noch keine Brain-Fakten." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Titel</th>
                      <th className={TH_CLASS}>Typ</th>
                      <th className={TH_CLASS}>Sichtbarkeit</th>
                      <th className={TH_CLASS}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facts.map((fact) => (
                      <tr key={fact.id}>
                        <td className={TD_CLASS}>
                          <Link href={`/worlds/${worldSlug}/brain/facts/${fact.id}`}>
                            {fact.title}
                          </Link>
                        </td>
                        <td className={TD_CLASS}>{BRAIN_FACT_TYPE_LABELS[fact.factType]}</td>
                        <td className={TD_CLASS}>
                        </td>
                        <td className={TD_CLASS}>{BRAIN_STATUS_LABELS[fact.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manuell anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <form action={createBrainDocumentAction} className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">Neues Dokument</h3>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                {selectedCampaign && (
                  <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brain-doc-title">Titel</Label>
                  <Input id="brain-doc-title" name="title" required placeholder="Dokumenttitel" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brain-doc-content">Inhalt</Label>
                  <Textarea id="brain-doc-content" name="content" rows={3} placeholder="Wissenstext…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brain-doc-type">Typ</Label>
                  <Select name="documentType" defaultValue={documentTypeKeys[0]}>
                    <SelectTrigger id="brain-doc-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BRAIN_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button type="submit">Dokument anlegen</Button>
                </div>
              </form>

              <form action={createBrainFactAction} className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">Neuer Fakt</h3>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                {selectedCampaign && (
                  <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brain-fact-title">Titel</Label>
                  <Input id="brain-fact-title" name="title" required placeholder="Fakt-Titel" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brain-fact-content">Inhalt</Label>
                  <Textarea id="brain-fact-content" name="content" rows={3} placeholder="Fakt-Inhalt…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brain-fact-type">Typ</Label>
                  <Select name="factType" defaultValue={factTypeKeys[0]}>
                    <SelectTrigger id="brain-fact-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BRAIN_FACT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button type="submit">Fakt anlegen</Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      <BrainAiGeneratePanel worldSlug={worldSlug} campaignId={selectedCampaign?.id} />
    </WorldShell>
  );
}
