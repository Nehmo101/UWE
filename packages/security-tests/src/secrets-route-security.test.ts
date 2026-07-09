import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("admin secrets route security", () => {
  it("requires admin API auth on secrets status JSON", () => {
    const source = read("apps/studio/app/api/admin/secrets/route.ts");
    assert.match(source, /requireAdminApiAuth/);
    assert.match(source, /canAccessSecurityDashboard/);
    assert.match(source, /assertSecretsStatusHasNoSecrets/);
    assert.doesNotMatch(source, /decryptSecret|passwordEnc|apiKeyEnc/);
  });

  it("logs audit event when secrets status is viewed", () => {
    const source = read("apps/studio/app/api/admin/secrets/route.ts");
    assert.match(source, /logAuditEvent/);
    assert.match(source, /secret_status_viewed/);
  });

  it("requires admin auth on secret reveal audit endpoint", () => {
    const source = read("apps/studio/app/api/admin/secrets/reveal/route.ts");
    assert.match(source, /guardStudioAdminApiRequest/);
    assert.match(source, /secret_revealed/);
    assert.match(source, /masked/);
    assert.doesNotMatch(source, /decryptSecret|passwordEnc|apiKeyEnc/);
  });

  it("secrets status page stays read-only", () => {
    const source = read("apps/studio/app/admin/secrets/page.tsx");
    assert.match(source, /Read-only/);
    assert.doesNotMatch(source, /<form|type="password"|revealSecret/i);
  });
});
