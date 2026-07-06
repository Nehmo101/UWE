import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  playTrackedSound,
  resetTrackedAudioForTests,
  setTrackedSoundVolume,
  stopAllTrackedSounds,
  stopTrackedSound,
} from "./audio-player";

describe("audio-player process tracking", () => {
  it("tracks a spawned process by job id", () => {
    resetTrackedAudioForTests();
    const result = playTrackedSound(process.execPath, "--version", "job-a");
    assert.equal(result.dispatched, true);
    assert.ok(result.pid != null);

    const stopped = stopTrackedSound("job-a");
    assert.equal(stopped.stoppedCount, 1);
    assert.equal(stopped.stopped, true);
  });

  it("stop_all terminates every tracked process", () => {
    resetTrackedAudioForTests();
    playTrackedSound(process.execPath, "--version", "job-1");
    playTrackedSound(process.execPath, "--version", "job-2");

    const stopped = stopAllTrackedSounds();
    assert.ok(stopped.stoppedCount >= 1);
  });

  it("stores volume for future playback", () => {
    resetTrackedAudioForTests();
    const result = setTrackedSoundVolume(0.5);
    assert.equal(result.volume, 0.5);
    assert.equal(result.acknowledged, true);
  });
});
