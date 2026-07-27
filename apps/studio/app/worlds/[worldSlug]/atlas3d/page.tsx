import { notFound } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { worldSectionBreadcrumb, type BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { TerraKartenListe } from "@/src/components/terra";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Kartenübersicht der Welt. Seit J1 liegt hier Terra statt Atlas 3D — der
 * PFAD bleibt, der Inhalt wechselt (Owner-Entscheid 27.07.2026: Terra löst
 * Atlas ab, alte Atlas-Welten werden verworfen, nicht migriert).
 *
 * Anders als Atlas legt der Aufruf dieser Seite NICHTS an. Atlas' Indexseite
 * rief `getOrCreateForWorld` und leitete weiter; dadurch entstanden
 * Karten-Zeilen allein durchs Hinsehen. Hier ist der GET folgenlos.
 */
export default async function TerraKartenIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const terra = createTerraService(createPrismaClient());
  const karten = await terra.listeFuerWelt(worldSlug);

  const breadcrumb: BreadcrumbItem[] = worldSectionBreadcrumb(world.name, worldSlug, "Karten");

  return (
    <WorldShell worldSlug={worldSlug} worldName={world.name} breadcrumb={<BreadcrumbTrail items={breadcrumb} />}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Karten</h1>
        <p className="text-sm text-muted-foreground">
          Der Karteneditor Terra. Jede Karte trägt ihre Unterkarten in sich — eine Datei, ein Baum.
        </p>
        <TerraKartenListe
          worldSlug={worldSlug}
          karten={karten.map((karte) => ({
            id: karte.id,
            titel: karte.titel,
            version: karte.version,
            updatedAt: karte.updatedAt.toLocaleDateString("de-DE"),
          }))}
        />
      </div>
    </WorldShell>
  );
}
