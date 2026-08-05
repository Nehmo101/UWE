import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createPrismaClient } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { canEditTerraKarte, canWithdrawTerraKarte, canDeleteTerraKarte } from "@uwe/auth";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/shell";
import { TerraLeserahmen, TerraSpielerRahmen } from "@/src/components/terra";
import { TERRA_QUELLE } from "@/src/lib/terra-quelle";
import {
  loescheSpielerKarteAction,
  reicheSpielerKarteEinAction,
  ziehSpielerKarteZurueckAction,
} from "@/app/terra-actions";

interface Props {
  params: Promise<{ worldSlug: string; karteId: string }>;
}

/**
 * Kartenansicht für Spieler — lesend ODER bearbeitend, je nach Zustand.
 *
 * DIE ENTSCHEIDUNG FÄLLT HIER, EINMAL, AUF DEM SERVER. Es gibt keinen
 * Schalter im Browser, der aus dem Leserahmen einen Schreibrahmen macht: die
 * beiden sind verschiedene Komponenten, und nur eine von ihnen kennt
 * überhaupt eine Server Action.
 *
 * Drei Fälle:
 *   ABGENOMMEN            → `TerraLeserahmen`, wie seit J1. Für alle
 *                           Weltmitglieder, unverändert.
 *   EIGENER ENTWURF       → `TerraSpielerRahmen`, voller Editor.
 *   EIGENE EINREICHUNG    → Leserahmen plus „Zurückziehen". Die Karte liegt
 *                           beim Spielleiter; weiterbauen würde ihm den Stand
 *                           unter der Prüfung wegziehen.
 *
 * Fremde Entwürfe kommen hier nicht an: `holeFuerSpieler` liefert `null` und
 * die Seite ruft `notFound()` — dieselbe Antwort wie für eine Karte aus einer
 * fremden Welt, damit nichts über ihre Existenz verraten wird.
 */
export default async function PortalTerraKartePage({ params }: Props) {
  const { worldSlug, karteId } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) notFound();

  const terra = createTerraService(createPrismaClient());
  const karte = await terra.holeFuerSpieler(worldSlug, karteId, ctx.user?.id ?? null);
  if (!karte) notFound();

  const darfBearbeiten = canEditTerraKarte(ctx, karte);
  const darfZurueckziehen = canWithdrawTerraKarte(ctx, karte);
  const darfLoeschen = canDeleteTerraKarte(ctx, karte);

  const zusammenfassung = karte.gesperrt
    ? "Vom Spielleiter gesperrt — nur ansehen."
    : karte.status === "freigegeben"
      ? "Karte — nur ansehen"
      : karte.status === "eingereicht"
        ? "Dein Entwurf liegt beim Spielleiter zur Abnahme."
        : "Dein Entwurf — bau, was du willst. Gespeichert wird automatisch.";

  return (
    <div className="space-y-4">
      <PageHeader title={karte.titel} summary={zusammenfassung} />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/auth/worlds/${worldSlug}/karten`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Übersicht
        </Link>

        {darfBearbeiten ? (
          <form action={reicheSpielerKarteEinAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="karteId" value={karte.id} />
            <button
              type="submit"
              className="h-8 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-primary"
              data-testid="terra-portal-einreichen"
            >
              Zur Abnahme einreichen
            </button>
          </form>
        ) : null}

        {darfZurueckziehen ? (
          <form action={ziehSpielerKarteZurueckAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="karteId" value={karte.id} />
            <button
              type="submit"
              className="h-8 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-primary"
              data-testid="terra-portal-zurueckziehen"
            >
              Einreichung zurückziehen
            </button>
          </form>
        ) : null}

        {darfLoeschen ? (
          <form action={loescheSpielerKarteAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="karteId" value={karte.id} />
            <button
              type="submit"
              className="h-8 rounded-[var(--radius)] px-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
              data-testid="terra-portal-loeschen"
            >
              Entwurf löschen
            </button>
          </form>
        ) : null}
      </div>

      {karte.rueckmeldung ? (
        <p
          className="rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm"
          data-testid="terra-portal-rueckmeldung"
        >
          <strong className="font-semibold">Rückmeldung des Spielleiters:</strong> {karte.rueckmeldung}
        </p>
      ) : null}

      {darfBearbeiten ? (
        <TerraSpielerRahmen
          worldSlug={worldSlug}
          karteId={karte.id}
          version={karte.version}
          daten={karte.daten ?? null}
          quelle={TERRA_QUELLE}
        />
      ) : (
        <TerraLeserahmen daten={karte.daten ?? null} quelle={TERRA_QUELLE} />
      )}
    </div>
  );
}
