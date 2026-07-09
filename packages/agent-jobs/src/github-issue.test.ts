import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGitHubIssue } from "./github-issue";

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
