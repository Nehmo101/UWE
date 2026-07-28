"use client";

import { useCallback, useState } from "react";
import { starteBrainLauf, TERRA_PROMPT_MAX } from "./brain-lauf";

/**
 * „Texte zur Karte" — die beiden überlebenden Kartentext-Aktionen des Brain.
 *
 * Herkunft: `atlas_name_regions` und `atlas_describe_region` waren die einzigen
 * beiden der vier Atlas-Brain-Aktionen, deren Vertrag nie eine Atlas-Tabelle
 * berührt hat — sie schlagen Namen vor und schreiben eine Beschreibung, beides
 * reine Prosa. Mit dem Atlas ist ihre Oberfläche verschwunden
 * (`Atlas3DDescribePanel.tsx`), die Aktionen selbst blieben ohne Aufrufer
 * zurück. Hier bekommen sie eine, unter ihrem heutigen Namen.
 *
 * Warum ein freies Textfeld und kein Auslesen der Karte: Die Brücke in den
 * Frame kennt drei Nachrichten (`karte-laden`, `karte-geaendert`,
 * `welt-vorgabe`) — keine liefert eine Liste der Regionen heraus. Ein Panel,
 * das so tut, als kenne es die Karte, wäre eine Lüge; eines, in das der
 * Spielleiter schreibt, was er benannt haben will, ist ehrlich und tut genau
 * das, was die Aktion kann. Den Kampagnen-Kontext (Wiki, Brain) legt die
 * Brain-Aktion selbst dazu.
 *
 * Übernommen wird nichts automatisch: das Ergebnis steht als Text da und wird
 * von Hand kopiert. Der Lauf liegt vollständig im KI-Protokoll der Welt.
 */

const AKTIONEN = [
  {
    id: "terra_name_regions",
    label: "Namen vorschlagen",
    platzhalter:
      "Wald im Norden, Gebirgszug entlang der Ostgrenze, drei Fischerdörfer an der Bucht, ein Fluss vom Gebirge zum Meer",
  },
  {
    id: "terra_describe_region",
    label: "Region beschreiben",
    platzhalter:
      "Die Bucht im Südwesten: Steilküste, Nebel am Morgen, das größte der Fischerdörfer liegt hier",
  },
] as const;

type AktionsId = (typeof AKTIONEN)[number]["id"];
type Lage = "ruhe" | "laeuft" | "fertig" | "fehler";

export interface TerraTextPanelProps {
  worldSlug: string;
}

export function TerraTextPanel({ worldSlug }: TerraTextPanelProps) {
  const [aktion, setAktion] = useState<AktionsId>("terra_name_regions");
  const [prompt, setPrompt] = useState("");
  const [lage, setLage] = useState<Lage>("ruhe");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [laufId, setLaufId] = useState<string | null>(null);

  const gewaehlt = AKTIONEN.find((eintrag) => eintrag.id === aktion) ?? AKTIONEN[0];

  const holen = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;
    setLage("laeuft");
    setMeldung(null);
    setErgebnis(null);
    setLaufId(null);

    const lauf = await starteBrainLauf({ actionId: aktion, worldSlug, userPrompt: text });
    if (!lauf.ok || !lauf.inhalt) {
      setLage("fehler");
      setMeldung(lauf.meldung ?? "Der Lauf ist fehlgeschlagen.");
      return;
    }
    setErgebnis(lauf.inhalt);
    setLaufId(lauf.laufId);
    setLage("fertig");
  }, [aktion, prompt, worldSlug]);

  return (
    <section className="terra-entwurf" aria-label="Texte zur Karte">
      <div className="terra-entwurf-zeile">
        <label>
          Aktion
          <select
            className="h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-2 text-sm text-foreground"
            value={aktion}
            onChange={(e) => setAktion(e.target.value as AktionsId)}
            disabled={lage === "laeuft"}
            data-testid="terra-text-aktion"
          >
            {AKTIONEN.map((eintrag) => (
              <option key={eintrag.id} value={eintrag.id}>
                {eintrag.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="terra-entwurf-feld">
        <span>Was steht auf der Karte?</span>
        <textarea
          value={prompt}
          maxLength={TERRA_PROMPT_MAX}
          rows={3}
          placeholder={gewaehlt.platzhalter}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={lage === "laeuft"}
          data-testid="terra-text-prompt"
        />
      </label>

      <button
        type="button"
        onClick={() => void holen()}
        disabled={!prompt.trim() || lage === "laeuft"}
        data-testid="terra-text-holen"
      >
        {lage === "laeuft" ? "fragt das Modell …" : gewaehlt.label}
      </button>

      {meldung && (
        <p className="terra-entwurf-meldung" role="status" data-testid="terra-text-meldung">
          {meldung}
        </p>
      )}

      {ergebnis && (
        <div className="terra-entwurf-vorschau" data-testid="terra-text-ergebnis">
          <p className="terra-entwurf-hinweis">
            Vorschlag, kein Kanon. Nichts davon steht in der Karte oder im Wiki — von Hand
            übernehmen, was taugt.
          </p>
          <pre className="terra-text-ausgabe">{ergebnis}</pre>
          {laufId && (
            <p className="terra-entwurf-hinweis">
              Lauf <code>{laufId}</code> steht im KI-Protokoll der Welt.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
