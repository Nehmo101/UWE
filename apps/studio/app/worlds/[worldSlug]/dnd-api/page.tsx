import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildPageUrl,
  createDndApiService,
  getAppRepository,
  prisma,
  resolveDndApiConfig,
} from "@uwe/database/server";
import { searchAllDndApis } from "@uwe/dnd-api";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { DndApiEncounterPanel } from "@/components/DndApiEncounterPanel";
import { DndApiBrowseCacheNotice } from "@/src/components/world/DndApiBrowseCache";
import { addDndBeyondReferenceAction } from "../../../integration-actions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function WorldDndApiPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const config = resolveDndApiConfig();
  const dndApi = createDndApiService(prisma);
  const beyondReferences = await dndApi.listBeyondReferences(world.id);

  let results: Awaited<ReturnType<typeof searchAllDndApis>> = [];
  if (q?.trim()) {
    results = await searchAllDndApis(q, {
      open5eEnabled: config.open5eEnabled,
      dnd5eSrdEnabled: config.dnd5eSrdEnabled,
    });
  }
  // Open5e-Treffer zeigt bereits das Encounter-Panel als Karten — hier nur der Rest.
  const additionalResults = results.filter((item) => item.provider !== "open5e");

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "DnD API", `/worlds/${worldSlug}/dnd-api`)}
        />
      }
    >
      <PageHeader
        title="DnD API"
        summary="Open5e + D&amp;D 5e SRD API. D&amp;D Beyond nur als manuelle Link-Referenz — kein Scraping."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Suche (Open5e / SRD)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form method="get" className="flex flex-wrap gap-2">
              <Input name="q" defaultValue={q ?? ""} placeholder="Goblin, Fireball …" className="max-w-xs" />
              <Button type="submit">Suchen</Button>
            </form>
            <DndApiBrowseCacheNotice query={q ?? ""} results={results} />
          </CardContent>
        </Card>

        <DndApiEncounterPanel
          worldSlug={worldSlug}
          results={results.map((item) => ({
            provider: item.provider,
            id: item.id,
            name: item.name,
            url: item.url,
            summary: item.summary,
          }))}
        />

        {q && results.length === 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{`Ergebnisse für „${q}“`}</h2>
            <EmptyState title="Keine Treffer" description="Andere Schreibweise oder API deaktiviert?" />
          </section>
        )}

        {q && additionalResults.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{`Weitere Ergebnisse für „${q}“ (andere Quellen)`}</h2>
            <ul className="grid gap-2">
              {additionalResults.map((item) => (
                <li
                  key={`${item.provider}-${item.id}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <strong>{item.name}</strong>
                  <Badge variant="secondary">{item.provider}</Badge>
                  {item.summary && <p className="basis-full text-sm text-muted-foreground">{item.summary}</p>}
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
                    API / Quelle
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Card>
          <CardHeader>
            <CardTitle>D&amp;D Beyond Referenz (manuell)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addDndBeyondReferenceAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dndbeyond-title">Titel</Label>
                <Input id="dndbeyond-title" name="title" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dndbeyond-url">D&amp;D Beyond URL</Label>
                <Input
                  id="dndbeyond-url"
                  name="url"
                  type="url"
                  required
                  placeholder="https://www.dndbeyond.com/…"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dndbeyond-entity-type">Typ (optional)</Label>
                <Input id="dndbeyond-entity-type" name="entityType" placeholder="monster, spell, …" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dndbeyond-notes">Notizen</Label>
                <Textarea id="dndbeyond-notes" name="notes" rows={2} />
              </div>

              <div>
                <Button type="submit">Referenz speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Gespeicherte D&amp;D Beyond Links</h2>
          {beyondReferences.length === 0 ? (
            <EmptyState title="Keine Referenzen" description="Füge manuelle D&D Beyond Links hinzu." />
          ) : (
            <ul className="grid gap-2">
              {beyondReferences.map((ref) => (
                <li
                  key={ref.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <strong>{ref.title}</strong>
                  {ref.entityType && <Badge variant="secondary">{ref.entityType}</Badge>}
                  <a href={ref.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
                    D&amp;D Beyond öffnen
                  </a>
                  {ref.page && (
                    <Link href={buildPageUrl(worldSlug, ref.page.type, ref.page.slug)} className="text-sm">
                      UWE-Seite: {ref.page.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorldShell>
  );
}
