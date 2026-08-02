import assert from "node:assert/strict";
import test from "node:test";
import { parseWikiLinks, type ParsedWikiLink } from "./wikilink-utils";

/**
 * Die Fassung, die hier abgelöst wurde. Sie steht als Maßstab im Test, nicht
 * mehr im Produktionscode: quadratisch bei vielen offenen `[[`, aber für kurze
 * Eingaben Zeichen für Zeichen die Wahrheit, gegen die der Scanner antritt.
 *
 * Die Offsets reisen weiter — Renderer, Graph und Backlinks rechnen mit ihnen —
 * deshalb wird nicht „ungefähr dasselbe" verglichen, sondern das ganze Ergebnis.
 */
function parseWithLegacyRegex(text: string): ParsedWikiLink[] {
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: ParsedWikiLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    links.push({
      target: match[1].trim(),
      label: match[2]?.trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return links;
}

function assertSameAsLegacy(text: string): void {
  assert.deepEqual(
    parseWikiLinks(text),
    parseWithLegacyRegex(text),
    `abweichendes Ergebnis für ${JSON.stringify(text)}`,
  );
}

test("liest Ziel, Beschriftung und Offsets", () => {
  assert.deepEqual(parseWikiLinks("Weg nach [[Zielort]]."), [
    { target: "Zielort", label: undefined, start: 9, end: 20 },
  ]);
  assert.deepEqual(parseWikiLinks("[[Zielort|das Dorf]]"), [
    { target: "Zielort", label: "das Dorf", start: 0, end: 20 },
  ]);
});

test("trimmt Ziel und Beschriftung, behält aber die rohen Offsets", () => {
  assert.deepEqual(parseWikiLinks("[[  Zielort  |  das Dorf  ]]"), [
    { target: "Zielort", label: "das Dorf", start: 0, end: 28 },
  ]);
});

test("findet mehrere Links in Dokumentreihenfolge", () => {
  const links = parseWikiLinks("[[A]] und [[B|bee]] und [[C]]");
  assert.deepEqual(
    links.map((link) => [link.target, link.label, link.start]),
    [
      ["A", undefined, 0],
      ["B", "bee", 10],
      ["C", undefined, 24],
    ],
  );
});

test("erlaubt Pipes in der Beschriftung, aber kein leeres Ziel", () => {
  assert.equal(parseWikiLinks("[[A|b|c]]")[0].label, "b|c");
  assert.deepEqual(parseWikiLinks("[[|nur Label]]"), []);
  assert.deepEqual(parseWikiLinks("[[A|]]"), []);
  assert.deepEqual(parseWikiLinks("[[]]"), []);
});

test("bricht an einer eckigen Klammer im Inneren ab", () => {
  assert.deepEqual(parseWikiLinks("[[A]b]]"), []);
  assert.deepEqual(parseWikiLinks("[[A|b]x]]"), []);
});

test("nimmt bei geschachtelten Klammern den äußeren Treffer", () => {
  // Das Ziel darf `[` enthalten — nur `]` und `|` beenden es.
  assert.deepEqual(parseWikiLinks("[[x[[y]]"), [
    { target: "x[[y", label: undefined, start: 0, end: 8 },
  ]);
});

test("verhält sich in allen Randfällen wie die abgelöste Regex", () => {
  const cases = [
    "",
    "kein Link",
    "[",
    "[[",
    "]]",
    "[[]]",
    "[[|]]",
    "[[A]]",
    "[[A]]]",
    "[[[A]]",
    "[[[[A]]]]",
    "[[A]][[B]]",
    "[[A]] [[B",
    "[[A|B]]",
    "[[A||B]]",
    "[[A|B|C]]",
    "[[A|B]]C]]",
    "[[A\nB]]",
    "text [[A]] text [[B|c]] text",
    "[[x[[y]]",
    "[[x[[y]z]]",
    "[[A] ]]",
    "|[[A]]|",
    "[[ ]]",
    "[[\t]]",
  ];

  for (const text of cases) {
    assertSameAsLegacy(text);
  }
});

test("verhält sich auch auf erzeugten Eingaben wie die abgelöste Regex", () => {
  // Deterministisch erzeugt, damit ein Fehlschlag reproduzierbar bleibt.
  const alphabet = ["[", "]", "|", "a", " ", "\n"];
  let seed = 20260802;
  const nextIndex = (bound: number) => {
    // xorshift32 — genug Streuung für einen Zufallstest ohne Abhängigkeit.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed |= 0;
    return Math.abs(seed) % bound;
  };

  for (let round = 0; round < 3000; round += 1) {
    const length = 1 + nextIndex(24);
    let text = "";
    for (let i = 0; i < length; i += 1) {
      text += alphabet[nextIndex(alphabet.length)];
    }
    assertSameAsLegacy(text);
  }
});

test("bleibt auf vielen offenen Klammern linear", () => {
  // Die Eingabe, wegen der die Regel „Polynomial regular expression used on
  // uncontrolled data" überhaupt greift: lauter `[[`, nie geschlossen.
  const hostile = "[".repeat(200_000);

  const started = process.hrtime.bigint();
  assert.deepEqual(parseWikiLinks(hostile), []);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  // Großzügig bemessen; die quadratische Fassung braucht hier Minuten.
  assert.ok(elapsedMs < 1000, `parseWikiLinks brauchte ${elapsedMs.toFixed(0)} ms`);
});

test("bleibt auch bei vielen offenen Klammern vor einem späten `]` linear", () => {
  const hostile = `${"[[a".repeat(60_000)}]`;

  const started = process.hrtime.bigint();
  assert.deepEqual(parseWikiLinks(hostile), []);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.ok(elapsedMs < 1000, `parseWikiLinks brauchte ${elapsedMs.toFixed(0)} ms`);
});
