import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { UWE_PRODUCT_NAME, UWE_VERSION } from "./version";

const root = path.resolve(import.meta.dirname, "../../..");

describe("UWE version", () => {
  it("reads version from VERSION file", () => {
    const expected = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
    assert.equal(UWE_VERSION, expected);
    assert.match(UWE_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it("defines product name", () => {
    assert.equal(UWE_PRODUCT_NAME, "Universeller Welten-Editor");
  });
});
