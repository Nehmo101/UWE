import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createSecurityFixture, type SecurityFixture } from "./fixtures/security-fixture";
import { PRIVATE_LEAK_MARKERS, SECURITY_MARKERS } from "./markers";
import {
  formatLeakReport,
  scanPlayerViewForDmLeaks,
  scanPublicPortalForLeaks,
  scanTextForPrivateMarkers,
} from "./public-leak-scanner";

describe("public leak scanner", () => {
  let fixture: SecurityFixture;

  before(async () => {
    fixture = await createSecurityFixture();
  });

  after(async () => {
    await fixture.cleanup();
  });

  it("detects private markers in arbitrary text", () => {
    const findings = scanTextForPrivateMarkers(
      `safe ${SECURITY_MARKERS.DM_ONLY} tail`,
      "unit-test",
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.marker, SECURITY_MARKERS.DM_ONLY);
  });

  it("does not flag allowed public markers", () => {
    const findings = scanTextForPrivateMarkers(SECURITY_MARKERS.PUBLIC, "unit-test");
    assert.equal(findings.length, 0);
  });

  it("finds no private marker leaks on anonymous portal paths", async () => {
    const result = await scanPublicPortalForLeaks(fixture.repo, fixture.content);

    assert.equal(
      result.findings.length,
      0,
      `Public portal leak detected:\n${formatLeakReport(result)}\nSources: ${result.scannedSources.join(", ")}`,
    );
  });

  it("fails when dm_only content would leak (regression guard)", async () => {
    const poisoned = JSON.stringify({
      title: "Leak",
      content: SECURITY_MARKERS.DM_ONLY,
    });

    const findings = scanTextForPrivateMarkers(poisoned, "regression");
    assert.ok(findings.some((finding) => finding.marker === SECURITY_MARKERS.DM_ONLY));
    assert.ok(PRIVATE_LEAK_MARKERS.includes(SECURITY_MARKERS.DM_ONLY));
  });

  it("does not expose dm_only markers to authenticated players", async () => {
    const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
      userId: fixture.users.player.id,
    });
    assert.ok(ctx);

    const result = await scanPlayerViewForDmLeaks(
      fixture.auth,
      fixture.repo,
      ctx!,
      fixture.content,
    );

    assert.equal(
      result.findings.length,
      0,
      `Player view dm_only leak:\n${formatLeakReport(result)}`,
    );
  });

  it("allows public marker on anonymous portal page fetch", async () => {
    const page = await fixture.repo.getPublicPageForPortal(
      fixture.content.publicWorldSlug,
      fixture.content.slugs.publicPage,
    );
    assert.ok(page);
    const text = page.contentBlocks.map((block) => block.content).join("\n");
    assert.ok(text.includes(SECURITY_MARKERS.PUBLIC));
    assert.ok(!text.includes(SECURITY_MARKERS.DM_ONLY));
  });
});
