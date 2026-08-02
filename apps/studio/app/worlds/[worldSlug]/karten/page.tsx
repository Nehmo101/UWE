import { notFound } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { ShellBreadcrumb } from "@/src/components/shell";
import { worldSectionBreadcrumb, type BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { TerraKartenListe } from "@/src/components/terra";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Kartenübersicht der Welt — der Einstieg in den Karteneditor Terra.
 *
 * Der Aufruf dieser Seite legt NICHTS an: der GET ist folgenlos. Der Vorgänger
 * rief hier ein `getOrCreate` und leitete weiter, wodurch Karten-Zeilen allein
 * durchs Hinsehen entstanden — dieser Weg ist bewusst nicht übernommen.
 */
export default async function TerraKartenIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const terra = createTerraService(createPrismaClient());
  const karten = await terra.listeFuerWelt(worldSlug);

  const breadcrumb: BreadcrumbItem[] = worldSectionBreadcrumb(world.name, worldSlug, "Karten");

  return (
    <>
      <ShellBreadcrumb items={breadcrumb} />
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Karten</h1>
        <p className="text-sm text-muted-foreground">
          Der Karteneditor Terra. Jede Karte trägt ihre Unterkarten in sich — eine Datei, ein Baum.
          Karten, die Spieler im Portal gebaut haben, stehen hier zur Abnahme.
        </p>
        <TerraKartenListe
          worldSlug={worldSlug}
          karten={karten.map((karte) => ({
            id: karte.id,
            titel: karte.titel,
            version: karte.version,
            updatedAt: karte.updatedAt.toLocaleDateString("de-DE"),
            status: karte.status,
            autorName: karte.autorName,
            eingereichtAm: karte.eingereichtAm
              ? `eingereicht ${karte.eingereichtAm.toLocaleDateString("de-DE")}`
              : null,
          }))}
        />
      </div>
    </>
  );
}
