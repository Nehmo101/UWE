import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitChapterTitle } from "./ai-review-campaign-apply";

describe("splitChapterTitle (pure)", () => {
  it("uses the first heading as title and removes it from the body", () => {
    const { title, body } = splitChapterTitle(
      "# Akt II — Der Sturm zieht auf\n\nDie Karawane erreicht den Pass.\n\n## Szenen\nText.",
    );
    assert.equal(title, "Akt II — Der Sturm zieht auf");
    assert.ok(body.startsWith("Die Karawane"));
    assert.ok(!body.includes("# Akt II"));
    assert.ok(body.includes("## Szenen"));
  });

  it("returns null title when no heading exists", () => {
    const { title, body } = splitChapterTitle("Nur Fließtext ohne Überschrift.");
    assert.equal(title, null);
    assert.equal(body, "Nur Fließtext ohne Überschrift.");
  });

  it("takes the first heading even when it is not on line one", () => {
    const { title } = splitChapterTitle("Vorbemerkung.\n# Später Titel\nRest.");
    assert.equal(title, "Später Titel");
  });

  it("does not treat the next line as title when the heading line is bare", () => {
    // \s+ hätte den Zeilenumbruch geschluckt und „Kein Titel" zum Titel gemacht.
    const { title } = splitChapterTitle("#\nKein Titel.");
    assert.equal(title, null);
  });

  it("stays fast on hostile whitespace input (ReDoS guard)", () => {
    const hostileSpaces = `# a${" ".repeat(50_000)}b`;
    const hostileTabs = `#\t${"\t\t".repeat(25_000)}x`;
    const started = Date.now();
    const spaces = splitChapterTitle(hostileSpaces);
    const tabs = splitChapterTitle(hostileTabs);
    assert.ok(Date.now() - started < 1000, "title split must run in linear time");
    assert.ok(spaces.title?.startsWith("a"));
    assert.equal(tabs.title, "x");
  });
});
