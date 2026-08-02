import Link from "next/link";
import {
  BRAIN_STATUS_LABELS,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { ResponsiveTable } from "@uwe/shared-ui";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/src/components/ui";

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
    <>
      <ShellBreadcrumb items={[{ label: "Brain Knowledge Store" }]} />
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
                {/*
                  Der Kopf führte vier Spalten, die Zeilen lieferten drei:
                  „Sichtbarkeit" hatte nie eine Zelle, weshalb der Status unter
                  der falschen Überschrift stand. Dokumente und Fakten sind
                  außerdem dieselbe Liste — sie werden hier zu einer Reihe
                  zusammengelegt, statt zweimal durch dasselbe `tbody` zu laufen.
                */}
                <ResponsiveTable
                  caption={`Brain-Einträge in ${world.name}`}
                  rowKey={(entry) => `${entry.kind}-${entry.id}`}
                  rows={[
                    ...documents.slice(0, 5).map((doc) => ({
                      id: doc.id,
                      kind: "Dokument" as const,
                      title: doc.title,
                      href: `/worlds/${world.slug}/brain/${doc.id}`,
                      status: BRAIN_STATUS_LABELS[doc.status],
                    })),
                    ...facts.slice(0, 5).map((fact) => ({
                      id: fact.id,
                      kind: "Fakt" as const,
                      title: fact.title,
                      href: `/worlds/${world.slug}/brain/facts/${fact.id}`,
                      status: BRAIN_STATUS_LABELS[fact.status],
                    })),
                  ]}
                  columns={[
                    {
                      key: "entry",
                      label: "Eintrag",
                      primary: true,
                      render: (entry) => <Link href={entry.href}>{entry.title}</Link>,
                    },
                    { key: "kind", label: "Art", render: (entry) => entry.kind },
                    { key: "status", label: "Status", render: (entry) => entry.status },
                  ]}
                  empty={null}
                />

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
    </>
  );
}
