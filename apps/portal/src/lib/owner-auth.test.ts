import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const libDir = dirname(fileURLToPath(import.meta.url));

/**
 * `owner-auth.ts` reaches for `next/headers` through `./auth`, so it cannot be
 * imported in a plain node:test process. What matters is that the gate reads
 * the owner flag and nothing weaker — the role enum it used to consult is gone.
 */
describe("portal owner auth", () => {
  it("gates the private healthcheck on the owner flag", async () => {
    const source = await readFile(join(libDir, "owner-auth.ts"), "utf8");

    assert.match(source, /session\?\.user\?\.isOwner/, "gate must read the owner flag");
    assert.doesNotMatch(source, /\brole\b/, "the role enum must not come back");
    assert.match(source, /status:\s*401/, "a missing session must be denied with 401");
    assert.match(source, /status:\s*403/, "a non-owner session must be denied with 403");
  });
});
