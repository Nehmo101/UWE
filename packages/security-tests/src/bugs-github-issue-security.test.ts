import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { requireStudioApiAuth } from "@uwe/security";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function makeCrossSiteRequest(apiPath: string): Request {
  return new Request(`http://studio.local${apiPath}`, {
    method: "POST",
    headers: {
      host: "studio.local",
      "sec-fetch-site": "cross-site",
      origin: "http://evil.example",
    },
  });
}

describe("bugs GitHub issue sync security", () => {
  const routePath = "apps/studio/app/api/bugs/[id]/github-issue/route.ts";
  const clientPath = "apps/studio/app/bugs/BugWorkspaceClient.tsx";

  it("route uses studio mutation guard and owner check", () => {
    const source = read(routePath);
    assert.match(source, /guardStudioApiMutation/);
    assert.match(source, /resolveOwnerApiUser/);
    assert.match(source, /resolveGitHubIssueConfig/);
    assert.doesNotMatch(source, /process\.env\.(GITHUB_TOKEN|GITHUB_ISSUE_TOKEN)/);
  });

  it("blocks cross-site POST to bug GitHub issue endpoint", () => {
    const result = requireStudioApiAuth(makeCrossSiteRequest("/api/bugs/test-id/github-issue"));
    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("client calls studio API without reading env tokens", () => {
    const source = read(clientPath);
    assert.doesNotMatch(source, /process\.env/);
    assert.doesNotMatch(source, /api\.github\.com/);
    assert.match(source, /\/api\/bugs\/\$\{/);
  });
});
