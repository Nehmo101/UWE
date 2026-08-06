"use client";

/**
 * Der Wortlaut eines Talents: Voraussetzung, Vorteile, Attributspunkt.
 *
 * Steht als eigenes Modul, weil zwei Stellen denselben Text brauchen — die
 * Katalog-Kachel im Hintergrund-Schritt und die Talentwahl im Eigenbau. Wer
 * „Wachsam“ liest, weiß nichts; wer liest, was Wachsam tut, entscheidet.
 */

import { ABILITY_LABELS, type Feat } from "@uwe/character-creator";

export function FeatText({ feat }: { feat: Feat }) {
  return (
    <div className="cw-prose">
      {feat.prerequisite ? <p>Voraussetzung: {feat.prerequisite}</p> : null}
      <p>{feat.hook}</p>
      {feat.benefits.map((benefit) => (
        <p key={benefit.name}>
          <strong>{benefit.name}.</strong> {benefit.description}
        </p>
      ))}
      {feat.abilityIncrease ? (
        <p>
          Dazu ein Punkt auf eines dieser Attribute (höchstens 20):{" "}
          {feat.abilityIncrease.from.map((ability) => ABILITY_LABELS[ability]).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
