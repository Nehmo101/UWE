import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveOnAccent, resolveThemeColorTokens } from "./resolveColorTokens";
import { THEME_LIST, UWE_THEMES } from "./themes";

describe("resolveThemeColorTokens", () => {
  it("derives sidebar, card, input and focus tokens from base palette", () => {
    const resolved = resolveThemeColorTokens(UWE_THEMES["uwe-default"].colors);
    assert.equal(resolved.sidebarBg, UWE_THEMES["uwe-default"].colors.panel);
    assert.equal(resolved.cardBg, UWE_THEMES["uwe-default"].colors.surface);
    assert.equal(resolved.inputBg, UWE_THEMES["uwe-default"].colors.bgElevated);
    assert.match(resolved.focusRing, /color-mix/);
    assert.match(resolved.focusShadow, /color-mix/);
  });

  it("derives an onAccent text color for every theme", () => {
    for (const theme of THEME_LIST) {
      const resolved = resolveThemeColorTokens(theme.colors);
      assert.ok(["#000000", "#ffffff"].includes(resolved.onAccent), theme.id);
    }
  });
});

describe("deriveOnAccent", () => {
  // Relative luminance + WCAG contrast for the AA assertions below.
  const lum = (hex: string) => {
    const ch = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const n = hex.replace("#", "");
    return (
      0.2126 * ch(parseInt(n.slice(0, 2), 16)) +
      0.7152 * ch(parseInt(n.slice(2, 4), 16)) +
      0.0722 * ch(parseInt(n.slice(4, 6), 16))
    );
  };
  const contrast = (a: string, b: string) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  it("picks black on light accents and white on dark accents", () => {
    assert.equal(deriveOnAccent("#84cc16"), "#000000"); // lime
    assert.equal(deriveOnAccent("#22d3ee"), "#000000"); // cyan
    assert.equal(deriveOnAccent("#1e1b4b"), "#ffffff"); // deep indigo
  });

  it("falls back to white for non-hex accents", () => {
    assert.equal(deriveOnAccent("rgba(99,102,241,0.5)"), "#ffffff");
  });

  it("meets WCAG AA (>=4.5) for every theme accent", () => {
    for (const theme of THEME_LIST) {
      const accent = theme.colors.accent;
      if (!/^#[0-9a-fA-F]{6}$/.test(accent)) continue;
      const ratio = contrast(accent, deriveOnAccent(accent));
      assert.ok(ratio >= 4.5, `${theme.id} ${accent} ratio ${ratio.toFixed(2)}`);
    }
  });
});
