import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveThemeColorTokens } from "./resolveColorTokens";
import { UWE_THEMES } from "./themes";

describe("resolveThemeColorTokens", () => {
  it("derives sidebar, card, input and focus tokens from base palette", () => {
    const resolved = resolveThemeColorTokens(UWE_THEMES["uwe-default"].colors);
    assert.equal(resolved.sidebarBg, UWE_THEMES["uwe-default"].colors.panel);
    assert.equal(resolved.cardBg, UWE_THEMES["uwe-default"].colors.surface);
    assert.equal(resolved.inputBg, UWE_THEMES["uwe-default"].colors.bgElevated);
    assert.match(resolved.focusRing, /color-mix/);
    assert.match(resolved.focusShadow, /color-mix/);
  });
});
