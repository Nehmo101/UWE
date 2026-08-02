import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGitHubIssue } from "./create-issue";
import { resolveGitHubIssueConfig, splitGitHubRepo } from "./config";

describe("createGitHubIssue", () => {
  it("rejects empty title without calling GitHub", async () => {
    const result = await createGitHubIssue("owner", "repo", "token", {
      title: "   ",
      body: "body",
    });
    assert.equal(result.success, false);
    assert.match(result.error ?? "", /Titel/);
  });
});

describe("resolveGitHubIssueConfig", () => {
  it("returns nulls when nothing is configured", () => {
    const config = resolveGitHubIssueConfig({});
    assert.equal(config.repo, null);
    assert.equal(config.token, null);
  });

  it("reads repo and token from the environment", () => {
    const config = resolveGitHubIssueConfig({
      GITHUB_ISSUE_REPO: " owner/repo ",
      GITHUB_TOKEN: " ghp_test ",
    });
    assert.equal(config.repo, "owner/repo");
    assert.equal(config.token, "ghp_test");
  });

  it("falls back to GITHUB_ISSUE_TOKEN", () => {
    const config = resolveGitHubIssueConfig({ GITHUB_ISSUE_TOKEN: "ghp_fallback" });
    assert.equal(config.token, "ghp_fallback");
  });
});

describe("splitGitHubRepo", () => {
  it("splits owner/repo", () => {
    assert.deepEqual(splitGitHubRepo("owner/repo"), { owner: "owner", name: "repo" });
  });

  it("rejects malformed values", () => {
    assert.equal(splitGitHubRepo("owner"), null);
    assert.equal(splitGitHubRepo("/repo"), null);
    assert.equal(splitGitHubRepo("owner/"), null);
    assert.equal(splitGitHubRepo(""), null);
    assert.equal(splitGitHubRepo("owner/ "), null);
  });

  // Ein drittes Segment darf nicht still auf owner/repo zurückfallen — sonst
  // landet das Issue in einem anderen Repository als konfiguriert.
  it("rejects more than two segments instead of truncating", () => {
    assert.equal(splitGitHubRepo("owner/repo/extra"), null);
    assert.equal(splitGitHubRepo("https://github.com/owner/repo"), null);
  });
});
