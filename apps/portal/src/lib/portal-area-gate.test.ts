import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const libDir = dirname(fileURLToPath(import.meta.url));
const portalRoot = join(libDir, "..", "..");

async function readPortalFile(...segments: string[]): Promise<string> {
  return readFile(join(portalRoot, ...segments), "utf8");
}

describe("portal area access wiring", () => {
  it("rejects an otherwise valid session when the Portal checkbox is absent", async () => {
    const source = await readPortalFile("src", "lib", "auth.ts");
    const sessionStart = source.indexOf("export const getCurrentSession");
    const sessionEnd = source.indexOf("export const getCurrentUser", sessionStart);
    const sessionGate = source.slice(sessionStart, sessionEnd);

    assert.match(sessionGate, /canAccessPortal\(session\.user\)/);
  });

  it("requires Portal access again at the world-content boundary", async () => {
    const source = await readPortalFile("src", "lib", "auth.ts");
    const worldStart = source.indexOf("export const getAccessContextForWorld");
    const worldEnd = source.indexOf("export const listAuthWorlds", worldStart);
    const worldGate = source.slice(worldStart, worldEnd);

    assert.match(worldGate, /getCurrentSession\(\)/);
    assert.match(worldGate, /canAccessPortal\(ctx\.user\)/);
  });

  it("checks the database-backed Portal session in APIs and Server Actions", async () => {
    const [apiGuard, actionGuard] = await Promise.all([
      readPortalFile("src", "lib", "portal-api-auth.ts"),
      readPortalFile("src", "lib", "portal-action-auth.ts"),
    ]);

    assert.match(apiGuard, /requiresPortalSession\(pathname\)/);
    assert.match(apiGuard, /await getCurrentUser\(\)/);
    assert.match(actionGuard, /await getCurrentUser\(\)/);
    assert.match(apiGuard, /status:\s*403/);
    assert.match(actionGuard, /status:\s*403/);
  });

  it("gates the complete authenticated page tree before rendering children", async () => {
    const layout = await readPortalFile("app", "auth", "layout.tsx");

    assert.match(layout, /await getCurrentUser\(\)/);
    assert.match(layout, /redirect\("\/login\?reason=portal-access"\)/);
  });
});
