import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeWorldSlugCookie,
  isWorldSlugShape,
  liveSessionIdFromPathname,
  pickKnownWorldSlug,
  readActiveWorldCookie,
  resolveActiveWorldSlug,
  worldSlugFromPathname,
} from "./active-world";

const KNOWN = ["terra", "aldoria"];

describe("active world — slug aus dem Pfad", () => {
  it("liest den Slug aus jeder Welt-Unterroute", () => {
    assert.equal(worldSlugFromPathname("/worlds/terra"), "terra");
    assert.equal(worldSlugFromPathname("/worlds/terra/wiki"), "terra");
    assert.equal(worldSlugFromPathname("/worlds/terra/sessions/abc/live"), "terra");
    assert.equal(worldSlugFromPathname("/worlds/terra?tab=x"), "terra");
  });

  it("gibt außerhalb einer Welt null zurück", () => {
    assert.equal(worldSlugFromPathname("/worlds"), null);
    assert.equal(worldSlugFromPathname("/search"), null);
    assert.equal(worldSlugFromPathname("/"), null);
  });

  it("weist Segmente ab, die keine Slug-Form haben", () => {
    assert.equal(worldSlugFromPathname("/worlds/Terra"), null);
    assert.equal(worldSlugFromPathname("/worlds/..%2Fetc"), null);
    assert.equal(isWorldSlugShape("terra-nova"), true);
    assert.equal(isWorldSlugShape("-terra"), false);
    assert.equal(isWorldSlugShape(""), false);
  });
});

describe("active world — Auflösung", () => {
  it("der Pfad schlägt das Gemerkte", () => {
    assert.equal(
      resolveActiveWorldSlug({
        pathname: "/worlds/aldoria/wiki",
        rememberedSlug: "terra",
        knownSlugs: KNOWN,
      }),
      "aldoria",
    );
  });

  it("hält die Welt außerhalb ihrer Routen fest", () => {
    assert.equal(
      resolveActiveWorldSlug({ pathname: "/search", rememberedSlug: "terra", knownSlugs: KNOWN }),
      "terra",
    );
    assert.equal(
      resolveActiveWorldSlug({ pathname: "/settings", rememberedSlug: null, knownSlugs: KNOWN }),
      null,
    );
  });

  it("akzeptiert nur Welten, die es gibt", () => {
    assert.equal(
      resolveActiveWorldSlug({ pathname: "/search", rememberedSlug: "weg", knownSlugs: KNOWN }),
      null,
    );
    assert.equal(
      resolveActiveWorldSlug({ pathname: "/worlds/weg/wiki", rememberedSlug: null, knownSlugs: KNOWN }),
      null,
    );
    assert.equal(pickKnownWorldSlug("terra", KNOWN), "terra");
    assert.equal(pickKnownWorldSlug("terra", []), null);
    assert.equal(pickKnownWorldSlug(null, KNOWN), null);
  });
});

describe("active world — Cookie", () => {
  it("liest geprüfte Werte und verwirft alles andere", () => {
    assert.equal(readActiveWorldCookie(encodeURIComponent("terra"), KNOWN), "terra");
    assert.equal(readActiveWorldCookie("terra", KNOWN), "terra");
    assert.equal(readActiveWorldCookie("weg", KNOWN), null);
    assert.equal(readActiveWorldCookie("%E0%A4%A", KNOWN), null);
    assert.equal(readActiveWorldCookie(undefined, KNOWN), null);
  });

  it("prüft die Slug-Form auch ohne Weltliste (/portal-Redirect)", () => {
    assert.equal(decodeWorldSlugCookie(encodeURIComponent("terra")), "terra");
    // Ohne Weltliste bleibt die Existenzprüfung dem Aufrufer überlassen — die
    // Form muss aber stimmen, sonst geht jeder Cookie-Inhalt an die Datenbank.
    assert.equal(decodeWorldSlugCookie("noch-nicht-geladen"), "noch-nicht-geladen");
    assert.equal(decodeWorldSlugCookie("../../etc/passwd"), null);
    assert.equal(decodeWorldSlugCookie("Terra"), null);
    assert.equal(decodeWorldSlugCookie("a".repeat(200)), null);
    assert.equal(decodeWorldSlugCookie("%E0%A4%A"), null);
    assert.equal(decodeWorldSlugCookie(""), null);
    assert.equal(decodeWorldSlugCookie(undefined), null);
  });
});

describe("active world — Live-Session", () => {
  it("erkennt die Live-Route und nur sie", () => {
    assert.equal(liveSessionIdFromPathname("/worlds/terra/sessions/s1/live"), "s1");
    assert.equal(liveSessionIdFromPathname("/worlds/terra/sessions/s1"), null);
    assert.equal(liveSessionIdFromPathname("/worlds/terra/sessions/s1/review"), null);
  });
});
