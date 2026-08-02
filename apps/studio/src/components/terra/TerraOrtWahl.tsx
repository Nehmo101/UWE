"use client";

import { useMemo } from "react";
import {
  TERRA_ORT_SEITENTYPEN,
  TERRA_ORT_TYP_LABELS,
  type TerraOrtQuelle,
  type TerraOrtSeitentyp,
} from "@uwe/ai-brain/terra";

/**
 * Die Auswahl des Ort-Wikis über dem Prompt-Feld der Vorgenerierung.
 *
 * Ein Auswahlfeld, gruppiert nach Seitentyp — weit oben die Regionen, unten
 * die einzelnen Kammern. Die Reihenfolge kommt aus `ortQuellenAusSeiten`; hier
 * wird sie nur in Gruppen zerlegt, nicht neu erfunden.
 *
 * Zwei Dinge tut diese Komponente ausdrücklich nicht:
 *
 *   Sie lädt nichts nach. Die Liste kommt von der Seite (Server Component),
 *   die sie ohnehin unter den Studio-Guards holt — ein eigener Endpunkt wäre
 *   eine zweite, schwächer geschützte Tür auf dieselben Daten.
 *
 *   Sie entscheidet nicht, was mit der Wahl geschieht. Ob daraus eine Vorlage
 *   im Textfeld wird, ob der Slug an die Brain-Aktion geht — das weiß das
 *   Bedienfeld, dem sie gehört.
 *
 * Ohne Ort-Wikis bleibt eine Zeile Text stehen statt eines leeren
 * Auswahlfelds: „nichts da" ist eine Antwort, ein leeres Feld ist ein Rätsel.
 */

export interface TerraOrtWahlProps {
  orte: TerraOrtQuelle[];
  /** Slug des gewählten Ortes, oder "" für „ohne Wiki-Seite". */
  gewaehlt: string;
  onWahl: (slug: string) => void;
  disabled?: boolean;
}

export function TerraOrtWahl({ orte, gewaehlt, onWahl, disabled }: TerraOrtWahlProps) {
  const gruppen = useMemo(() => {
    const nachTyp = new Map<TerraOrtSeitentyp, TerraOrtQuelle[]>();
    for (const ort of orte) {
      const bisher = nachTyp.get(ort.typ);
      if (bisher) bisher.push(ort);
      else nachTyp.set(ort.typ, [ort]);
    }
    return TERRA_ORT_SEITENTYPEN.filter((typ) => nachTyp.has(typ)).map((typ) => ({
      typ,
      label: TERRA_ORT_TYP_LABELS[typ],
      eintraege: nachTyp.get(typ) ?? [],
    }));
  }, [orte]);

  if (orte.length === 0) {
    return (
      <p className="terra-entwurf-hinweis" data-testid="terra-ort-leer">
        Diese Welt hat noch keine Ort-Wikis. Die Karte lässt sich frei beschreiben.
      </p>
    );
  }

  return (
    <label className="terra-entwurf-ortwahl">
      <span>Ort aus dem Wiki</span>
      <select
        className="h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-2 text-sm text-foreground"
        value={gewaehlt}
        disabled={disabled}
        onChange={(e) => onWahl(e.target.value)}
        data-testid="terra-ort-wahl"
      >
        <option value="">— ohne Wiki-Seite —</option>
        {gruppen.map((gruppe) => (
          <optgroup key={gruppe.typ} label={gruppe.label}>
            {gruppe.eintraege.map((ort) => (
              <option key={ort.slug} value={ort.slug}>
                {ort.titel}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
