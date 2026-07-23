import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildInkAsset,
  GLOBE_ONLY_ASSET_KINDS,
  INK_ASSET_DEFAULT_TINT,
  INK_ASSET_GROUPS,
  INK_ASSET_KINDS,
  INK_ASSET_LABELS,
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

const BATCH2_KINDS = ["fels", "busch", "bruecke", "muehle", "hafen", "portal", "obelisk", "mond"] as const;

test("batch-2 kinds build geometry with anim buffers", () => {
  for (const kind of BATCH2_KINDS) {
    const asset = buildInkAsset(kind);
    assert.ok(asset.positions.length > 0, `${kind} has geometry`);
    assert.equal(asset.anim.length, (asset.positions.length / 3) * 4, `${kind} anim matches`);
  }
});

test("batch-2 idle animation: busch/muehle/portal move, mond orbits via transform", () => {
  const animAmplitude = (kind: Parameters<typeof buildInkAsset>[0]) => {
    const asset = buildInkAsset(kind);
    let sum = 0;
    for (let i = 0; i < asset.anim.length; i += 4) {
      sum += Math.abs(asset.anim[i]) + Math.abs(asset.anim[i + 1]) + Math.abs(asset.anim[i + 2]);
    }
    return sum;
  };
  assert.ok(animAmplitude("busch") > 0, "busch wippt");
  assert.ok(animAmplitude("muehle") > 0, "muehle-fluegel wippen");
  assert.ok(animAmplitude("portal") > 0, "portal pulsiert");
  assert.equal(animAmplitude("mond"), 0, "mond kreist per transform, nicht per vertex-anim");
});

test("globe-only asset kinds contain asteroid, mond and kometenstein", () => {
  assert.deepEqual([...GLOBE_ONLY_ASSET_KINDS], ["asteroid", "mond", "kometenstein"]);
  for (const kind of GLOBE_ONLY_ASSET_KINDS) {
    assert.ok(isInkAssetKind(kind), `${kind} is a valid kind`);
  }
});

test("asset groups cover every kind exactly once", () => {
  const grouped = INK_ASSET_GROUPS.flatMap((group) => group.kinds);
  assert.deepEqual([...grouped].sort(), [...INK_ASSET_KINDS].sort());
  assert.equal(new Set(grouped).size, grouped.length, "no kind in two groups");
});

const BATCH3_KINDS = [
  "tanne",
  "palme",
  "pilzhain",
  "kristalle",
  "toterbaum",
  "huette",
  "brunnen",
  "zelt",
  "leuchtturm",
  "statue",
  "runenstein",
  "schrein",
  "wolkeninsel",
  "luftschiff",
  "boot",
  "seerosen",
] as const;

test("batch-3 kinds build geometry with matching anim buffers", () => {
  for (const kind of BATCH3_KINDS) {
    const asset = buildInkAsset(kind);
    assert.ok(asset.positions.length > 0, `${kind} has geometry`);
    assert.equal(asset.positions.length % 9, 0, `${kind} is whole triangles`);
    assert.equal(asset.anim.length, (asset.positions.length / 3) * 4, `${kind} anim matches`);
  }
});

test("batch-3 idle animation: bewegliche Kinds haben Amplitude", () => {
  const animAmplitude = (kind: Parameters<typeof buildInkAsset>[0]) => {
    const asset = buildInkAsset(kind);
    let sum = 0;
    for (let i = 0; i < asset.anim.length; i += 4) {
      sum += Math.abs(asset.anim[i]) + Math.abs(asset.anim[i + 1]) + Math.abs(asset.anim[i + 2]);
    }
    return sum;
  };
  for (const kind of ["palme", "boot", "luftschiff", "wolkeninsel", "leuchtturm"] as const) {
    assert.ok(animAmplitude(kind) > 0, `${kind} bewegt sich`);
  }
});

test("batch-3 himmel kinds float above the ground via geometry", () => {
  for (const kind of ["wolkeninsel", "luftschiff"] as const) {
    const asset = buildInkAsset(kind);
    let minY = Infinity;
    for (let i = 1; i < asset.positions.length; i += 3) minY = Math.min(minY, asset.positions[i]);
    assert.ok(minY >= 0.4, `${kind} floats (lowest vertex at ${minY})`);
  }
});

test("batch-3 kinds are registered with labels, default tints and groups", () => {
  for (const kind of BATCH3_KINDS) {
    assert.ok(isInkAssetKind(kind), `${kind} is a valid kind`);
    assert.ok(isInkTint(INK_ASSET_DEFAULT_TINT[kind]), `${kind} has a valid default tint`);
    assert.equal(GLOBE_ONLY_ASSET_KINDS.includes(kind), false, `${kind} is placeable everywhere`);
  }
  for (const kind of INK_ASSET_KINDS) {
    assert.ok(INK_ASSET_LABELS[kind]?.length > 0, `${kind} has a label`);
  }
  const gewaesser = INK_ASSET_GROUPS.find((group) => group.key === "gewaesser");
  assert.ok(gewaesser, "gewaesser group exists");
  assert.equal(gewaesser?.label, "Gewässer");
  assert.ok(gewaesser?.kinds.includes("boot"), "boot bleibt in gewaesser");
  assert.ok(gewaesser?.kinds.includes("seerosen"), "seerosen bleibt in gewaesser");
});

