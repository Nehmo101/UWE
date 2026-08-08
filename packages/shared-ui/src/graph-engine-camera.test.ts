// CameraAnimator regressions (Wiki-Graph AAA motion — Round 9 snappiness).

import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMERA_TWEEN_MS,
  CameraAnimator,
  easeOutQuint,
} from "./graph-engine-camera";

test("CAMERA_TWEEN_MS is near-instant (150–200ms Obsidian-like band)", () => {
  assert.ok(CAMERA_TWEEN_MS >= 150 && CAMERA_TWEEN_MS <= 200);
});

test("easeOutQuint is snappier than linear mid-tween", () => {
  assert.equal(easeOutQuint(0), 0);
  assert.equal(easeOutQuint(1), 1);
  // At t=0.5, quint ease-out is well ahead of linear 0.5.
  assert.ok(easeOutQuint(0.5) > 0.9);
});

test("CameraAnimator reaches target by CAMERA_TWEEN_MS and stops", () => {
  const realNow = performance.now.bind(performance);
  let fake = 1000;
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: () => fake,
  });

  try {
    const anim = new CameraAnimator();
    anim.start({ tx: 0, ty: 0, zoom: 1 }, { tx: 100, ty: 0, zoom: 1 });
    assert.equal(anim.isAnimating(), true);

    fake = 1000 + CAMERA_TWEEN_MS / 2;
    const mid = anim.step();
    assert.ok(mid);
    assert.ok(mid.tx > 90); // easeOutQuint mid is near target
    assert.equal(anim.isAnimating(), true);

    fake = 1000 + CAMERA_TWEEN_MS;
    const end = anim.step();
    assert.ok(end);
    assert.equal(end.tx, 100);
    assert.equal(anim.isAnimating(), false);
  } finally {
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: realNow,
    });
  }
});
