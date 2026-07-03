import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actionableEnvIssues, selectNewReleases } from "./startklar";
import type { ChangelogRelease } from "./changelog";

function rel(version: string): ChangelogRelease {
  return { version, date: null, unreleased: false, sections: [], url: null };
}

describe("selectNewReleases", () => {
  const releases = [rel("0.4.0"), rel("0.3.0"), rel("0.2.0"), rel("0.1.0")];

  it("returns everything before the last-seen version", () => {
    const result = selectNewReleases(releases, "0.2.0");
    assert.deepEqual(result.map((r) => r.version), ["0.4.0", "0.3.0"]);
  });

  it("returns nothing when the newest version was already seen", () => {
    assert.deepEqual(selectNewReleases(releases, "0.4.0"), []);
  });

  it("falls back to the newest N when nothing was seen yet", () => {
    assert.deepEqual(selectNewReleases(releases, null, 2).map((r) => r.version), ["0.4.0", "0.3.0"]);
  });

  it("falls back when the seen version is no longer in the changelog", () => {
    assert.deepEqual(
      selectNewReleases(releases, "0.0.9", 1).map((r) => r.version),
      ["0.4.0"],
    );
  });
});

describe("actionableEnvIssues", () => {
  it("drops info-level issues, keeps warnings and errors", () => {
    const filtered = actionableEnvIssues([
      { id: "a", severity: "info", message: "fyi" },
      { id: "b", severity: "warning", message: "check" },
      { id: "c", severity: "error", message: "fix" },
    ]);
    assert.deepEqual(filtered.map((i) => i.id), ["b", "c"]);
  });
});
