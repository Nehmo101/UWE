import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isChromelessStudioPath } from "./studio-chrome";

describe("studio chrome", () => {
  it("lässt Landing, Auth-Routen und Wartung ohne Shell", () => {
    for (const path of [
      "/",
      "/login",
      "/login/callback",
      "/logout",
      "/setup",
      "/maintenance",
      "/forgot-password",
      "/reset-password?token=abc",
    ]) {
      assert.equal(isChromelessStudioPath(path), true, path);
    }
  });

  it("rahmt jede Arbeitsbereichs-Route", () => {
    for (const path of [
      "/worlds",
      "/worlds/terra/wiki",
      "/search",
      "/settings",
      "/admin",
      "/brain",
      "/image-studio/abc/edit",
    ]) {
      assert.equal(isChromelessStudioPath(path), false, path);
    }
  });

  it("verwechselt keine Präfixe", () => {
    // `/logout-report` wäre eine eigene Route und dürfte nicht als Auth-Seite
    // durchgehen, nur weil der Name so anfängt.
    assert.equal(isChromelessStudioPath("/logout-report"), false);
    assert.equal(isChromelessStudioPath("/setup-wizard"), false);
  });
});
