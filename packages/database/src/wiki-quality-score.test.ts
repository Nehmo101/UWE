import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeWikiQualityInsights,
  type WikiQualityReport,
} from "./wiki-quality-service";

function emptyReport(findings: WikiQualityReport["findings"]): WikiQualityReport {
  const counts = {
    unlinked_term: 0,
    thin_page: 0,
    npc_missing_relations: 0,
    location_missing_map: 0,
    quest_missing_status: 0,
    duplicate_alias: 0,
  };
  for (const finding of findings) {
    counts[finding.code] += 1;
  }
  return { worldSlug: "terra", findings, counts };
}

describe("computeWikiQualityInsights", () => {
  it("returns a perfect score when there are no findings", () => {
    const insights = computeWikiQualityInsights("terra", emptyReport([]));
    assert.equal(insights.score, 100);
    assert.equal(insights.grade, "Ausgezeichnet");
    assert.equal(insights.recommendations.length, 0);
  });

  it("lowers the score and emits recommendations by finding type", () => {
    const insights = computeWikiQualityInsights(
      "terra",
      emptyReport([
        {
          id: "1",
          code: "unlinked_term",
          severity: "info",
          message: "foo",
          fixes: [],
        },
        {
          id: "2",
          code: "duplicate_alias",
          severity: "warning",
          message: "bar",
          fixes: [],
        },
      ]),
    );
    assert.equal(insights.score, 93);
    assert.equal(insights.recommendations.length, 2);
    assert.equal(insights.recommendations[0]?.title, "Mehrdeutige Aliase bereinigen");
  });
});
