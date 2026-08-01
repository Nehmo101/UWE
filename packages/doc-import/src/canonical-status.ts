/**
 * Kanon-Status aus deutschen Wörtern und aus den Rautenmarkern.
 *
 * Zwei Quellen, in dieser Reihenfolge:
 *
 * 1. `status: kanon` im Frontmatter — eine ausdrückliche Angabe gewinnt immer.
 * 2. Die Marker aus dem Terra-Weltkanon, die dort im Überschriftentext stehen:
 *
 *        ◆  Kanon. Von Lasse festgelegt. Nicht ohne Ansage ändern.
 *        ◇  Vorschlag. Jederzeit vetobar — solange nicht abgesegnet, nur Angebot.
 *
 * Der zweite Punkt ist der Grund, warum dieses Modul existiert: die Marker sind
 * kein Schmuck, sondern ein Zustand, den UWE mit `CanonicalStatus` bereits
 * abbilden kann. `## 4.3 Vel-Sharaun ◆ (RETCON)` soll als Kanon ankommen, nicht
 * als Entwurf mit einem Sonderzeichen im Titel.
 */

import type { CanonicalStatus } from "@uwe/database/server";
import type { CanonMarker } from "./types";
import { normalizeFrontmatterKey } from "./frontmatter";

const CANON_MARKER = "◆"; // ◆
const PROPOSAL_MARKER = "◇"; // ◇

const STATUS_ALIASES: Record<string, CanonicalStatus> = {
  // canon
  kanon: "canon",
  kanonisch: "canon",
  canon: "canon",
  festgelegt: "canon",
  fest: "canon",

  // draft
  entwurf: "draft",
  draft: "draft",
  roh: "draft",
  wip: "draft",

  // idea
  idee: "idea",
  idea: "idea",
  vorschlag: "idea",
  proposal: "idea",
  angebot: "idea",

  // prepared
  vorbereitet: "prepared",
  prepared: "prepared",

  // played
  gespielt: "played",
  played: "played",

  // deprecated
  veraltet: "deprecated",
  ueberholt: "deprecated",
  deprecated: "deprecated",

  // contradictory
  widerspruechlich: "contradictory",
  widerspruch: "contradictory",
  contradictory: "contradictory",
  konflikt: "contradictory",

  // non_canon
  "nicht-kanon": "non_canon",
  "non-canon": "non_canon",
  "kein-kanon": "non_canon",
  apokryph: "non_canon",

  // discarded
  verworfen: "discarded",
  discarded: "discarded",
  gestrichen: "discarded",
};

/** Übersetzt `status: kanon` in einen `CanonicalStatus`, oder `null` bei Unbekanntem. */
export function resolveCanonicalStatus(raw: string | undefined): CanonicalStatus | null {
  if (!raw?.trim()) return null;
  return STATUS_ALIASES[normalizeFrontmatterKey(raw)] ?? null;
}

/** Der `CanonicalStatus`, den ein Marker bedeutet. */
export function markerToCanonicalStatus(marker: CanonMarker): CanonicalStatus {
  return marker === "canon" ? "canon" : "idea";
}

export interface StrippedTitle {
  title: string;
  marker: CanonMarker | null;
}

/**
 * Nimmt ◆/◇ aus einem Überschriftentext heraus und meldet, was dort stand.
 *
 * Stehen beide Marker in einer Zeile, gewinnt ◇ — ein Abschnitt, in dem noch
 * etwas zur Abstimmung steht, ist nicht abgesegnet. Die Nummerierung („4.3")
 * bleibt bewusst im Titel: Lasses Dokumente verweisen untereinander über genau
 * diese Nummern („himmelsrouten 7.4"), also sind sie Teil des Namens.
 */
export function stripCanonMarkers(rawTitle: string): StrippedTitle {
  const hasCanon = rawTitle.includes(CANON_MARKER);
  const hasProposal = rawTitle.includes(PROPOSAL_MARKER);

  const title = rawTitle
    .split(CANON_MARKER)
    .join("")
    .split(PROPOSAL_MARKER)
    .join("")
    .replace(/\s{2,}/g, " ")
    // `\s` statt `\s+`: die Zeile darüber hat jeden Weißraum-Lauf schon auf ein
    // einzelnes Zeichen zusammengezogen, `\s+` wäre also nicht nur überflüssig,
    // sondern quadratisch — es setzt über den ganzen Lauf zurück, sobald das
    // Satzzeichen dahinter fehlt, und das an jeder Startstelle erneut.
    .replace(/\s([),.:;])/g, "$1")
    .trim();

  const marker: CanonMarker | null = hasProposal ? "proposal" : hasCanon ? "canon" : null;

  return { title, marker };
}

/** Enthält der Text einen Kanon-Marker? Für Fließtext-Abschnitte ohne eigene Überschrift. */
export function detectCanonMarker(text: string): CanonMarker | null {
  if (text.includes(PROPOSAL_MARKER)) return "proposal";
  if (text.includes(CANON_MARKER)) return "canon";
  return null;
}
