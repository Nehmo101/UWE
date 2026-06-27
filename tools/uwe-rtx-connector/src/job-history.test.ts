import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { JobHistory, jobHistoryPath } from "./job-history";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "uwe-job-history-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("JobHistory", () => {
  it("records most-recent-first and trims to the limit", () => {
    const history = new JobHistory({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      history.record({ id: `j${i}`, type: "sound_play", lane: "audio", status: "completed", durationMs: 10 });
    }
    const list = history.list();
    assert.equal(list.length, 3);
    assert.equal(list[0].id, "j4");
    assert.equal(list[2].id, "j2");
  });

  it("truncates failure reasons and never stores payloads", () => {
    const history = new JobHistory();
    const entry = history.record({
      id: "bad",
      type: "image_generate",
      lane: "gpu",
      status: "failed",
      durationMs: 5,
      reason: "x".repeat(1000),
    });
    assert.equal(entry.status, "failed");
    assert.equal(entry.reason?.length, 300);
    // The stored entry exposes only safe descriptor fields.
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["durationMs", "finishedAt", "id", "lane", "reason", "status", "type"],
    );
  });

  it("persists to disk and reloads across instances", () => {
    const persistPath = jobHistoryPath(dir);
    const first = new JobHistory({ persistPath });
    first.record({ id: "j1", type: "llm_generate", lane: "gpu", status: "completed", durationMs: 42 });

    const onDisk = JSON.parse(readFileSync(persistPath, "utf8"));
    assert.equal(onDisk.length, 1);

    const second = new JobHistory({ persistPath });
    assert.equal(second.size, 1);
    assert.equal(second.list()[0].id, "j1");
  });
});
