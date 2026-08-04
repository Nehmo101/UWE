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
    canonicalStatus: overrides.canonicalStatus ?? "draft",
    // Die Sichtbarkeits-Checks greifen nur bei freigegebenen Seiten — die
    // Fixtures sind deshalb standardmäßig freigegeben.
    portalReleased: overrides.portalReleased ?? true,
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

  it("skips visibility findings for unreleased pages", () => {
    const unreleased = [
      page({
        id: "p9",
        title: "Verstecktes Kampagnenbuch",
        canonicalStatus: "deprecated",
        portalReleased: false,
      }),
      page({
        id: "npc9",
        title: "Toter NPC im Studio",
        type: "npc",
        content: "Er ist tot.",
        portalReleased: false,
      }),
    ];

    assert.equal(checkDeprecatedOrNonCanonPublished("demo", unreleased).length, 0);
    assert.equal(checkNpcDeathStatusConflicts("demo", unreleased).length, 0);
  });

  it("merges generic findings", () => {
    const findings = buildGenericCanonConflictFindings("demo", [
      page({
        id: "p2",
        title: "Draft Handout",
        canonicalStatus: "draft",
      }),
    ]);

    assert.ok(findings.some((entry) => entry.code === "non_canon_portal_published"));
  });
});
