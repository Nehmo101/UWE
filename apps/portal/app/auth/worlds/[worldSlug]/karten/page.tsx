import Link from "next/link";
import { notFound } from "next/navigation";
import { Map as MapIcon, PencilLine, Hourglass } from "lucide-react";
import { createPrismaClient } from "@uwe/database/server";
import { createTerraService, type TerraKarteKopf } from "@uwe/database/terra";
import { canCreateTerraKarte } from "@uwe/auth";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/shell";
import { erstelleSpielerKarteAction } from "@/app/terra-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Kartenübersicht für Spieler.
 *
 * Zwei Abschnitte, weil es seit J5 zwei Sorten Karte gibt:
 *
 *   KARTEN DER WELT — abgenommen, für alle Weltmitglieder lesbar. Der Zugriff
 *   hängt allein an der Weltmitgliedschaft, nie an der einzelnen Karte
 *   (Owner-Entscheid 2026-07-21, unverändert übernommen).
 *
 *   MEINE ENTWÜRFE — was der angemeldete Spieler selbst gebaut hat und noch
 *   nicht abgenommen ist. Fremde Entwürfe stehen hier nicht: sie sind nicht
 *   geheim, sie sind nur noch nicht geprüft.
 *
 * Die Trennung macht der Service (`listeFuerSpieler`), nicht diese Seite —
 * eine Liste, die erst alles holt und dann filtert, verliert die Grenze beim
 * nächsten Umbau.
 */
export default async function PortalTerraIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) notFound();

  const terra = createTerraService(createPrismaClient());
  const karten = await terra.listeFuerSpieler(worldSlug, ctx.user?.id ?? null);

  const freigegeben = karten.filter((karte) => karte.status === "freigegeben");
  const eigene = karten.filter((karte) => karte.status !== "freigegeben");
  const darfBauen = canCreateTerraKarte(ctx);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Karten"
        summary="Die Welt als Karte — zum Ansehen, Erkunden und selbst Bauen."
      />

      {darfBauen ? (
        <form action={erstelleSpielerKarteAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input
            type="text"
            name="titel"
            maxLength={120}
            placeholder="Titel der neuen Karte"
            aria-label="Titel der neuen Karte"
            className="h-9 min-w-0 flex-1 rounded-[var(--radius)] border border-border bg-background px-3 text-sm"
          />
          <button
            type="submit"
            className="h-9 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-primary"
            data-testid="terra-portal-karte-anlegen"
          >
            Neue Karte bauen
          </button>
        </form>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Karten der Welt</h2>
        {freigegeben.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="terra-portal-leer">
            Für diese Welt gibt es noch keine abgenommene Karte.
          </p>
        ) : (
          <ul className="space-y-0.5" data-testid="terra-portal-liste">
            {freigegeben.map((karte) => (
              <KartenZeile key={karte.id} worldSlug={worldSlug} karte={karte} />
            ))}
          </ul>
        )}
      </section>

      {eigene.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">Meine Entwürfe</h2>
          <p className="text-xs text-muted-foreground">
            Nur du siehst sie. Wenn du fertig bist, reichst du sie beim Spielleiter zur Abnahme ein.
          </p>
          <ul className="space-y-0.5" data-testid="terra-portal-entwuerfe">
            {eigene.map((karte) => (
              <KartenZeile key={karte.id} worldSlug={worldSlug} karte={karte} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KartenZeile({ worldSlug, karte }: { worldSlug: string; karte: TerraKarteKopf }) {
  const Symbol =
    karte.status === "freigegeben" ? MapIcon : karte.status === "eingereicht" ? Hourglass : PencilLine;
  return (
    <li>
      <Link
        href={`/auth/worlds/${worldSlug}/karten/${karte.id}`}
        className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
      >
        <Symbol className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 font-medium">{karte.titel}</span>
        {karte.status === "entwurf" ? <span className="text-xs text-muted-foreground">Entwurf</span> : null}
        {karte.status === "eingereicht" ? (
          <span className="text-xs text-muted-foreground">wartet auf Abnahme</span>
        ) : null}
        {karte.gesperrt ? <span className="text-xs text-muted-foreground">gesperrt</span> : null}
      </Link>
    </li>
  );
}
