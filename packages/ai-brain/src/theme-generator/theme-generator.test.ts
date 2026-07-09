import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REQUIRED_PALETTE_KEYS } from "@uwe/theme-studio";
import {
  buildThemeSystemPrompt,
  buildThemeUserPrompt,
  parseThemeEnvelope,
  runThemeGeneratorTurn,
} from "./index";

function completeColors(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {};
  for (const key of REQUIRED_PALETTE_KEYS) base[key] = "#2f6f63";
  base.bg = "#f1e8d4";
  base.fg = "#211d17";
  base.link = "#2f6f63";
  base.wikiLink = "#2f6f63";
  return { ...base, ...overrides };
}

describe("prompts", () => {
  it("system prompt lists all required tokens and reflects the scope", () => {
    const prompt = buildThemeSystemPrompt("portal", 3);
    for (const key of REQUIRED_PALETTE_KEYS) assert.match(prompt, new RegExp(key));
    assert.match(prompt, /Portal/);
    assert.match(prompt, /JSON/);
  });

  it("user prompt flattens history + repair hint", () => {
    const prompt = buildThemeUserPrompt(
      [
        { role: "user", content: "dunkel bitte" },
        { role: "assistant", content: "welche Akzentfarbe?" },
      ],
      "türkis",
      "Bitte korrigiere: Fehlende Farben: accent.",
    );
    assert.match(prompt, /Nutzer: dunkel bitte/);
    assert.match(prompt, /Assistent: welche Akzentfarbe/);
    assert.match(prompt, /Neue Nachricht des Nutzers: türkis/);
    assert.match(prompt, /Fehlende Farben: accent/);
  });
});

describe("parseThemeEnvelope", () => {
  it("parses a question turn (no palettes)", () => {
    const env = parseThemeEnvelope('{"message":"Hell oder dunkel?","palettes":[]}');
    assert.equal(env.message, "Hell oder dunkel?");
    assert.equal(env.palettes.length, 0);
  });

  it("parses palettes and validates them", () => {
    const raw = JSON.stringify({
      message: "Hier drei Vorschläge",
      palettes: [
        { label: "Teal", description: "warm", colors: completeColors() },
        { label: "Kaputt", description: "x", colors: { bg: "#fff" } },
      ],
    });
    const env = parseThemeEnvelope(raw);
    assert.equal(env.palettes.length, 2);
    assert.equal(env.palettes[0].validation.ok, true);
    assert.equal(env.palettes[1].validation.ok, false); // missing required keys
  });

  it("reports a parse error for prose without JSON", () => {
    const env = parseThemeEnvelope("Ich habe eine Frage an dich.");
    assert.ok(env.error);
    assert.equal(env.palettes.length, 0);
  });
});

describe("runThemeGeneratorTurn", () => {
  it("returns needsInput when the model asks a question", async () => {
    const result = await runThemeGeneratorTurn(
      { userMessage: "mach mir was schönes", scope: "studio" },
      async () => '{"message":"Welche Grundstimmung?","palettes":[]}',
    );
    assert.equal(result.needsInput, true);
    assert.equal(result.assistantMessage, "Welche Grundstimmung?");
    assert.equal(result.palettes.length, 0);
  });

  it("returns validated palettes when the model proposes them", async () => {
    let capturedSystem = "";
    const result = await runThemeGeneratorTurn(
      { userMessage: "türkis, hell", scope: "both", variantCount: 2 },
      async ({ system }) => {
        capturedSystem = system;
        return JSON.stringify({
          message: "Bitteschön",
          palettes: [{ label: "T", description: "d", colors: completeColors() }],
        });
      },
    );
    assert.match(capturedSystem, /bis zu 2/);
    assert.equal(result.needsInput, false);
    assert.equal(result.palettes.length, 1);
    assert.equal(result.palettes[0].validation.ok, true);
  });

  it("passes prose through as a question and flags a parse error", async () => {
    const result = await runThemeGeneratorTurn(
      { userMessage: "x", scope: "studio" },
      async () => "Ich habe eine Frage: hell oder dunkel?",
    );
    assert.ok(result.parseError);
    assert.equal(result.needsInput, true);
    // Prose (a likely plain-text question) is shown to the user verbatim.
    assert.match(result.assistantMessage, /hell oder dunkel/);
  });

  it("falls back to a canned message on malformed JSON with no message", async () => {
    const result = await runThemeGeneratorTurn(
      { userMessage: "x", scope: "studio" },
      async () => "{bad json}",
    );
    assert.ok(result.parseError);
    assert.match(result.assistantMessage, /gültige Antwort/);
  });
});
