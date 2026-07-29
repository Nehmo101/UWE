import { notFound } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { worldDetailBreadcrumb, type BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { TerraRahmen } from "@/src/components/terra";

interface Props {
  params: Promise<{ worldSlug: string; karteId: string }>;
}

/**
 * Der Karteneditor Terra.
 *
 * Der Ablauf: Welt laden → Mandantenprüfung → WorldShell + Breadcrumb → Frame.
 * Die Rechteprüfung liegt damit VOR dem Frame und wird von ihm nicht berührt.
 *
 * Die Mandantenprüfung steckt in `holeInWelt` — eine Karten-Id aus einer
 * fremden Welt liefert `null` und damit `notFound()`, ohne ihre Existenz zu
 * verraten.
 */
export default async function TerraKartePage({ params }: Props) {
  const { worldSlug, karteId } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const terra = createTerraService(createPrismaClient());
  const karte = await terra.holeInWelt(worldSlug, karteId);
  if (!karte) notFound();

  const breadcrumb: BreadcrumbItem[] = worldDetailBreadcrumb(
    world.name,
    worldSlug,
    "Karten",
    `/worlds/${worldSlug}/karten`,
    karte.titel,
  );

  return (
    <WorldShell worldSlug={worldSlug} worldName={world.name} breadcrumb={<BreadcrumbTrail items={breadcrumb} />}>
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">{karte.titel}</h1>
        {/* Herkunft und Zustand stehen über dem Frame, nicht darin: der
            Spielleiter soll wissen, ob er in seine eigene Karte schreibt oder
            in den Entwurf eines Spielers, BEVOR er die Maus anfasst. Die
            Abnahme selbst sitzt in der Liste — ein Knopf neben dem Editor
            würde zum Durchwinken einladen. */}
        {karte.autorName || karte.status !== "freigegeben" ? (
          <p className="text-sm text-muted-foreground" data-testid="terra-karte-herkunft">
            {karte.autorName ? `Gebaut von ${karte.autorName}. ` : ""}
            {karte.status === "eingereicht"
              ? "Eingereicht — wartet auf deine Abnahme."
              : karte.status === "entwurf"
                ? "Entwurf — noch nicht eingereicht."
                : "Abgenommen."}
          </p>
        ) : null}
        <TerraRahmen worldSlug={worldSlug} karteId={karte.id} version={karte.version} daten={karte.daten ?? null} />
      </div>
    </WorldShell>
  );
}
