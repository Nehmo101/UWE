import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWikiQualityFindings,
  countWikiQualityFindings,
  type WikiQualityFinding,
  type WikiQualityPageInput,
} from "./wiki-quality-service";

function makePage(overrides: Partial<WikiQualityPageInput>): WikiQualityPageInput {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: "Seite",
    slug: "seite",
    type: "lore",
    aliases: [],
    questStatus: null,
    contentText: "",
    linkedPageTypes: [],
    mapAssetCount: 0,
    ...overrides,
  };
}

function codes(findings: WikiQualityFinding[]): string[] {
  return findings.map((finding) => finding.code);
}

describe("wiki-quality findings", () => {
  it("flags a narrative page with almost no prose as thin", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "a", title: "Validori", type: "npc", contentText: "Ein Wächter.", linkedPageTypes: ["faction"] }),
    ]);
    assert.ok(findings.some((f) => f.code === "thin_page" && f.pageId === "a"));
  });

  it("does not flag a rich narrative page as thin", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({
        id: "a",
        type: "lore",
        contentText: "x".repeat(400),
      }),
    ]);
    assert.ok(!findings.some((f) => f.code === "thin_page"));
  });

  it("does not run the thin-page check on structural page types", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "s", type: "session", contentText: "" }),
      makePage({ id: "h", type: "handout", contentText: "" }),
    ]);
    assert.ok(!findings.some((f) => f.code === "thin_page"));
  });

  it("flags an NPC without a faction or place link", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "npc", type: "npc", title: "Grimm", contentText: "x".repeat(400) }),
    ]);
    const finding = findings.find((f) => f.code === "npc_missing_relations");
    assert.ok(finding);
    assert.equal(finding.severity, "warning");
  });

  it("accepts an NPC linked to a location", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({
        id: "npc",
        type: "npc",
        contentText: "x".repeat(400),
        linkedPageTypes: ["location"],
      }),
    ]);
    assert.ok(!findings.some((f) => f.code === "npc_missing_relations"));
  });

  it("flags a location without a map, but not one that has a map asset", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "l1", type: "location", title: "Hafen", contentText: "x".repeat(400) }),
      makePage({ id: "l2", type: "region", title: "Nordmark", contentText: "x".repeat(400), mapAssetCount: 1 }),
    ]);
    const missing = findings.filter((f) => f.code === "location_missing_map");
    assert.equal(missing.length, 1);
    assert.equal(missing[0].pageId, "l1");
  });

  it("flags a quest page without a lifecycle status", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "q1", type: "quest", title: "Die Suche", contentText: "x".repeat(400), questStatus: null }),
      makePage({ id: "q2", type: "quest", title: "Erledigt", contentText: "x".repeat(400), questStatus: "open" }),
    ]);
    const missing = findings.filter((f) => f.code === "quest_missing_status");
    assert.equal(missing.length, 1);
    assert.equal(missing[0].pageId, "q1");
  });

  it("detects an unlinked mention of another page's title", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "a", title: "Validori", slug: "validori", contentText: "x".repeat(400) }),
      makePage({
        id: "b",
        title: "Chronik",
        slug: "chronik",
        contentText: `${"x".repeat(400)} Die Stadt Validori liegt am Meer.`,
      }),
    ]);
    const unlinked = findings.find((f) => f.code === "unlinked_term" && f.pageId === "b");
    assert.ok(unlinked);
    assert.match(unlinked.message, /Validori/);
  });

  it("does not flag an already-linked mention as unlinked", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "a", title: "Validori", slug: "validori", contentText: "x".repeat(400) }),
      makePage({
        id: "b",
        title: "Chronik",
        slug: "chronik",
        contentText: `${"x".repeat(400)} Die Stadt [[Validori]] liegt am Meer.`,
      }),
    ]);
    assert.ok(!findings.some((f) => f.code === "unlinked_term" && f.pageId === "b"));
  });

  it("flags an ambiguous alias shared across two pages", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "a", title: "Rote Hand", slug: "rote-hand", contentText: "x".repeat(400) }),
      makePage({ id: "b", title: "Söldnergilde", slug: "soeldnergilde", aliases: ["Rote Hand"], contentText: "x".repeat(400) }),
    ]);
    const dup = findings.find((f) => f.code === "duplicate_alias");
    assert.ok(dup);
    assert.match(dup.message, /Rote Hand/);
  });

  it("does not report a duplicate_alias when no alias is involved", () => {
    // Two pages sharing a title (no aliases) is duplicate_name territory, not ours.
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "a", title: "Turm", slug: "turm-1", contentText: "x".repeat(400) }),
      makePage({ id: "b", title: "Turm", slug: "turm-2", contentText: "x".repeat(400) }),
    ]);
    assert.ok(!findings.some((f) => f.code === "duplicate_alias"));
  });

  it("sorts warnings before infos and counts by code", () => {
    const findings = buildWikiQualityFindings("terra", [
      makePage({ id: "npc", type: "npc", title: "Grimm", contentText: "x".repeat(400) }),
      makePage({ id: "loc", type: "location", title: "Hafen", contentText: "x".repeat(400) }),
    ]);
    // npc_missing_relations (warning) must sort before location_missing_map (info).
    const firstWarning = findings.findIndex((f) => f.severity === "warning");
    const firstInfo = findings.findIndex((f) => f.severity === "info");
    assert.ok(firstWarning !== -1 && firstInfo !== -1);
    assert.ok(firstWarning < firstInfo);

    const counts = countWikiQualityFindings(findings);
    assert.equal(counts.npc_missing_relations, 1);
    assert.equal(counts.location_missing_map, 1);
    assert.equal(counts.thin_page, 0);
  });

  it("assigns stable finding ids", () => {
    const pages = [makePage({ id: "q1", type: "quest", title: "Q", contentText: "x".repeat(400) })];
    const a = buildWikiQualityFindings("terra", pages);
    const b = buildWikiQualityFindings("terra", pages);
    assert.deepEqual(codes(a), codes(b));
    assert.deepEqual(a.map((f) => f.id), b.map((f) => f.id));
  });
});
