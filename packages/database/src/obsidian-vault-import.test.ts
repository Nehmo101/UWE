import assert from "node:assert/strict";
import { describe, it } from "node:test";
import AdmZip from "adm-zip";
import { previewMarkdownImport } from "./import-central-service";
import {
  extractObsidianVaultMarkdown,
  isObsidianVaultMarkdownEntry,
  ObsidianVaultImportError,
} from "./obsidian-vault-import";

function buildVaultZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [entryName, content] of Object.entries(files)) {
    zip.addFile(entryName, Buffer.from(content, "utf8"));
  }
  return zip.toBuffer();
}

describe("obsidian vault import", () => {
  it("filters vault markdown entries and skips hidden folders", () => {
    assert.equal(isObsidianVaultMarkdownEntry("Notes/Gasthaus.md"), true);
    assert.equal(isObsidianVaultMarkdownEntry("Zettel.markdown"), true);
    assert.equal(isObsidianVaultMarkdownEntry("Log.txt"), true);
    assert.equal(isObsidianVaultMarkdownEntry(".obsidian/workspace.json"), false);
    assert.equal(isObsidianVaultMarkdownEntry(".obsidian/plugins/dataview/main.js"), false);
    assert.equal(isObsidianVaultMarkdownEntry(".trash/Alt.md"), false);
    assert.equal(isObsidianVaultMarkdownEntry("Anhang/Karte.png"), false);
  });

  it("extracts markdown files from a vault zip into a combined bundle", () => {
    const zipBuffer = buildVaultZip({
      "Vault/Gasthaus zum Eber.md": "# Gasthaus zum Eber\n\nEin Treffpunkt mit [[Wirt Haldor]].",
      "Vault/Unterordner/Wirt Haldor.md": "Der Wirt kennt viele Gerüchte.",
      "Vault/.obsidian/plugins/dataview/main.js": "console.log('plugin');",
      "Vault/.obsidian/workspace.json": "{}",
      "Vault/Anhang/notiz.pdf": "%PDF-1.4 fake",
    });

    const result = extractObsidianVaultMarkdown(zipBuffer);

    assert.equal(result.fileCount, 2);
    assert.deepEqual(result.files, [
      "Vault/Gasthaus zum Eber.md",
      "Vault/Unterordner/Wirt Haldor.md",
    ]);
    assert.ok(result.markdown.includes("[[Wirt Haldor]]"));
    assert.ok(result.markdown.includes("source: Vault/Unterordner/Wirt Haldor.md"));

    const preview = previewMarkdownImport(result.markdown, {
      sourceType: "obsidian",
      targetType: "personal_brain",
      fileName: "vault.zip",
    });

    assert.equal(preview.canExecute, true);
    assert.equal(preview.totalDocuments, 2);
    assert.equal(preview.items[0]?.title, "Gasthaus zum Eber");
    assert.equal(preview.items[1]?.title, "Wirt Haldor");
  });

  it("keeps existing frontmatter of vault notes", () => {
    const zipBuffer = buildVaultZip({
      "Notiz.md": "---\ntitle: Eigene Überschrift\ntags: lore, stadt\n---\n\nInhalt.",
    });

    const result = extractObsidianVaultMarkdown(zipBuffer);
    const preview = previewMarkdownImport(result.markdown, {
      sourceType: "obsidian",
      targetType: "personal_brain",
      fileName: "vault.zip",
    });

    assert.equal(preview.totalDocuments, 1);
    assert.equal(preview.items[0]?.title, "Eigene Überschrift");
    assert.deepEqual(preview.items[0]?.tags, ["lore", "stadt"]);
  });

  it("rejects buffers that are not zip archives", () => {
    assert.throws(
      () => extractObsidianVaultMarkdown(Buffer.from("# Kein ZIP", "utf8")),
      (error: unknown) => {
        assert.ok(error instanceof ObsidianVaultImportError);
        assert.match(error.message, /kein gültiges ZIP/);
        return true;
      },
    );
  });

  it("rejects empty buffers", () => {
    assert.throws(
      () => extractObsidianVaultMarkdown(Buffer.alloc(0)),
      (error: unknown) => error instanceof ObsidianVaultImportError,
    );
  });

  it("rejects vault zips without markdown files", () => {
    const zipBuffer = buildVaultZip({
      ".obsidian/workspace.json": "{}",
      "Bilder/readme.pdf": "%PDF-1.4 fake",
    });

    assert.throws(
      () => extractObsidianVaultMarkdown(zipBuffer),
      (error: unknown) => {
        assert.ok(error instanceof ObsidianVaultImportError);
        assert.match(error.message, /Keine Markdown-Dateien/);
        return true;
      },
    );
  });

  it("rejects zip-slip entry names", () => {
    // Prebuilt ZIP containing a `../../evil.png` entry (adm-zip sanitizes
    // traversal names in addFile, so the fixture is stored as base64).
    const zipBuffer = Buffer.from(
      "UEsDBBQAAAAAAJ270FwaQb8VAwAAAAMAAAAOAAAALi4vLi4vZXZpbC5wbmdQTkdQSwECFAMUAAAAAACdu9BcGkG/FQMAAAADAAAADgAAAAAAAAAAAAAAgAEAAAAALi4vLi4vZXZpbC5wbmdQSwUGAAAAAAEAAQA8AAAALwAAAAAA",
      "base64",
    );

    assert.throws(
      () => extractObsidianVaultMarkdown(zipBuffer),
      (error: unknown) => {
        assert.ok(error instanceof ObsidianVaultImportError);
        assert.match(error.message, /unsichere Pfade/);
        return true;
      },
    );
  });
});
