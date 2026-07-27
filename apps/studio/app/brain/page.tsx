import Link from "next/link";
import {
  BRAIN_STATUS_LABELS,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

export default async function BrainOverviewPage() {
  const repo = getAppRepository();
  const worlds = await repo.listWorlds();

  const db = createPrismaClient();
  const brain = createBrainStoreService();

  const worldSummaries = await Promise.all(
    worlds.map(async (world) => {
      const [documents, facts, summary] = await Promise.all([
        brain.listDocuments(world.slug, { includeArchived: true, limit: 6 }),
        brain.listFacts(world.slug, { includeArchived: true, limit: 6 }),
        brain.getWorldSummary(world.slug),
      ]);
      return { world, documents, facts, summary };
    }),
  );

  await db.$disconnect();

  return (
    <StudioShell
      breadcrumb={<BreadcrumbTrail items={[{ label: "Brain Knowledge Store" }]} />}
    >
      <PageHeader
        title="Brain Knowledge Store"
        summary="Dauerhaftes DnD-Welt- und Kampagnenwissen — getrennt vom privaten Life-Brain unter /life-brain."
      />
      {worlds.length === 0 ? (
        <EmptyState
          title="Keine Welten"
          description="Lege zuerst eine Welt an, um Brain-Einträge zu speichern."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {worldSummaries.map(({ world, documents, facts, summary }) => (
            <Card key={world.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/worlds/${world.slug}/brain`}>{world.name}</Link>
                </CardTitle>
                {summary && (
                  <p className="text-sm text-muted-foreground">
                    {summary.documentCount} Dokumente · {summary.factCount} Fakten ·{" "}
                    {summary.chunkCount} Chunks
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {(documents.length > 0 || facts.length > 0) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={TH_CLASS}>Eintrag</th>
                          <th className={TH_CLASS}>Art</th>
                          <th className={TH_CLASS}>Sichtbarkeit</th>
                          <th className={TH_CLASS}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.slice(0, 5).map((doc) => (
                          <tr key={doc.id}>
                            <td className={TD_CLASS}>
                              <Link href={`/worlds/${world.slug}/brain/${doc.id}`}>{doc.title}</Link>
                            </td>
                            <td className={TD_CLASS}>Dokument</td>
                            <td className={TD_CLASS}>{BRAIN_STATUS_LABELS[doc.status]}</td>
                          </tr>
                        ))}
                        {facts.slice(0, 5).map((fact) => (
                          <tr key={fact.id}>
                            <td className={TD_CLASS}>
                              <Link href={`/worlds/${world.slug}/brain/facts/${fact.id}`}>
                                {fact.title}
                              </Link>
                            </td>
                            <td className={TD_CLASS}>Fakt</td>
                            <td className={TD_CLASS}>{BRAIN_STATUS_LABELS[fact.status]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/worlds/${world.slug}/brain`}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Brain Store öffnen
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    KI-Wissensgenerierung pro Welt im{" "}
                    <Link href={`/worlds/${world.slug}/brain`}>Brain Store</Link>.
                  </span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </StudioShell>
  );
}
