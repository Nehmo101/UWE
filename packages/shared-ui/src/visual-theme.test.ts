import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVisualThemeHtmlAttributes } from "./visual-theme";

describe("buildVisualThemeHtmlAttributes", () => {
  it("maps app settings to html data attributes", () => {
    const attrs = buildVisualThemeHtmlAttributes(
      {
        theme: "system",
        backgroundPattern: "dots",
        frostedGlass: false,
        motionEnabled: true,
      },
      { appVariant: "portal" },
    );

    assert.deepEqual(attrs, {
      "data-uwe-theme": "system",
      "data-uwe-bg-pattern": "dots",
      "data-uwe-glass": "off",
      "data-uwe-motion": "on",
      "data-uwe-app": "portal",
    });
  });

  it("defaults glass and motion to on when undefined", () => {
    const attrs = buildVisualThemeHtmlAttributes({
      theme: "dark",
      backgroundPattern: "none",
      frostedGlass: undefined as unknown as boolean,
      motionEnabled: undefined as unknown as boolean,
    });

    assert.equal(attrs["data-uwe-glass"], "on");
    assert.equal(attrs["data-uwe-motion"], "on");
  });
});
