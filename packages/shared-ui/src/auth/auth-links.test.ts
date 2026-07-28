import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readPublicAppUrls, resolveAuthLinks } from "./auth-links";

describe("auth-links", () => {
  it("falls back to local dev URLs when env vars are unset", () => {
    const urls = readPublicAppUrls({});
    assert.equal(urls.studioBaseUrl, "http://localhost:3000");
    assert.equal(urls.portalBaseUrl, "http://localhost:3001");
  });

  it("uses explicit NEXT_PUBLIC_* URLs when set", () => {
    const urls = readPublicAppUrls({
      NEXT_PUBLIC_STUDIO_URL: "https://studio.example.org",
      NEXT_PUBLIC_PORTAL_URL: "https://wiki.example.org",
    });
    assert.equal(urls.studioBaseUrl, "https://studio.example.org");
    assert.equal(urls.portalBaseUrl, "https://wiki.example.org");
  });

  it("derives cross-app URLs from PUBLIC_BASE_URL when explicit URLs are missing", () => {
    const urls = readPublicAppUrls({
      PUBLIC_BASE_URL: "https://uwe.example.org",
    });
    assert.equal(urls.studioBaseUrl, "https://uwe.example.org/studio");
    assert.equal(urls.portalBaseUrl, "https://uwe.example.org/portal");
  });

  it("derives portal URL at domain root when PORTAL_PATH=/", () => {
    const urls = readPublicAppUrls({
      PUBLIC_BASE_URL: "https://uwe.example.org",
      PORTAL_PATH: "/",
    });
    assert.equal(urls.portalBaseUrl, "https://uwe.example.org");
  });

  it("links from Studio landing to Portal with absolute URL when logged in", () => {
    const links = resolveAuthLinks({
      isLoggedIn: true,
      currentApp: "studio",
      env: {},
    });
    assert.equal(links.portalHref, "http://localhost:3001/portal");
    assert.equal(links.studioHref, "/studio");
  });

  it("does not double-append /portal when portal base already includes mount path", () => {
    const links = resolveAuthLinks({
      isLoggedIn: true,
      currentApp: "studio",
      env: { PUBLIC_BASE_URL: "https://uwe.example.org" },
    });
    assert.equal(links.portalHref, "https://uwe.example.org/portal");
  });

  it("links to portal entry on root-hosted unified deployment", () => {
    const links = resolveAuthLinks({
      isLoggedIn: true,
      currentApp: "studio",
      env: { PUBLIC_BASE_URL: "https://uwe.example.org", PORTAL_PATH: "/" },
    });
    assert.equal(links.portalHref, "https://uwe.example.org/portal");
  });

  it("links to portal auth hub on split-hostname deployment", () => {
    const links = resolveAuthLinks({
      isLoggedIn: true,
      currentApp: "studio",
      env: {
        PUBLIC_APP_URL: "https://uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://uwe.example",
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
      },
    });
    assert.equal(links.portalHref, "https://uwe.example/auth/worlds");
    assert.equal(links.studioHref, "/worlds");
  });

  it("links to studio dashboard from portal on split-hostname deployment", () => {
    const links = resolveAuthLinks({
      isLoggedIn: true,
      currentApp: "portal",
      env: {
        PUBLIC_APP_URL: "https://uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://uwe.example",
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
      },
    });
    assert.equal(links.studioHref, "https://studio.uwe.example/worlds");
  });

  it("links from Studio landing to Portal login when logged out", () => {
    const links = resolveAuthLinks({
      isLoggedIn: false,
      currentApp: "studio",
      env: {},
    });
    assert.equal(links.portalHref, "http://localhost:3001/login");
    assert.equal(links.studioHref, "/login");
  });

  it("keeps same-app links relative on Portal", () => {
    const links = resolveAuthLinks({
      isLoggedIn: true,
      currentApp: "portal",
      env: {},
    });
    assert.equal(links.portalHref, "/portal");
    assert.equal(links.studioHref, "http://localhost:3000/studio");
  });
});
