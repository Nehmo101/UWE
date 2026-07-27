import { notFound } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { worldDetailBreadcrumb, type BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { TerraRahmen } from "@/src/components/terra";

interface Props {
  params: Promise<{ worldSlug: string; nodeId: string }>;
}

/**
 * Der Karteneditor. Seit J1 rendert dieser Pfad Terra statt Atlas 3D.
 *
 * Der Aufbau ist bewusst derselbe wie bei Atlas — nur der letzte Schritt
 * wechselt: Welt laden → Mandantenprüfung → WorldShell + Breadcrumb → Frame.
 * Die Rechteprüfung liegt damit VOR dem Frame und wird von ihm nicht berührt.
 *
 * `nodeId` heißt aus Pfadgründen weiter so; es ist die Id einer `TerraKarte`.
 * Die Mandantenprüfung steckt in `holeInWelt` — eine Karten-Id aus einer
 * fremden Welt liefert `null` und damit `notFound()`, ohne ihre Existenz zu
 * verraten.
 */
export default async function TerraKartePage({ params }: Props) {
  const { worldSlug, nodeId } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const terra = createTerraService(createPrismaClient());
  const karte = await terra.holeInWelt(worldSlug, nodeId);
  if (!karte) notFound();

  const breadcrumb: BreadcrumbItem[] = worldDetailBreadcrumb(
    world.name,
    worldSlug,
    "Karten",
    `/worlds/${worldSlug}/atlas3d`,
    karte.titel,
  );

  return (
    <WorldShell worldSlug={worldSlug} worldName={world.name} breadcrumb={<BreadcrumbTrail items={breadcrumb} />}>
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">{karte.titel}</h1>
        <TerraRahmen worldSlug={worldSlug} karteId={karte.id} version={karte.version} daten={karte.daten ?? null} />
      </div>
    </WorldShell>
  );
}
