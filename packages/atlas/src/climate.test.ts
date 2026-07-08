import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CLIMATE_ZONES, climateBands, climateZoneAt } from "./climate";

describe("climate zones", () => {
  it("maps latitude north→south across all zones and clamps", () => {
    assert.equal(climateZoneAt(0).key, "arktisch");
    assert.equal(climateZoneAt(0.999).key, "tropisch");
    assert.equal(climateZoneAt(1).key, "tropisch", "y=1 clamps into the last band");
    assert.equal(climateZoneAt(-5).key, "arktisch");
    assert.equal(climateZoneAt(99).key, "tropisch");
    assert.equal(climateZoneAt(0.5).key, "gemaessigt", "map centre is temperate");
  });

  it("bands cover [0,1] seamlessly, one per zone, in order", () => {
    const bands = climateBands();
    assert.equal(bands.length, CLIMATE_ZONES.length);
    assert.equal(bands[0]!.y0, 0);
    assert.equal(bands[bands.length - 1]!.y1, 1);
    for (let i = 1; i < bands.length; i++) {
      assert.equal(bands[i]!.y0, bands[i - 1]!.y1, `band ${i} starts where ${i - 1} ends`);
      assert.equal(bands[i]!.zone.key, CLIMATE_ZONES[i]!.key);
    }
    // Every band's midpoint maps back to its own zone.
    for (const b of bands) {
      assert.equal(climateZoneAt((b.y0 + b.y1) / 2).key, b.zone.key);
    }
  });
});
