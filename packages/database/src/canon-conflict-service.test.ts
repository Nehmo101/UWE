import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGenericCanonConflictFindings,
  checkDeprecatedOrNonCanonPublished,
  checkNpcDeathStatusConflicts,
  checkWorldSpecificCanonRules,
  type CanonConflictPageInput,
} from "./canon-conflict-service";

function page(overrides: Partial<CanonConflictPageInput> & Pick<CanonConflictPageInput, "id" | "title">): CanonConflictPageInput {
  return {
    id: overrides.id,
    title: overrides.title,
    slug: overrides.slug ?? overrides.id,
    type: overrides.type ?? "lore",
    visibility: overrides.visibility ?? "dm_only",
    canonicalStatus: overrides.canonicalStatus ?? "draft",
    content: overrides.content ?? "",
  };
}

describe("canon conflict service", () => {
  it("flags deprecated content published to portal", () => {
    const findings = checkDeprecatedOrNonCanonPublished("demo", [
      page({
        id: "p1",
        title: "Alte Lore",
        canonicalStatus: "deprecated",
        visibility: "player_visible",
      }),
    ]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.code, "deprecated_player_visible");
  });

  it("flags NPC marked dead but player visible", () => {
    const findings = checkNpcDeathStatusConflicts("demo", [
      page({
        id: "npc1",
        title: "Gareth",
        type: "npc",
        visibility: "player_visible",
        content: "Gareth ist tot seit Session 3.",
      }),
    ]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.code, "npc_status_conflict");
  });

  it("applies terra tower rule only for terra world", () => {
    const input = page({
      id: "d1",
      title: "Magister Turm Ebene 2",
      type: "dungeon_level",
      content: "Diese eckige quadratische Ebene ...",
    });

    assert.equal(checkWorldSpecificCanonRules("other", [input]).length, 0);
    assert.equal(checkWorldSpecificCanonRules("terra", [input]).length, 1);
  });

  it("merges generic findings", () => {
    const findings = buildGenericCanonConflictFindings("demo", [
      page({
        id: "p2",
        title: "Draft Handout",
        canonicalStatus: "draft",
        visibility: "public",
      }),
    ]);

    assert.ok(findings.some((entry) => entry.code === "non_canon_portal_published"));
  });
});
