import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BRAIN_FACT_TYPE_LABELS,
  BRAIN_SOURCE_LABELS,
  BRAIN_STATUS_LABELS,
  buildPageUrl,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { updateBrainFactAction } from "../../../../../brain-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  params: Promise<{ worldSlug: string; entryId: string }>;
}

function factDetailHref(worldSlug: string, factId: string) {
  return `/worlds/${worldSlug}/brain/facts/${factId}`;
}

export default async function StudioBrainFactPage({ params }: Props) {
  const { worldSlug, entryId } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const brain = createBrainStoreService();

  const fact = await brain.getFactByIdForWorld(worldSlug, entryId);
  if (!fact) notFound();

  const [links, allFacts] = await Promise.all([
    brain.listLinksForSource(worldSlug, "brain_fact", entryId),
    brain.listFacts(worldSlug, { factType: fact.factType }),
  ]);
  await db.$disconnect();

  const similarFacts = allFacts
    .filter((candidate) => candidate.id !== fact.id)
    .slice(0, 6);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Brain Store",
            `/worlds/${worldSlug}/brain`,
            fact.title,
          )}
        />
      }
    >
      <PageHeader
        title={fact.title}
        summary="Brain-Fakt bearbeiten"
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quellen &amp; Bezüge</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                Quelle: <strong className="font-semibold text-foreground">{BRAIN_SOURCE_LABELS[fact.source]}</strong>
              </li>
              {fact.page && (
                <li>
                  Wiki-Seite:{" "}
                  <Link href={buildPageUrl(worldSlug, fact.page.type, fact.page.slug)}>
                    {fact.page.title}
                  </Link>
                </li>
              )}
              {fact.campaign && (
                <li>
                  Kampagne:{" "}
                  <Link href={`/worlds/${worldSlug}?campaign=${fact.campaign.slug}`}>
                    {fact.campaign.name}
                  </Link>
                </li>
              )}
              {fact.gameSession && (
                <li>
                  Session:{" "}
                  <Link href={`/worlds/${worldSlug}/sessions/${fact.gameSession.id}`}>
                    {fact.gameSession.title}
                    {fact.gameSession.sessionNumber != null
                      ? ` (#${fact.gameSession.sessionNumber})`
                      : ""}
                  </Link>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateBrainFactAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="factId" value={fact.id} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fact-title">Titel</Label>
                <Input id="fact-title" name="title" defaultValue={fact.title} required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fact-content">Inhalt</Label>
                <Textarea id="fact-content" name="content" defaultValue={fact.content} rows={8} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fact-type">Typ</Label>
                <Select name="factType" defaultValue={fact.factType}>
                  <SelectTrigger id="fact-type">
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


              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fact-status">Status</Label>
                <Select name="status" defaultValue={fact.status}>
                  <SelectTrigger id="fact-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BRAIN_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {similarFacts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ähnliche Fakten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Weitere Fakten vom Typ „{BRAIN_FACT_TYPE_LABELS[fact.factType]}“.
              </p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {similarFacts.map((similar) => (
                  <li key={similar.id}>
                    <Link href={factDetailHref(worldSlug, similar.id)}>{similar.title}</Link>
                    {" — "}
                    {BRAIN_STATUS_LABELS[similar.status]}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {links.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1.5 text-sm">
                {links.map((link) => (
                  <li key={link.id}>
                    {link.relationType}: {link.targetType} → {link.targetId}
                    {link.label ? ` (${link.label})` : ""}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </WorldShell>
  );
}
