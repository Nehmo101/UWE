import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyThemeAppearance, buildVisualThemeHtmlAttributes } from "./visual-theme";

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
      "data-theme": "system",
      "data-uwe-appearance": "system",
      "data-uwe-bg-pattern": "dots",
      "data-uwe-glass": "off",
      "data-uwe-motion": "on",
      "data-uwe-app": "portal",
    });
  });

  it("applyThemeAppearance sets data-theme on documentElement", () => {
    const prev = globalThis.document;
    const el = { dataset: {} as DOMStringMap };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        documentElement: el,
      },
    });
    try {
      applyThemeAppearance("light");
      assert.equal(el.dataset.theme, "light");
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: prev,
      });
    }
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
