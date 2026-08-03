import { notFound } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { ortQuellenAusSeiten } from "@uwe/ai-brain/terra";
import { ShellBreadcrumb } from "@/src/components/shell";
import { worldDetailBreadcrumb, type BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { TerraRahmen } from "@/src/components/terra";

interface Props {
  params: Promise<{ worldSlug: string; karteId: string }>;
  searchParams?: Promise<{ terraFenster?: string | string[] }>;
}

/**
 * Der Karteneditor Terra. Auch die Pop-out-Ansicht läuft über diese geschützte
 * Route: Welt-, Karten- und Mandantenprüfung geschehen daher vor jedem Frame.
 */
export default async function TerraKartePage({ params, searchParams }: Props) {
  const [{ worldSlug, karteId }, suche] = await Promise.all([params, searchParams ?? Promise.resolve<{ terraFenster?: string | string[] }>({})]);
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const terra = createTerraService(createPrismaClient());
  const karte = await terra.holeInWelt(worldSlug, karteId);
  if (!karte) notFound();

  const fensterModus = suche.terraFenster === "1";

  /* Die Ort-Wikis der Welt als Grundlage der KI-Vorgenerierung. Nur Köpfe
     (Titel, Typ, Zusammenfassung, Schlagworte) — der Inhalt einer Seite geht
     erst dann mit, wenn eine gewählt ist, und dann über den Kontextbau der
     Brain-Aktion, nicht über diese Seite. Im Fenstermodus gibt es kein
     Bedienfeld, also auch keine Abfrage. */
  const orte = fensterModus
    ? []
    : ortQuellenAusSeiten(await getAppRepository().listPagesByWorld(worldSlug, { navCategory: "orte" }));

  const editor = (
    <TerraRahmen
      // Ohne diesen Key behält React beim Wechsel zu einer anderen Karte
      // (gleiche Position im Baum, gleicher Komponententyp) den iframe-Knoten
      // bei — er lädt nie neu, und Terra schickt "terra-bereit" nur einmal
      // pro Sitzung. Ergebnis: man landet immer in der zuerst geladenen Karte.
      key={karte.id}
      worldSlug={worldSlug}
      karteId={karte.id}
      version={karte.version}
      daten={karte.daten ?? null}
      fensterModus={fensterModus}
      orte={orte}
    />
  );

  // Kein zweiter, schwächer geschützter Endpunkt: nur eine schlanke Darstellung
  // derselben Route. KI- und Textpanels lässt TerraRahmen im Fenstermodus weg.
  if (fensterModus) {
    return (
      <main className="terra-fenster-seite" aria-label={`Terra Karteneditor — ${karte.titel}`}>
        {editor}
      </main>
    );
  }

  const breadcrumb: BreadcrumbItem[] = worldDetailBreadcrumb(
    world.name,
    worldSlug,
    "Karten",
    `/worlds/${worldSlug}/karten`,
    karte.titel,
  );

  return (
    <>
      <ShellBreadcrumb items={breadcrumb} />
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">{karte.titel}</h1>
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
        {editor}
      </div>
    </>
  );
}