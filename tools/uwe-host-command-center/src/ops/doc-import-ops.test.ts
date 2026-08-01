import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { readImportFiles } from "./doc-import-ops";

/**
 * Der Dateileser ist der Teil, den es nur im Command Center gibt: im Browser
 * wählt jemand Dateien aus, hier kommt ein Pfad auf dem Host. Alles danach ist
 * dieselbe Maschinerie wie im Studio und dort schon geprüft.
 */
describe("readImportFiles", () => {
  let root = "";

  before(async () => {
    root = await mkdtemp(path.join(tmpdir(), "uwe-import-"));

    await writeFile(path.join(root, "pellar.md"), "# Pellar\n\nText.", "utf8");
    await writeFile(path.join(root, "notiz.txt"), "Nur Text.", "utf8");
    await writeFile(path.join(root, "bild.png"), "kein Markdown", "utf8");
    await writeFile(path.join(root, "leer.md"), "   \n  ", "utf8");

    await mkdir(path.join(root, "nsc"), { recursive: true });
    await writeFile(path.join(root, "nsc", "xarza.md"), "# Xarza\n\nText.", "utf8");

    // Vault-Interna: dürfen nicht mitkommen.
    await mkdir(path.join(root, ".obsidian"), { recursive: true });
    await writeFile(path.join(root, ".obsidian", "workspace.md"), "# Intern", "utf8");
  });

  after(() => {
    root = "";
  });

  it("reads markdown and text from a folder, including sub-folders", async () => {
    const files = await readImportFiles(root);

    assert.deepEqual(
      files.map((file) => file.fileName).sort(),
      ["notiz.txt", "nsc/xarza.md", "pellar.md"],
    );
  });

  it("skips hidden folders like .obsidian", async () => {
    const files = await readImportFiles(root);
    assert.ok(!files.some((file) => file.fileName.includes(".obsidian")));
  });

  it("skips non-markdown files and empty ones", async () => {
    const files = await readImportFiles(root);
    assert.ok(!files.some((file) => file.fileName.endsWith(".png")));
    assert.ok(!files.some((file) => file.fileName === "leer.md"));
  });

  it("uses the folder-relative path as the file name", async () => {
    const files = await readImportFiles(root);
    const nested = files.find((file) => file.fileName.startsWith("nsc/"));

    assert.equal(nested?.fileName, "nsc/xarza.md");
    assert.ok(nested?.content.includes("Xarza"));
  });

  it("accepts a single file", async () => {
    const files = await readImportFiles(path.join(root, "pellar.md"));

    assert.equal(files.length, 1);
    assert.equal(files[0]?.fileName, "pellar.md");
  });

  it("refuses a single file that is not markdown", async () => {
    await assert.rejects(() => readImportFiles(path.join(root, "bild.png")), /Markdown/);
  });

  it("says so when the path does not exist", async () => {
    await assert.rejects(
      () => readImportFiles(path.join(root, "gibt-es-nicht")),
      /nicht gefunden/,
    );
  });

  it("says so when a folder holds no markdown at all", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "uwe-import-leer-"));
    await assert.rejects(() => readImportFiles(empty), /Keine Markdown-Dateien/);
  });
});
