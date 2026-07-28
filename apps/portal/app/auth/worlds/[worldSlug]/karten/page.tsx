import Link from "next/link";
import { notFound } from "next/navigation";
import { Map as MapIcon } from "lucide-react";
import { createPrismaClient } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Kartenübersicht für Spieler — Terra im Lesemodus.
 *
 * Karten sind vollständig spielersichtbar (Owner-Entscheid 2026-07-21,
 * unverändert übernommen) — der Zugriff hängt allein an der
 * Weltmitgliedschaft, nie an der einzelnen Karte.
 */
export default async function PortalTerraIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) notFound();

  const terra = createTerraService(createPrismaClient());
  const karten = await terra.listeFuerWelt(worldSlug);

  return (
    <div className="space-y-4">
      <PageHeader title="Karten" summary="Die Welt als Karte — zum Ansehen und Erkunden." />
      {karten.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="terra-portal-leer">
          Für diese Welt gibt es noch keine Karte.
        </p>
      ) : (
        <ul className="space-y-0.5" data-testid="terra-portal-liste">
          {karten.map((karte) => (
            <li key={karte.id}>
              <Link
                href={`/auth/worlds/${worldSlug}/karten/${karte.id}`}
                className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
              >
                <MapIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 font-medium">{karte.titel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
