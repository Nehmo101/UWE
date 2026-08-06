/**
 * @uwe/character-creator — Inhalt und Regeln der Charaktererstellung.
 *
 * Das Paket kennt weder Prisma noch React. Es beschreibt, was ein Charakter
 * auf Stufe 1 werden kann (`content/`), rechnet aus einem Entwurf die Zahlen
 * (`rules/`) und sagt, was noch fehlt (`rules/steps`). Das Portal bindet das
 * an Datenbank und Oberfläche — hier liegt nichts, was einen Server braucht.
 */

export * from "./types";
export * from "./content";
export * from "./rules/abilities";
export * from "./rules/custom-background";
export * from "./rules/derive";
export * from "./rules/steps";
