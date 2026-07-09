import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REQUIRED_PALETTE_KEYS, type PaletteColors } from "./palette-tokens";
import { contrastRatio, isHexColor } from "./contrast";
import { buildRepairHint, validatePalette } from "./validate";
import { parsePaletteResponse } from "./parse";

// A complete, AA-valid palette (Parchment-Teal resolutions).
const validPalette: PaletteColors = {
  bg: "#f1e8d4",
  bgElevated: "#fbf6ea",
  surface: "rgba(251, 246, 234, 0.95)",
  panel: "#ece1c9",
  border: "#e0d4ba",
  borderMuted: "rgba(224, 212, 186, 0.7)",
  fg: "#211d17",
  fgMuted: "#574e40",
  fgSubtle: "#665d4f",
  accent: "#2f6f63",
  accentHover: "#3a8878",
  accentMuted: "rgba(47, 111, 99, 0.16)",
  link: "#2f6f63",
  danger: "#c2622b",
  warning: "#e0b15a",
  success: "#2f6f63",
  info: "#2f6f63",
  wikiLink: "#2f6f63",
  wikiLinkHover: "#3a8878",
  dmOnly: "#c2622b",
  playerVisible: "#2f6f63",
  shellGradientStart: "rgba(47, 111, 99, 0.03)",
  shellGradientMid: "rgba(241, 232, 212, 0.05)",
  shellGradientEnd: "#f1e8d4",
};

describe("contrast", () => {
  it("validates hex forms", () => {
    assert.equal(isHexColor("#fff"), true);
    assert.equal(isHexColor("#2f6f63"), true);
    assert.equal(isHexColor("rgba(0,0,0,1)"), false);
  });
  it("computes a plausible ratio", () => {
    const r = contrastRatio("#000000", "#ffffff");
    assert.ok(r && r > 20);
  });
});

describe("validatePalette", () => {
  it("accepts a complete AA-valid palette (no blocking errors)", () => {
    const result = validatePalette(validPalette);
    assert.equal(result.ok, true);
    assert.equal(
      result.issues.some((i) => i.severity === "error"),
      false,
    );
  });

  it("flags missing required keys", () => {
    const { accent, ...rest } = validPalette;
    void accent;
    const result = validatePalette(rest);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.kind === "missing" && i.key === "accent"));
  });

  it("flags invalid hex values", () => {
    const result = validatePalette({ ...validPalette, fg: "#zzz" });
    assert.ok(result.issues.some((i) => i.kind === "invalid" && i.key === "fg"));
  });

  it("blocks on low text-on-background contrast (error severity)", () => {
    const result = validatePalette({ ...validPalette, fg: "#d8d8d8" });
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some(
        (i) => i.kind === "contrast" && i.key === "fg" && i.severity === "error",
      ),
      "expected a blocking contrast error for pale fg on light bg",
    );
  });

  it("treats a low-contrast GM marker as a non-blocking warning", () => {
    // dmOnly #c2622b on #f1e8d4 is ~3.4:1 — a warning, but must not block save.
    const result = validatePalette(validPalette);
    const dm = result.issues.find((i) => i.key === "dmOnly");
    assert.equal(dm?.severity, "warning");
    assert.equal(result.ok, true);
  });

  it("builds a non-empty repair hint listing the problems", () => {
    const { bg, ...rest } = validPalette;
    void bg;
    const hint = buildRepairHint(validatePalette(rest));
    assert.match(hint, /Fehlende Farben/);
    assert.match(hint, /NUR das vollständige JSON/);
    assert.equal(buildRepairHint(validatePalette(validPalette)), "");
  });

  it("covers all 23 required keys", () => {
    assert.equal(REQUIRED_PALETTE_KEYS.length, 23);
  });
});

describe("parsePaletteResponse", () => {
  it("parses a fenced JSON block with nested colors", () => {
    const text = 'Hier ist dein Design:\n```json\n{"label":"Test","colors":{"bg":"#fff","fg":"#000","accent":"#2f6f63"}}\n```\nViel Spaß!';
    const { palette, error } = parsePaletteResponse(text);
    assert.equal(error, undefined);
    assert.equal(palette?.label, "Test");
    assert.equal(palette?.colors.bg, "#fff");
  });

  it("parses a bare palette map and strips meta keys", () => {
    const text = '{"bg":"#fff","fg":"#000","accent":"#2f6f63","scope":"studio"}';
    const { palette } = parsePaletteResponse(text);
    assert.equal(palette?.colors.bg, "#fff");
    assert.equal(palette?.colors.scope, undefined); // meta not treated as a color
    assert.equal(palette?.scope, "studio");
  });

  it("returns an error for prose without JSON", () => {
    const { error } = parsePaletteResponse("Ich habe leider kein JSON.");
    assert.ok(error);
  });

  it("returns an error for invalid JSON", () => {
    const { error } = parsePaletteResponse("{ bg: #fff, }");
    assert.ok(error);
  });
});
