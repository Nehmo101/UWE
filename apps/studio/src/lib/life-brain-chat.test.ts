import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { lifeBrainChatBodySchema } from "@uwe/security";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("life-brain chat RTX-only contract", () => {
  it("rejects cloud providerMode in request schema", () => {
    const parsed = lifeBrainChatBodySchema.safeParse({
      messages: [{ role: "user", content: "Test" }],
      providerMode: "cloud",
    });
    assert.equal(parsed.success, false);
  });

  it("allows only auto and local_rtx provider modes", () => {
    assert.equal(
      lifeBrainChatBodySchema.safeParse({
        messages: [{ role: "user", content: "Test" }],
        providerMode: "local_rtx",
      }).success,
      true,
    );
    assert.equal(
      lifeBrainChatBodySchema.safeParse({
        messages: [{ role: "user", content: "Test" }],
      }).success,
      true,
    );
  });

  it("executeLifeBrainChat forces local_rtx and personal_brain context", () => {
    const source = read("apps/studio/src/lib/life-brain-chat.ts");
    assert.match(source, /contextMode:\s*"personal_brain"/);
    assert.match(source, /providerMode:\s*"local_rtx"/);
    assert.match(source, /isRtxReadinessReady/);
    assert.match(source, /kind:\s*"unavailable"/);
  });

  it("API route returns 503 when RTX is offline", () => {
    const source = read("apps/studio/app/api/life-brain/chat/route.ts");
    assert.match(source, /result\.kind === "unavailable"/);
    assert.match(source, /503/);
    assert.match(source, /guardStudioApiMutation/);
  });
});
