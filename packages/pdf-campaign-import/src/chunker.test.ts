import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkPdfText, MAX_CHUNK_CHARS, MAX_CHUNKS } from "./chunker";

describe("chunkPdfText", () => {
  it("splits long text on paragraph boundaries within the size cap", () => {
    const paragraph = "a".repeat(3_500);
    const chunks = chunkPdfText(paragraph + "\n\n" + paragraph + "\n\n" + paragraph);

    assert.equal(chunks.length, 3);
    assert.ok(chunks.every((chunk) => chunk.length <= MAX_CHUNK_CHARS));
  });

  it("hard-splits an oversized paragraph", () => {
    const chunks = chunkPdfText("x".repeat(MAX_CHUNK_CHARS * 2 + 25));

    assert.deepEqual(
      chunks.map((chunk) => chunk.length),
      [MAX_CHUNK_CHARS, MAX_CHUNK_CHARS, 25],
    );
  });

  it("caps the number of chunks", () => {
    const chunks = chunkPdfText("z".repeat(MAX_CHUNK_CHARS * (MAX_CHUNKS + 2)));

    assert.equal(chunks.length, MAX_CHUNKS);
    assert.ok(chunks.every((chunk) => chunk.length <= MAX_CHUNK_CHARS));
  });
});
