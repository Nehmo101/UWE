import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSoundboardValidationMessage,
  validateSoundboardButton,
} from "./validation";

describe("SoundboardButton validation", () => {
  it("requires a non-empty title", () => {
    const errors = validateSoundboardButton({
      title: "   ",
      sourceType: "local",
      assetId: "asset-1",
    });
    assert.ok(errors.some((error) => error.field === "title"));
  });

  it("requires assetId for local sources", () => {
    const message = getSoundboardValidationMessage({
      title: "Rain",
      sourceType: "local",
      assetId: "",
    });
    assert.equal(message, "Lokaler Sound benötigt eine Datei/ein Asset.");
  });

  it("requires a valid YouTube URL", () => {
    const message = getSoundboardValidationMessage({
      title: "Theme",
      sourceType: "youtube",
      sourceUrl: "https://example.com/watch?v=dQw4w9WgXcQ",
    });
    assert.equal(message, "Ungültige YouTube URL");
  });

  it("accepts valid YouTube URLs", () => {
    const message = getSoundboardValidationMessage({
      title: "Theme",
      sourceType: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      volume: 0.5,
    });
    assert.equal(message, null);
  });

  it("requires a valid Spotify URL", () => {
    const message = getSoundboardValidationMessage({
      title: "Track",
      sourceType: "spotify",
      sourceUrl: "https://example.com/track/abc123456789",
    });
    assert.equal(message, "Ungültige Spotify URL");
  });

  it("accepts valid Spotify URLs", () => {
    const message = getSoundboardValidationMessage({
      title: "Track",
      sourceType: "spotify",
      sourceUrl: "https://open.spotify.com/intl-de/track/11dFghVXANMlKmJXsNCbNl",
      volume: 1,
    });
    assert.equal(message, null);
  });

  it("rejects invalid volume values", () => {
    const message = getSoundboardValidationMessage({
      title: "Rain",
      sourceType: "local",
      assetId: "asset-1",
      volume: 1.5,
    });
    assert.equal(message, "Lautstärke muss zwischen 0 und 1 liegen.");
  });

  it("rejects unknown source types", () => {
    const message = getSoundboardValidationMessage({
      title: "Mystery",
      sourceType: "invalid" as "local",
    });
    assert.equal(message, "Ungültige Quelle.");
  });
});
