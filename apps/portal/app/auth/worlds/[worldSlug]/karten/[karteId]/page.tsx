import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createPrismaClient } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/shell";
import { TerraLeserahmen } from "@/src/components/terra";
import { TERRA_QUELLE } from "@/src/lib/terra-quelle";

interface Props {
  params: Promise<{ worldSlug: string; karteId: string }>;
}

/**
 * Kartenansicht für Spieler — Terra, nur lesend.
 *
 * Es gibt im Portal keine Server Action zum Schreiben, und die
 * Elternkomponente nimmt gar keine Änderungsnachricht entgegen. Die
 * Einbahnstraße ist damit nicht nur Absicht, sondern strukturell: ein
 * manipulierter Frame hätte kein Ziel, an das er schreiben könnte.
 *
 * Zugriff hängt allein an der Weltmitgliedschaft, nie an der einzelnen Karte.
 */
export default async function PortalTerraKartePage({ params }: Props) {
  const { worldSlug, karteId } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) notFound();

  const terra = createTerraService(createPrismaClient());
  const karte = await terra.holeInWelt(worldSlug, karteId);
  if (!karte) notFound();

  return (
    <div className="space-y-4">
      <PageHeader title={karte.titel} summary="Karte — nur ansehen" />
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/auth/worlds/${worldSlug}/karten`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Übersicht
        </Link>
      </div>
      <TerraLeserahmen daten={karte.daten ?? null} quelle={TERRA_QUELLE} />
    </div>
  );
}
