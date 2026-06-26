import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeJob, type ExecutorContext } from "./executors";
import type { ClaimedJob } from "./host-client";

function job(payload: Record<string, unknown>): ClaimedJob {
  return {
    id: "job_sound_play",
    type: "sound_play",
    lane: "audio",
    priority: 90,
    payload,
    worldId: null,
    expiresAt: null,
  };
}

function ctx(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    requestTimeoutMs: 1000,
    refreshModels: async () => 0,
    ...overrides,
  };
}

describe("executeJob sound_play", () => {
  it("accepts sourceUrl as the official audio source field", async () => {
    const result = await executeJob(
      job({ sourceUrl: "--version" }),
      ctx({ audioCommand: process.execPath }),
    );

    assert.equal(result.dispatched, true);
    assert.equal(result.source, "--version");
  });

  it("keeps accepting legacy audio source aliases", async () => {
    for (const field of ["url", "path", "source"] as const) {
      const result = await executeJob(job({ [field]: "--version" }), ctx({ audioCommand: process.execPath }));
      assert.equal(result.source, "--version");
    }
  });

  it("fails clearly when no audio source is provided", async () => {
    await assert.rejects(
      () => executeJob(job({}), ctx({ audioCommand: process.execPath })),
      /keine Audioquelle/,
    );
  });

  it("fails clearly when no audio command is configured", async () => {
    await assert.rejects(
      () => executeJob(job({ sourceUrl: "sound.mp3" }), ctx()),
      /kein lokaler Audio-Player/,
    );
  });
});