const BATCH4_KINDS = [
  "eiche",
  "weide",
  "birke",
  "windbaum",
  "farn",
  "schilf",
  "bluetenbaum",
  "felsnadel",
  "bogenfels",
  "geysir",
  "kaktus",
  "duenengras",
  "leuchtpilz",
  "taverne",
  "schmiede",
  "scheune",
  "windrad",
  "holzturm",
  "marktstand",
  "kapelle",
  "ruine",
  "speicher",
  "stall",
  "torbogen",
  "wassermuehle",
  "lagerfeuer",
  "karren",
  "zeltlager",
  "bienenstoecke",
  "weltenschildkroete",
  "drachenschaedel",
  "schwebestein",
  "riesenschwert",
  "steinkreis",
  "weltenauge",
  "himmelsleiter",
  "titanenhand",
  "kristallportal",
  "grabmal",
  "wurzelthron",
  "segelschiff",
  "fischerhuette",
  "wrack",
  "wasserfall",
  "floss",
  "eisberg",
  "korallen",
  "sternwarte",
  "ballon",
  "sturmwolke",
  "kometenstein",
] as const;

test("batch-4 kinds build geometry with matching anim buffers", () => {
  for (const kind of BATCH4_KINDS) {
    const asset = buildInkAsset(kind);
    assert.ok(asset.positions.length > 0, `${kind} has geometry`);
    assert.equal(asset.positions.length % 9, 0, `${kind} is whole triangles`);
    assert.equal(asset.colors.length, asset.positions.length, `${kind} colors match`);
    assert.equal(asset.anim.length, (asset.positions.length / 3) * 4, `${kind} anim matches`);
    assert.ok(asset.outlineWidth > 0, `${kind} has outline width`);
  }
});

test("batch-4 kinds are registered with labels, default tints and groups", () => {
  const grouped = INK_ASSET_GROUPS.flatMap((group) => group.kinds);
  for (const kind of BATCH4_KINDS) {
    assert.ok(isInkAssetKind(kind), `${kind} is a valid kind`);
    assert.ok(INK_ASSET_LABELS[kind]?.length > 0, `${kind} has a label`);
    assert.ok(isInkTint(INK_ASSET_DEFAULT_TINT[kind]), `${kind} has a valid default tint`);
    assert.equal(grouped.filter((entry) => entry === kind).length, 1, `${kind} is grouped exactly once`);
  }
});

test("weltenschildkroete: flach genug, riesige Grundfläche, Kopf/Fähnchen wippen", () => {
  const turtle = buildInkAsset("weltenschildkroete");
  let maxY = -Infinity;
  let footprint = 0;
  for (let i = 0; i < turtle.positions.length; i += 3) {
    footprint = Math.max(footprint, Math.abs(turtle.positions[i]), Math.abs(turtle.positions[i + 2]));
    maxY = Math.max(maxY, turtle.positions[i + 1]);
  }
  assert.ok(maxY <= 2.3, `weltenschildkroete bleibt unter der Weltwurzel (max-Y ${maxY})`);
  assert.ok(footprint > 1.2, `weltenschildkroete hat gigantische Grundfläche (${footprint})`);
  for (const kind of INK_ASSET_KINDS) {
    if (kind === "weltenschildkroete") continue;
    const other = buildInkAsset(kind);
    let otherFootprint = 0;
    for (let i = 0; i < other.positions.length; i += 3) {
      otherFootprint = Math.max(otherFootprint, Math.abs(other.positions[i]), Math.abs(other.positions[i + 2]));
    }
    assert.ok(footprint > otherFootprint, `weltenschildkroete ist breiter als ${kind}`);
  }
  let amplitude = 0;
  for (let i = 0; i < turtle.anim.length; i += 4) {
    amplitude += Math.abs(turtle.anim[i]) + Math.abs(turtle.anim[i + 1]) + Math.abs(turtle.anim[i + 2]);
  }
  assert.ok(amplitude > 0, "Kopf nickt und Fähnchen wippen");
});

test("batch-4 idle animation: bewegliche Kinds haben Amplitude", () => {
  const animAmplitude = (kind: Parameters<typeof buildInkAsset>[0]) => {
    const asset = buildInkAsset(kind);
    let sum = 0;
    for (let i = 0; i < asset.anim.length; i += 4) {
      sum += Math.abs(asset.anim[i]) + Math.abs(asset.anim[i + 1]) + Math.abs(asset.anim[i + 2]);
    }
    return sum;
  };
  for (const kind of ["weide", "windrad", "lagerfeuer", "segelschiff", "ballon", "geysir"] as const) {
    assert.ok(animAmplitude(kind) > 0, `${kind} bewegt sich`);
  }
});

test("batch-4 himmel kinds ballon/sturmwolke float above the ground via geometry", () => {
  for (const kind of ["ballon", "sturmwolke"] as const) {
    const asset = buildInkAsset(kind);
    let minY = Infinity;
    for (let i = 1; i < asset.positions.length; i += 3) minY = Math.min(minY, asset.positions[i]);
    assert.ok(minY >= 0.4, `${kind} floats (lowest vertex at ${minY})`);
  }
});

test("kometenstein ist globe-only, weltenschildkroete nicht", () => {
  assert.ok(GLOBE_ONLY_ASSET_KINDS.includes("kometenstein"), "kometenstein kreist im Orbit");
  assert.equal(GLOBE_ONLY_ASSET_KINDS.includes("weltenschildkroete"), false, "weltenschildkroete ist überall platzierbar");
});
