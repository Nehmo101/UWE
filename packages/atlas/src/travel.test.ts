import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planTravelRoute, TERRAIN_TRAVEL_FACTOR } from "./travel";

describe("planTravelRoute", () => {
  it("returns an empty plan for < 2 points", () => {
    assert.deepEqual(planTravelRoute([]), { totalLeagues: 0, effortLeagues: 0, days: 0, camps: [], segments: [] });
    assert.equal(planTravelRoute([[0.5, 0.5]]).days, 0);
  });

  it("flat ground: distance = effort, days = effort / budget", () => {
    // 0.4 normalised ⇒ 40 leagues; at 8/day ⇒ exactly 5 days, 4 camps
    // (the 5th day ends at the destination, no camp there).
    const plan = planTravelRoute([[0.1, 0.5], [0.5, 0.5]]);
    assert.ok(Math.abs(plan.totalLeagues - 40) < 1e-9);
    assert.ok(Math.abs(plan.effortLeagues - 40) < 1e-9);
    assert.equal(plan.days, 5);
    assert.equal(plan.camps.length, 4, `camps: ${JSON.stringify(plan.camps)}`);
    // Camps sit at each full-day mark along the straight segment.
    assert.ok(Math.abs(plan.camps[0]![0] - 0.18) < 1e-9);
    assert.ok(Math.abs(plan.camps[3]![0] - 0.42) < 1e-9);
  });

  it("terrain weighting: mountains double the effort", () => {
    const cells: Record<string, string> = {};
    for (let c = 0; c < 32; c++) for (let r = 0; r < 20; r++) cells[`${c},${r}`] = "mountains";
    const layer = { cols: 32, rows: 20, cells };
    const flat = planTravelRoute([[0.1, 0.5], [0.5, 0.5]]);
    const rough = planTravelRoute([[0.1, 0.5], [0.5, 0.5]], { layer });
    assert.ok(Math.abs(rough.effortLeagues - flat.effortLeagues * TERRAIN_TRAVEL_FACTOR.mountains!) < 1e-9);
    assert.ok(rough.days > flat.days);
    assert.ok(rough.camps.length > flat.camps.length, "more camps on slower terrain");
  });

  it("multi-leg routes sum segments and stay deterministic", () => {
    const pts: [number, number][] = [[0.1, 0.2], [0.3, 0.2], [0.3, 0.6], [0.7, 0.6]];
    const a = planTravelRoute(pts, { leaguesPerDay: 10 });
    const b = planTravelRoute(pts, { leaguesPerDay: 10 });
    assert.deepEqual(a, b);
    assert.equal(a.segments.length, 3);
    const sum = a.segments.reduce((acc, s) => acc + s.leagues, 0);
    assert.ok(Math.abs(sum - a.totalLeagues) < 1e-9);
    assert.ok(a.days >= a.effortLeagues / 10, "days round up");
  });

  it("respects custom budget and scale", () => {
    const plan = planTravelRoute([[0, 0.5], [1, 0.5]], { leaguesPerDay: 25, scaleLeagues: 50 });
    assert.ok(Math.abs(plan.totalLeagues - 50) < 1e-9);
    assert.equal(plan.days, 2);
    assert.equal(plan.camps.length, 1, "one camp after day 1");
    assert.ok(Math.abs(plan.camps[0]![0] - 0.5) < 1e-9, "camp at the halfway point");
  });
});
