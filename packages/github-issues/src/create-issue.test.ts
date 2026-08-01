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
  });
});
