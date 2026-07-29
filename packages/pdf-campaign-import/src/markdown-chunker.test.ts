import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CHUNKS, MAX_CHUNK_CHARS, chunkPdfText } from "./chunker";
import {
  chunkCampaignText,
  chunkMarkdownBySections,
  hasMarkdownStructure,
  splitMarkdownSections,
} from "./markdown-chunker";

test("hält Überschrift und zugehörigen Text zusammen", () => {
  const markdown = [
    "# Die Taverne zum Raben",
    "Ein verrauchter Schankraum.",
    "",
    "## Wirt Halgar",
    "Halgar ist misstrauisch.",
  ].join("\n");

  const sections = splitMarkdownSections(markdown);
  assert.equal(sections.length, 2);
  assert.equal(sections[0]?.level, 1);
  assert.ok(sections[0]?.text.includes("verrauchter Schankraum"));
  assert.equal(sections[1]?.level, 2);
  assert.ok(sections[1]?.text.includes("misstrauisch"));
});

test("Text vor der ersten Überschrift geht nicht verloren", () => {
  const sections = splitMarkdownSections("Vorspann ohne Überschrift.\n\n# Kapitel");

  assert.equal(sections[0]?.level, 0);
  assert.ok(sections[0]?.text.includes("Vorspann"));
});

test("bündelt kurze Abschnitte in einen Chunk", () => {
  const markdown = ["# A", "kurz", "## B", "auch kurz", "## C", "ebenfalls"].join("\n");

  assert.deepEqual(chunkMarkdownBySections(markdown), [
    "# A\nkurz\n\n## B\nauch kurz\n\n## C\nebenfalls",
  ]);
});

test("überlange Abschnitte werden geteilt, statt das Limit zu sprengen", () => {
  const long = "Wort ".repeat(MAX_CHUNK_CHARS);
  const chunks = chunkMarkdownBySections(`# Riesenkapitel\n${long}`);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= MAX_CHUNK_CHARS, `Chunk zu groß: ${chunk.length}`);
  }
});

test("respektiert MAX_CHUNKS", () => {
  const sections = Array.from(
    { length: MAX_CHUNKS + 50 },
    (_section, index) => `# Kapitel ${index}\n` + "x".repeat(MAX_CHUNK_CHARS - 100),
  ).join("\n");

  assert.ok(chunkMarkdownBySections(sections).length <= MAX_CHUNKS);
});

test("erkennt strukturlosen Text und fällt auf den Absatz-Schnitt zurück", () => {
  const flat = "Ein Absatz ohne jede Überschrift.\n\nUnd noch einer.";

  assert.equal(hasMarkdownStructure(flat), false);
  // Kurze Absätze bündelt chunkPdfText bewusst in einen Chunk — hier zählt nur,
  // dass der Fallback greift und nichts verloren geht.
  assert.deepEqual(chunkCampaignText(flat), [chunkPdfText(flat)[0]]);
  assert.ok(chunkCampaignText(flat)[0]?.includes("Und noch einer."));
});

test("nutzt bei strukturiertem Markdown den Überschriften-Schnitt", () => {
  const markdown = ["# Erstes", "a".repeat(MAX_CHUNK_CHARS - 20), "# Zweites", "b"].join("\n");
  const chunks = chunkCampaignText(markdown);

  assert.equal(hasMarkdownStructure(markdown), true);
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0]?.startsWith("# Erstes"));
  assert.ok(chunks[1]?.startsWith("# Zweites"));
});

test("eine Raute ohne Text ist keine Überschrift", () => {
  assert.equal(hasMarkdownStructure("#\n#### \nnur Text"), false);
});
