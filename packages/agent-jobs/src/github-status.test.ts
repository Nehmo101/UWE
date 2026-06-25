import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchPullRequestForBranch, fetchWorkflowRunStatus } from "./github-status";

describe("fetchWorkflowRunStatus", () => {
  it("returns the latest workflow run for a branch", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      assert.match(url, /repos\/acme\/repo\/actions\/runs/);
      assert.match(url, /branch=cursor%2Ffeature-branch/);
      return new Response(
        JSON.stringify({
          workflow_runs: [
            {
              id: 12345,
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/acme/repo/actions/runs/12345",
            },
          ],
        }),
        { status: 200 },
      );
    };

    try {
      const result = await fetchWorkflowRunStatus(
        "acme",
        "repo",
        "ghp_test",
        "cursor/feature-branch",
      );
      assert.equal(result.runId, 12345);
      assert.equal(result.status, "completed");
      assert.equal(result.conclusion, "success");
      assert.equal(result.htmlUrl, "https://github.com/acme/repo/actions/runs/12345");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when GitHub returns an error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("forbidden", { status: 403 });

    try {
      await assert.rejects(
        () => fetchWorkflowRunStatus("acme", "repo", "bad-token", "main"),
        /403/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("fetchPullRequestForBranch", () => {
  it("returns the latest pull request for a branch head", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      assert.match(url, /repos\/acme\/repo\/pulls/);
      assert.match(url, /head=acme%3Acursor%2Ffeature-branch/);
      return new Response(
        JSON.stringify([
          {
            number: 42,
            html_url: "https://github.com/acme/repo/pull/42",
          },
        ]),
        { status: 200 },
      );
    };

    try {
      const result = await fetchPullRequestForBranch(
        "acme",
        "repo",
        "ghp_test",
        "cursor/feature-branch",
      );
      assert.equal(result.number, 42);
      assert.equal(result.url, "https://github.com/acme/repo/pull/42");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when GitHub returns an error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("forbidden", { status: 403 });

    try {
      await assert.rejects(
        () => fetchPullRequestForBranch("acme", "repo", "bad-token", "main"),
        /403/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
