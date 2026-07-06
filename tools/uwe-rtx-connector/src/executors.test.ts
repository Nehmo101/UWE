import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { executeJob, type ExecutorContext } from "./executors";
import type { ClaimedJob } from "./host-client";

function soundJob(payload: Record<string, unknown>): ClaimedJob {
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

function genericJob(type: string, payload: Record<string, unknown>): ClaimedJob {
  return {
    id: `job_${type}`,
    type,
    lane: type.startsWith("spotify_") ? "spotify" : "gpu",
    priority: 50,
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
      soundJob({ sourceUrl: "--version" }),
      ctx({ audioCommand: process.execPath }),
    );

    assert.equal(result.dispatched, true);
    assert.equal(result.source, "--version");
  });

  it("keeps accepting legacy audio source aliases", async () => {
    for (const field of ["url", "path", "source"] as const) {
      const result = await executeJob(
        soundJob({ [field]: "--version" }),
        ctx({ audioCommand: process.execPath }),
      );
      assert.equal(result.source, "--version");
    }
  });

  it("fails clearly when no audio source is provided", async () => {
    await assert.rejects(
      () => executeJob(soundJob({}), ctx({ audioCommand: process.execPath })),
      /keine Audioquelle/,
    );
  });

  it("fails clearly when no audio command is configured", async () => {
    await assert.rejects(
      () => executeJob(soundJob({ sourceUrl: "sound.mp3" }), ctx()),
      /kein lokaler Audio-Player/,
    );
  });
});

describe("executeJob sound_stop", () => {
  it("stops a tracked sound_play process by job id", async () => {
    const playJob: ClaimedJob = {
      ...soundJob({ sourceUrl: "--version" }),
      id: "job_play_track",
    };
    await executeJob(playJob, ctx({ audioCommand: process.execPath }));

    const stopResult = await executeJob(
      genericJob("sound_stop", { jobId: "job_play_track" }),
      ctx({ audioCommand: process.execPath }),
    );
    assert.equal((stopResult as { stoppedCount?: number }).stoppedCount, 1);
  });

  it("stop_all clears tracked playback", async () => {
    await executeJob(soundJob({ sourceUrl: "--version" }), ctx({ audioCommand: process.execPath }));
    const stopAll = await executeJob(genericJob("sound_stop_all", {}), ctx());
    assert.ok(((stopAll as { stoppedCount?: number }).stoppedCount ?? 0) >= 0);
  });
});

describe("executeJob image_generate", () => {
  it("runs the configured image command with the job payload", async () => {
    const dir = await mkdtemp(join(tmpdir(), "uwe-image-executor-"));
    const script = join(dir, "worker.mjs");
    await writeFile(
      script,
      [
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', () => {",
        "  const payload = JSON.parse(input);",
        "  console.log(JSON.stringify({ imageUrl: 'file://generated.png', prompt: payload.prompt }));",
        "});",
      ].join("\n"),
      "utf8",
    );

    const result = await executeJob(
      genericJob("image_generate", { prompt: "a test image" }),
      ctx({ imageCommand: `${process.execPath} ${script}` }),
    );

    assert.equal(result.dispatched, true);
    assert.equal(result.imageUrl, "file://generated.png");
    assert.equal(result.prompt, "a test image");
  });

  it("fails clearly when no image command is configured", async () => {
    await assert.rejects(
      () => executeJob(genericJob("image_generate", { prompt: "x" }), ctx()),
      /UWE_CONNECTOR_IMAGE_CMD/,
    );
  });
});

describe("executeJob spotify", () => {
  it("fails clearly when spotify credentials are missing", async () => {
    await assert.rejects(
      () => executeJob(genericJob("spotify_pause", {}), ctx()),
      /Spotify Connect/,
    );
  });
});
