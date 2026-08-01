import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frontmatterWarnings, parseDocument } from "./dialect";
import { resolveCanonicalStatus, stripCanonMarkers } from "./canonical-status";

/** Der Kopf von `pellarhopsenried.md`, unverändert. */
const PELLAR = `---
titel: Pellar Hopsenried
typ: nsc
status: kanon
welt: Terra
haelfte: Aernis
region: Flüsterforst — Ferlor
spezies: Harengon
gesinnung: rechtschaffen gut
lebt: nein
gestorben: 1173-01 · Tag der Asche
kampagnen: [Turm, Himmelsrouten]
tags: [nsc, rolle/buergermeister, ort/ferlor, thema/verantwortung, thema/schweigen]
siehe_auch: [ferlor, fluesterforst, xarza, tag-der-asche, pjampjam]
quelle: [Terra_Weltkanon §Teil X, Himmelsrouten v2 §7.4]
stand: 37.03.1174
---

# Pellar Hopsenried
**Harengon · 47 · Bürgermeister von [[ferlor]] · rechtschaffen gut · †**
`;

describe("parseDocument — der UWE-Dialekt", () => {
  const { frontmatter, body, hadFrontmatter } = parseDocument(PELLAR);

  it("reads the German keys", () => {
    assert.equal(hadFrontmatter, true);
    assert.equal(frontmatter.title, "Pellar Hopsenried");
    assert.equal(frontmatter.type, "nsc");
    assert.equal(frontmatter.status, "kanon");
    assert.equal(frontmatter.world, "Terra");
  });

  it("reads every list", () => {
    assert.deepEqual(frontmatter.campaigns, ["Turm", "Himmelsrouten"]);
    assert.deepEqual(frontmatter.seeAlso, [
      "ferlor",
      "fluesterforst",
      "xarza",
      "tag-der-asche",
      "pjampjam",
    ]);
    assert.equal(frontmatter.tags.length, 5);
    assert.ok(frontmatter.tags.includes("rolle/buergermeister"));
    assert.equal(frontmatter.sources.length, 2);
  });

  it("keeps unknown keys instead of dropping them silently", () => {
    assert.equal(frontmatter.extra.haelfte, "Aernis");
    assert.equal(frontmatter.extra.spezies, "Harengon");
    assert.equal(frontmatter.extra.gesinnung, "rechtschaffen gut");
    assert.equal(frontmatter.extra.lebt, "nein");
    assert.equal(frontmatter.extra.stand, "37.03.1174");
    assert.equal(frontmatter.extra.region, "Flüsterforst — Ferlor");
  });

  it("hands the body over without the frontmatter", () => {
    assert.ok(body.startsWith("# Pellar Hopsenried"));
    assert.ok(!body.includes("titel:"));
  });

  it("still understands the English keys", () => {
    const english = parseDocument("---\ntitle: Ferlor\ntype: location\ntags: a, b\n---\n\nText");
    assert.equal(english.frontmatter.title, "Ferlor");
    assert.equal(english.frontmatter.type, "location");
    assert.deepEqual(english.frontmatter.tags, ["a", "b"]);
  });
});

describe("frontmatterWarnings", () => {
  it("names the unknown keys and a world mismatch", () => {
    const { frontmatter } = parseDocument(PELLAR);
    const warnings = frontmatterWarnings(frontmatter, { worldName: "Valdora", worldSlug: "valdora" });

    assert.equal(warnings.length, 2);
    assert.ok(warnings[0].includes("spezies"));
    assert.ok(warnings[1].includes("Terra"));
  });

  it("stays quiet when the world matches", () => {
    const { frontmatter } = parseDocument("---\ntitel: X\nwelt: Terra\n---\n\nText");
    assert.deepEqual(frontmatterWarnings(frontmatter, { worldName: "Terra", worldSlug: "terra" }), []);
  });
});

describe("resolveCanonicalStatus", () => {
  it("maps the German status words", () => {
    assert.equal(resolveCanonicalStatus("kanon"), "canon");
    assert.equal(resolveCanonicalStatus("Entwurf"), "draft");
    assert.equal(resolveCanonicalStatus("vorschlag"), "idea");
    assert.equal(resolveCanonicalStatus("verworfen"), "discarded");
    assert.equal(resolveCanonicalStatus("überholt"), "deprecated");
    assert.equal(resolveCanonicalStatus("widersprüchlich"), "contradictory");
    assert.equal(resolveCanonicalStatus("nicht kanon"), "non_canon");
    assert.equal(resolveCanonicalStatus("blubb"), null);
    assert.equal(resolveCanonicalStatus(undefined), null);
  });
});

describe("stripCanonMarkers", () => {
  it("takes the diamonds out and reports what they meant", () => {
    assert.deepEqual(stripCanonMarkers("4.3 Vel-Sharaun, der Gebundene Sturm ◆ (RETCON)"), {
      title: "4.3 Vel-Sharaun, der Gebundene Sturm (RETCON)",
      marker: "canon",
    });
    assert.deepEqual(stripCanonMarkers("2.3 Die große Zeitleiste ◇ (Vorschlag)"), {
      title: "2.3 Die große Zeitleiste (Vorschlag)",
      marker: "proposal",
    });
    assert.deepEqual(stripCanonMarkers("6.3 Luftfahrt ◆/◇"), {
      title: "6.3 Luftfahrt /",
      marker: "proposal",
    });
  });

  it("keeps the section numbering — the documents cross-reference by it", () => {
    assert.equal(stripCanonMarkers("7.4 Ferlor, wie es war").title, "7.4 Ferlor, wie es war");
  });

  it("leaves an unmarked heading alone", () => {
    assert.deepEqual(stripCanonMarkers("Kapitel 1: Der Zaunkönig"), {
      title: "Kapitel 1: Der Zaunkönig",
      marker: null,
    });
  });
});
