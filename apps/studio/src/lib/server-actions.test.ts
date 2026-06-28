import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const studioRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

async function collectActionFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectActionFiles(fullPath)));
      continue;
    }
    if (entry.name.endsWith("-actions.ts") || entry.name === "actions.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

describe("studio server actions", () => {
  it("marks all action modules as server-only", async () => {
    const actionFiles = await collectActionFiles(join(studioRoot, "app"));
    assert.ok(actionFiles.length > 0);

    for (const file of actionFiles) {
      const source = await readFile(file, "utf8");
      const firstLine = source.split(/\r?\n/).find((line) => line.trim().length > 0);
      assert.equal(firstLine, '"use server";', file);
    }
  });
});
