import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countActiveBySourceType,
  createActiveSoundsState,
  playSound,
  stopAllSounds,
} from "./active-sounds";

describe("@uwe/soundboard active sounds", () => {
  it("allows multiple local sounds simultaneously", () => {
    let state = createActiveSoundsState();

    state = playSound(state, {
      id: "a",
      title: "A",
      sourceType: "local",
      volume: 1,
      loop: false,
    }).state;

    state = playSound(state, {
      id: "b",
      title: "B",
      sourceType: "local",
      volume: 1,
      loop: false,
    }).state;

    assert.equal(state.sounds.length, 2);
    state = stopAllSounds();
    assert.equal(state.sounds.length, 0);
  });

  it("replaces an active Spotify sound when a new one starts", () => {
    let state = createActiveSoundsState();

    state = playSound(state, {
      id: "s1",
      title: "One",
      sourceType: "spotify",
      sourceUrl: "spotify:track:1",
      volume: 1,
      loop: false,
    }).state;

    state = playSound(state, {
      id: "s2",
      title: "Two",
      sourceType: "spotify",
      sourceUrl: "spotify:track:2",
      volume: 1,
      loop: false,
    }).state;

    assert.equal(countActiveBySourceType(state, "spotify"), 1);
    assert.equal(state.sounds[0]?.buttonId, "s2");
  });
});
