import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entityToCreatePageInput } from "./page-mapper";

describe("entityToCreatePageInput", () => {
  it("maps type, tags and provenance", () => {
    const input = entityToCreatePageInput(
      {
        kind: "quest",
        title: "Der verlorene Schlüssel",
        summary: "Suche im Nordturm",
        body: "## Auftrag\nFinde den Schlüssel.",
        tags: ["Nordturm", "Schlüssel"],
      },
      {
        worldId: "world-1",
        campaignId: "campaign-1",
        slug: "der-verlorene-schluessel",
        importJobId: "job-1",
        sourceFile: "abenteuer.pdf",
      },
    );

    assert.equal(input.type, "quest");
    assert.deepEqual(input.tags, ["Nordturm", "Schlüssel"]);
    assert.deepEqual(input.contentBlocks?.[0]?.metadata, {
      source: "pdf-campaign-import",
      importJobId: "job-1",
      sourceFile: "abenteuer.pdf",
      // Ohne eigene Angabe steht der Dateiname für den Band, und der Import
      // gilt als eigenes Material.
      sourceTitle: "abenteuer.pdf",
      licence: "own",
      extractedKind: "quest",
      aiRoute: "local_rtx",
    });
  });

  it("records a third-party band by name", () => {
    const input = entityToCreatePageInput(
      { kind: "npc", title: "Die Kesselhexe", body: "Rührt." },
      {
        worldId: "world-1",
        campaignId: "campaign-1",
        slug: "die-kesselhexe",
        importJobId: "job-2",
        sourceFile: "obojima.pdf",
        sourceTitle: "Obojima — Tales from the Tall Grass",
        licence: "third_party",
      },
    );

    const metadata = input.contentBlocks?.[0]?.metadata as Record<string, unknown>;
    assert.equal(metadata.licence, "third_party");
    assert.equal(metadata.sourceTitle, "Obojima — Tales from the Tall Grass");
  });

  it("falls back to lore for an unknown runtime kind", () => {
    const input = entityToCreatePageInput(
      { kind: "unknown" as never, title: "Fund", body: "Unklar" },
      {
        worldId: "w",
        campaignId: "c",
        slug: "fund",
        importJobId: "j",
        sourceFile: "f.pdf",
      },
    );

    assert.equal(input.type, "lore");
  });
});
