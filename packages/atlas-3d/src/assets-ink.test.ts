import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildInkAsset,
  INK_ASSET_DEFAULT_TINT,
  INK_ASSET_GROUPS,
  INK_ASSET_KINDS,
  isInkAssetKind,
  isInkTint,
} from "./assets-ink";

test("every asset kind builds non-empty, consistent buffers", () => {
  for (const kind of INK_ASSET_KINDS) {
    const asset = buildInkAsset(kind);
    assert.ok(asset.positions.length > 0, `${kind} has geometry`);
    assert.equal(asset.positions.length % 9, 0, `${kind} is whole triangles`);
    assert.equal(asset.colors.length, asset.positions.length, `${kind} colors match`);
    assert.equal(asset.anim.length, (asset.positions.length / 3) * 4, `${kind} anim matches`);
    assert.ok(asset.outlineWidth > 0);
  }
});

test("no random variation: identical inputs build identical assets", () => {
  const a = buildInkAsset("tree", "teal");
  const b = buildInkAsset("tree", "teal");
  assert.deepEqual(Array.from(a.positions), Array.from(b.positions));
  assert.deepEqual(Array.from(a.colors), Array.from(b.colors));
  assert.deepEqual(Array.from(a.anim), Array.from(b.anim));
});

test("tint changes colors but never the shape", () => {
  const teal = buildInkAsset("tree", "teal");
  const blue = buildInkAsset("tree", "blue");
  assert.deepEqual(Array.from(teal.positions), Array.from(blue.positions));
  assert.notDeepEqual(Array.from(teal.colors), Array.from(blue.colors));
});

test("worldroot towers above every other asset", () => {
  const maxY = (kind: Parameters<typeof buildInkAsset>[0]) => {
    const asset = buildInkAsset(kind);
    let max = -Infinity;
    for (let i = 1; i < asset.positions.length; i += 3) max = Math.max(max, asset.positions[i]);
    return max;
  };
  const rootHeight = maxY("worldroot");
  for (const kind of INK_ASSET_KINDS) {
    if (kind === "worldroot") continue;
    assert.ok(rootHeight > maxY(kind) + 0.8, `worldroot overtops ${kind}`);
  }
});

test("assets carry idle animation except the asteroid body", () => {
  const animAmplitude = (kind: Parameters<typeof buildInkAsset>[0]) => {
    const asset = buildInkAsset(kind);
    let sum = 0;
    for (let i = 0; i < asset.anim.length; i += 4) sum += Math.abs(asset.anim[i]) + Math.abs(asset.anim[i + 2]);
    return sum;
  };
  assert.ok(animAmplitude("worldroot") > 0, "worldroot writhes");
  assert.ok(animAmplitude("tree") > 0, "tree sways");
  assert.ok(animAmplitude("tower") > 0, "tower banner waves");
  assert.equal(animAmplitude("asteroid"), 0, "asteroid tumbles via transform, not vertex anim");
});

test("kind and tint guards", () => {
  assert.ok(isInkAssetKind("worldroot"));
  assert.equal(isInkAssetKind("dragon"), false);
  assert.ok(isInkTint("teal"));
  assert.equal(isInkTint("neon"), false);
  assert.equal(INK_ASSET_DEFAULT_TINT.worldroot, "paper");
});

test("asset groups cover every kind exactly once", () => {
  const grouped = INK_ASSET_GROUPS.flatMap((group) => group.kinds);
  assert.deepEqual([...grouped].sort(), [...INK_ASSET_KINDS].sort());
  assert.equal(new Set(grouped).size, grouped.length, "no kind in two groups");
});
