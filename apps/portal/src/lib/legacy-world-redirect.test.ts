import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

describe("legacy world redirects", () => {
  it("uses login-first redirect shims", () => {
    assert.match(readFileSync(path.join(root, "app/worlds/page.tsx"), "utf8"), /redirectLegacyWorldsHub/);
    assert.match(
      readFileSync(path.join(root, "app/worlds/[worldSlug]/page.tsx"), "utf8"),
      /redirectLegacyWorldPath/,
    );
  });
});
