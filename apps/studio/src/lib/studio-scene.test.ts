import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isChromelessStudioPath } from "./studio-chrome";
import { hasStudioSceneBand, studioSceneBandPaths } from "./studio-scene";

describe("studio scene band", () => {
  it("trägt die Bühne auf jedem Einstieg", () => {
    for (const path of studioSceneBandPaths) {
      assert.equal(hasStudioSceneBand(path), true, path);
    }
  });

  it("lässt die Arbeitsflächen ruhig", () => {
    // Der eigentliche Zweck der Regel: hinter einem Editor, einer Job-Liste
    // oder dem Image Studio läuft kein Video.
    for (const path of [
      "/worlds/terra/wiki",
      "/worlds/terra/pages/burg-schwarzfels",
      "/image-studio/abc/edit",
      "/jobs",
      "/settings",
      "/admin/ai-gateway",
      "/import",
    ]) {
      assert.equal(hasStudioSceneBand(path), false, path);
    }
  });

  it("erkennt dieselbe Seite mit Query und Schrägstrich", () => {
    assert.equal(hasStudioSceneBand("/worlds/"), true);
    assert.equal(hasStudioSceneBand("/worlds?neu=1"), true);
  });

  it("verwechselt keine Präfixe", () => {
    // `/brainstorm` fängt an wie `/brain` und ist eine andere Seite.
    assert.equal(hasStudioSceneBand("/brainstorm"), false);
    assert.equal(hasStudioSceneBand("/worlds-archiv"), false);
  });

  it("verlangt die Bühne nie auf einer rahmenlosen Route", () => {
    // Ohne Shell gibt es kein <main>, in dem das Band sitzen könnte — eine
    // Route in beiden Listen wäre eine Bühne, die nie rendert.
    for (const path of studioSceneBandPaths) {
      assert.equal(isChromelessStudioPath(path), false, path);
    }
  });
});
