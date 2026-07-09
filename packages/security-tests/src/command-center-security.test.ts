import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("command center read-only contract", () => {
  it("client only polls status — no destructive host actions", () => {
    const source = read("apps/studio/app/system/command-center/CommandCenterClient.tsx");
    const fetchCalls = source.match(/fetch\([^)]+\)/g) ?? [];
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!, /\/api\/system\/command-center/);
    assert.doesNotMatch(source, /\b(restart|maintenance|restore)\b/i);
  });

  it("page requires owner and documents read-only monitoring", () => {
    const source = read("apps/studio/app/system/command-center/page.tsx");
    assert.match(source, /requireOwner/);
    const client = read("apps/studio/app/system/command-center/CommandCenterClient.tsx");
    assert.match(client, /Read-only/);
    assert.match(client, /Host Control/);
  });
});
