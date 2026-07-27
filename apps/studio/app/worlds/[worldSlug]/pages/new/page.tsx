import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
  CANONICAL_LABELS,
} from "@uwe/shared-ui";
import {
  createPageTemplateService,
  getAppRepository,
  prisma,
  PageTypeEnum,
  VisibilityEnum,
  CanonicalStatusEnum,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldWikiPath } from "@/src/lib/world-last-route";
import { CampaignSidebar } from "@/src/components/wiki";
import { NewPageAiPanel } from "@/components/NewPageAiPanel";
import { SlugDuplicateChecker } from "@/src/components/ux/SlugDuplicateChecker";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { createPageAction } from "../../../../actions";
import {
  Button,
  buttonVariants,
  cn,
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
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Neue Seite")}
        />
      }
      contextPanel={
        <CampaignSidebar
          items={[
            { label: "← Übersicht", href: `/worlds/${worldSlug}/dashboard` },
            { label: "Seitenliste", href: worldWikiPath(worldSlug) },
          ]}
        />
      }
    >
      <PageHeader
        title="Neue Seite"
        summary="Wähle eine Vorlage und lege los — Slug und DM-Notizblöcke werden automatisch angelegt."
      />
      <div
        className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        role="group"
        aria-label="Seitenvorlagen"
      >
        {templates.map((entry) => (
          <Link
            key={entry.id}
            href={templateHref(entry.slug)}
            className={cn(
              "flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card p-3 text-card-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted",
              entry.id === template.id && "border-primary bg-muted",
            )}
          >
            <strong className="text-sm font-semibold text-foreground">{entry.name}</strong>
            <span className="text-xs text-muted-foreground">{entry.description}</span>
          </Link>
        ))}
      </div>

      <NewPageAiPanel
        worldSlug={worldSlug}
        pageType={template.pageType}
        campaignSlug={campaignSlug}
      />

      <p className="text-sm text-muted-foreground">
        <Link href="/templates">Templates verwalten →</Link>
      </p>

      <form action={createPageAction} className="flex flex-col gap-4" key={template.id}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="template" value={template.slug} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-title">Titel</Label>
          <Input
            id="page-title"
            name="title"
            required
            placeholder={template.titlePlaceholder}
            defaultValue={prefillTitle ?? ""}
          />
        </div>

        {campaigns.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-campaign">Kampagne</Label>
            {/* TODO(design-kit): natives Select statt Kit-Select — "Keine Kampagne
                (weltweit)" braucht einen Leerwert, den Radix Select nicht unterstützt. */}
            <select
              id="page-campaign"
              name="campaignId"
              defaultValue={selectedCampaign?.id ?? ""}
              className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Keine Kampagne (weltweit)</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <SlugDuplicateChecker worldSlug={worldSlug} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-type">Typ</Label>
          <Select name="type" defaultValue={template.pageType}>
            <SelectTrigger id="page-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PageTypeEnum).map((type) => (
                <SelectItem key={type} value={type}>
                  {PAGE_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-summary">Zusammenfassung</Label>
          <Textarea id="page-summary" name="summary" rows={3} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-visibility">Sichtbarkeit</Label>
          <Select
            name="visibility"
            defaultValue={
              template.slug === "blank"
                ? settings.worlds.defaultVisibility
                : template.defaultVisibility
            }
          >
            <SelectTrigger id="page-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(VisibilityEnum).map((v) => (
                <SelectItem key={v} value={v}>
                  {VISIBILITY_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <small className="text-xs text-muted-foreground">
            „Portal sichtbar“ und „Share-Link“ sind nach dem
              Veröffentlichen für angemeldete Spieler im Portal sichtbar.
              „Nur GM“ erscheint dort niemals.
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-publish-status">Publish Status</Label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-canonical-status">Kanon-Status</Label>
          <Select name="canonicalStatus" defaultValue={settings.worlds.defaultCanonicalStatus}>
            <SelectTrigger id="page-canonical-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CanonicalStatusEnum).map((v) => (
                <SelectItem key={v} value={v}>
                  {CANONICAL_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <small className="text-xs text-muted-foreground">
            Steuert den Kanon-Lebenszyklus: von Idee über Vorbereitung bis etabliertem Kanon
            oder verworfenen Inhalten.
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-tags">Tags (kommagetrennt)</Label>
          <Input id="page-tags" name="tags" placeholder="tag1, tag2" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-initial-content">Erster Inhaltsblock</Label>
          <Textarea
            id="page-initial-content"
            name="initialContent"
            rows={template.slug === "blank" ? 6 : 12}
            defaultValue={template.blocks[0]?.content ?? ""}
            placeholder="[[Wikilinks]] unterstützt"
          />
        </div>

        {extraBlocks.length > 0 && (
          <p className="text-sm text-muted-foreground">
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

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Seite erstellen</Button>
          <Link className={buttonVariants({ variant: "ghost" })} href={worldWikiPath(worldSlug)}>
            Abbrechen
          </Link>
        </div>
      </form>
    </WorldShell>
  );
}
