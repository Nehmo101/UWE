import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  compareSemver,
  countCommandCenterStashes,
  parseReleaseTag,
  selectLatestReleaseTag,
  stashNoticeMessage,
  UPDATE_STASH_MARKER,
} from "./desktop-host-update";

describe("desktop host update helpers", () => {
  it("parses uwe-v release tags", () => {
    assert.deepEqual(parseReleaseTag("uwe-v1.2.3"), { tag: "uwe-v1.2.3", version: "1.2.3" });
    assert.equal(parseReleaseTag("v1.2.3"), null);
    assert.equal(parseReleaseTag("engine-connector-v0.1.0"), null);
  });

  it("compares semver versions", () => {
    assert.equal(compareSemver("0.1.0", "0.1.1"), -1);
    assert.equal(compareSemver("1.0.0", "0.9.9"), 1);
    assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
  });

  it("selects the highest release tag", () => {
    assert.deepEqual(
      selectLatestReleaseTag(["uwe-v0.1.0", "uwe-v0.2.0", "uwe-v0.1.5", "ignore"]),
      { tag: "uwe-v0.2.0", version: "0.2.0" },
    );
    assert.equal(selectLatestReleaseTag(["main", "feature"]), null);
  });
});

/**
 * Der Update-Sync stasht dirty Worktrees und poppt bewusst nie — dafür muss der
 * Betreiber den wachsenden Stapel wenigstens sehen. Diese Tests nageln Zählung
 * und Hinweistext fest.
 */
describe("command center stash bookkeeping", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  function git(root: string, args: string[]): void {
    const result = spawnSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  }

  function initRepository(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-stash-count-"));
    temporaryDirectories.push(root);
    git(root, ["init"]);
    git(root, ["config", "user.email", "test@uwe.example"]);
    git(root, ["config", "user.name", "UWE Test"]);
    fs.writeFileSync(path.join(root, "datei.txt"), "eins\n", "utf8");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "init"]);
    return root;
  }

  it("zählt nur die eigenen Update-Stashes im Stapel", () => {
    const root = initRepository();
    assert.equal(countCommandCenterStashes(root), 0);

    fs.writeFileSync(path.join(root, "datei.txt"), "zwei\n", "utf8");
    git(root, ["stash", "push", "-u", "-m", `${UPDATE_STASH_MARKER} 2026-08-04T00:00:00.000Z`]);
    fs.writeFileSync(path.join(root, "datei.txt"), "drei\n", "utf8");
    git(root, ["stash", "push", "-u", "-m", "eigene Bastelei"]);

    assert.equal(countCommandCenterStashes(root), 1);

    fs.writeFileSync(path.join(root, "datei.txt"), "vier\n", "utf8");
    git(root, ["stash", "push", "-u", "-m", `${UPDATE_STASH_MARKER} 2026-08-04T01:00:00.000Z`]);
    assert.equal(countCommandCenterStashes(root), 2);
  });

  it("meldet 0 statt zu scheitern, wenn der Ordner gar kein Repository ist", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-stash-kein-repo-"));
    temporaryDirectories.push(root);
    assert.equal(countCommandCenterStashes(root), 0);
  });

  it("formuliert den Hinweis mit Anzahl und ohne Auto-Pop-Versprechen", () => {
    const einer = stashNoticeMessage(1);
    assert.match(einer, /git stash/);
    assert.match(einer, /1 Command-Center-Stash im Stapel/);
    assert.match(einer, /nicht zurückgespielt/);

    const mehrere = stashNoticeMessage(3);
    assert.match(mehrere, /3 Command-Center-Stashes im Stapel/);
    assert.match(mehrere, /git stash list/);
  });
});
