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
});
