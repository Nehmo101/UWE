import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLegacyPathRedirect } from "./legacy-path-redirects";

const splitEnv = {
  PUBLIC_APP_URL: "https://uweanddragons.org",
  NEXT_PUBLIC_PORTAL_URL: "https://uweanddragons.org",
  NEXT_PUBLIC_STUDIO_URL: "https://studio.uweanddragons.org",
};

describe("legacy path redirects", () => {
  it("redirects /studio/* on Portal to Studio subdomain", () => {
    const worlds = resolveLegacyPathRedirect("/studio/worlds", "portal", splitEnv);
    assert.ok(worlds);
    assert.equal(worlds.external, true);
    assert.equal(worlds.destination, "https://studio.uweanddragons.org/worlds");

    const root = resolveLegacyPathRedirect("/studio", "portal", splitEnv);
    assert.ok(root);
    assert.equal(root.destination, "https://studio.uweanddragons.org");
  });

  it("redirects legacy /portal/* on Portal root to canonical routes", () => {
    const entry = resolveLegacyPathRedirect("/portal", "portal", splitEnv);
    assert.ok(entry);
    assert.equal(entry.external, false);
    assert.equal(entry.destination, "/auth/worlds");

    const worlds = resolveLegacyPathRedirect("/portal/worlds/terra", "portal", splitEnv);
    assert.ok(worlds);
    assert.equal(worlds.destination, "/worlds/terra");
  });

  it("strips /studio prefix on Studio subdomain", () => {
    const brain = resolveLegacyPathRedirect("/studio/brain", "studio", splitEnv);
    assert.ok(brain);
    assert.equal(brain.external, false);
    assert.equal(brain.destination, "/brain");
  });

  it("does not redirect in unified-path deployments", () => {
    const unified = {
      PUBLIC_APP_URL: "https://uwe.example.org",
      STUDIO_PATH: "/studio",
      PORTAL_PATH: "/",
    };
    assert.equal(resolveLegacyPathRedirect("/studio/worlds", "portal", unified), null);
    assert.equal(resolveLegacyPathRedirect("/portal/worlds", "portal", unified), null);
  });
});
