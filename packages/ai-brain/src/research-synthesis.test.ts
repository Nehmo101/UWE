import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendResearchSources,
  buildResearchSynthesisPrompt,
} from "./research-synthesis";

const SOURCES = [
  { url: "https://example.com/a", title: "Quelle A", snippet: "Auszug A" },
  { url: "https://example.com/b", title: "Quelle B", snippet: "" },
];

describe("research synthesis helpers", () => {
  it("builds a numbered source prompt", () => {
    const prompt = buildResearchSynthesisPrompt("Wie funktioniert X?", SOURCES);
    assert.ok(prompt.includes("Recherche-Frage: Wie funktioniert X?"));
    assert.ok(prompt.includes("[1] Quelle A — https://example.com/a"));
    assert.ok(prompt.includes("Auszug A"));
    assert.ok(prompt.includes("[2] Quelle B — https://example.com/b"));
    assert.ok(prompt.includes("Quellenverweis [n]"));
  });

  it("handles empty results", () => {
    const prompt = buildResearchSynthesisPrompt("Frage", []);
    assert.ok(prompt.includes("(keine Web-Treffer)"));
  });

  it("appends a traceable source list to the report", () => {
    const report = appendResearchSources("# Report\n\nInhalt", SOURCES);
    assert.ok(report.includes("# Report"));
    assert.ok(report.includes("## Quellen"));
    assert.ok(report.includes("1. [Quelle A](https://example.com/a)"));
    assert.ok(report.includes("2. [Quelle B](https://example.com/b)"));
  });

  it("marks empty source lists", () => {
    const report = appendResearchSources("Report", []);
    assert.ok(report.includes("_Keine Web-Treffer gefunden._"));
  });
});
