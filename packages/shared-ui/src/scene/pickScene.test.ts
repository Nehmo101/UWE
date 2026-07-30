import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  dayIndex,
  pickScene,
  resolveScenePair,
  sceneCssUrl,
  sceneUrl,
  SCENE_TIME_ZONE,
} from "./pickScene";
import {
  getScenePool,
  HANDOUT_PREVIEW,
  SCENE_AREAS,
  SCENE_BREAKPOINT_PX,
  SCENE_FILE_EXTENSION,
  SCENE_MODES,
  SCENE_VARIANTS,
  scenesForAreas,
} from "./scenePools";

/**
 * Poolgrößen laut Handoff (README, Abschnitt „Bildrotation").
 * `family` kam mit dem v3-Redesign dazu — vorher lief die App auf Brains Pool
 * mit und war dadurch optisch nicht von Brain zu unterscheiden.
 */
const EXPECTED_POOL_SIZES: Record<string, number> = {
  "desktop/hell/landing": 4,
  "desktop/hell/studio": 3,
  "desktop/hell/portal": 4,
  "desktop/hell/brain": 3,
  "desktop/hell/family": 3,
  "desktop/dunkel/landing": 3,
  "desktop/dunkel/studio": 3,
  "desktop/dunkel/portal": 3,
  "desktop/dunkel/brain": 3,
  "desktop/dunkel/family": 3,
  "mobil/hell/landing": 3,
  "mobil/hell/studio": 3,
  "mobil/hell/portal": 3,
  "mobil/hell/brain": 3,
  "mobil/hell/family": 3,
  "mobil/dunkel/landing": 3,
  "mobil/dunkel/studio": 3,
  "mobil/dunkel/portal": 3,
  "mobil/dunkel/brain": 3,
  "mobil/dunkel/family": 3,
};

describe("scene pools", () => {
  it("matches the pool sizes from the handoff", () => {
    for (const variant of SCENE_VARIANTS) {
      for (const mode of SCENE_MODES) {
        for (const area of SCENE_AREAS) {
          const key = `${variant}/${mode}/${area}`;
          assert.equal(
            getScenePool(area, mode, variant).length,
            EXPECTED_POOL_SIZES[key],
            key,
          );
        }
      }
    }
  });

  it("keeps every pool entry in the folder its mode/viewport implies", () => {
    for (const variant of SCENE_VARIANTS) {
      for (const mode of SCENE_MODES) {
        const folder = `${mode === "hell" ? "tag" : "nacht"}-${variant}/`;
        for (const area of SCENE_AREAS) {
          for (const scene of getScenePool(area, mode, variant)) {
            assert.ok(
              scene.src.startsWith(folder),
              `${scene.src} should live in ${folder}`,
            );
            assert.match(scene.pos, /^center \d+%$/, scene.src);
          }
        }
      }
    }
  });

  it("ships every referenced file in assets/scenes", () => {
    // Ein Tippfehler in der Pool-Tabelle wäre sonst erst im Browser sichtbar —
    // als stummer, bildloser Hintergrund.
    const root = path.join(__dirname, "..", "..", "..", "..", "assets", "scenes");
    const referenced = [
      ...scenesForAreas(SCENE_AREAS),
      HANDOUT_PREVIEW.src + SCENE_FILE_EXTENSION,
    ];
    for (const file of referenced) {
      assert.ok(existsSync(path.join(root, file)), `missing asset: ${file}`);
    }
  });

  it("selects only the files an app's areas actually need", () => {
    const brainOnly = scenesForAreas(["brain"]);
    assert.ok(brainOnly.length > 0);
    assert.ok(brainOnly.every((file) => file.endsWith(SCENE_FILE_EXTENSION)));
    // Landing-exklusive Motive dürfen dort nicht auftauchen.
    assert.ok(!brainOnly.includes("tag-desktop/10-weltenbaum-stadt.png"));
    // Und die Vereinigung ist echt größer als eine einzelne Fläche.
    assert.ok(scenesForAreas(SCENE_AREAS).length > brainOnly.length);
  });
});

describe("pickScene", () => {
  const pool = ["a", "b", "c"] as const;

  it("wraps around the pool", () => {
    assert.equal(pickScene(pool, 0), "a");
    assert.equal(pickScene(pool, 1), "b");
    assert.equal(pickScene(pool, 2), "c");
    assert.equal(pickScene(pool, 3), "a");
    assert.equal(pickScene(pool, 3001), pool[3001 % 3]);
  });

  it("handles negative indices without going out of bounds", () => {
    assert.equal(pickScene(pool, -1), "c");
    assert.equal(pickScene(pool, -2), "b");
    assert.equal(pickScene(pool, -3), "a");
    assert.equal(pickScene(pool, -4), "c");
    assert.equal(pickScene(pool, -3000), "a");
  });

  it("never returns undefined for any pool and any index", () => {
    for (const variant of SCENE_VARIANTS) {
      for (const mode of SCENE_MODES) {
        for (const area of SCENE_AREAS) {
          const p = getScenePool(area, mode, variant);
          for (let i = -10; i <= 10; i++) {
            assert.ok(pickScene(p, i)?.src, `${area}/${mode}/${variant}@${i}`);
          }
        }
      }
    }
  });

  it("rejects an empty pool instead of returning undefined", () => {
    assert.throws(() => pickScene([], 0), /must not be empty/);
  });
});

describe("dayIndex", () => {
  const berlin = { timeZone: "Europe/Berlin" } as const;

  it("is stable across a whole local day", () => {
    // 2026-07-25 in Berlin (UTC+2): local midnight is 2026-07-24T22:00Z.
    const justAfterMidnight = new Date("2026-07-24T22:00:00.000Z");
    const middleOfDay = new Date("2026-07-25T10:30:00.000Z");
    const justBeforeMidnight = new Date("2026-07-25T21:59:59.999Z");
    const first = dayIndex(justAfterMidnight, berlin);
    assert.equal(dayIndex(middleOfDay, berlin), first);
    assert.equal(dayIndex(justBeforeMidnight, berlin), first);
  });

  it("advances by exactly one at local midnight", () => {
    const before = new Date("2026-07-25T21:59:59.999Z"); // 23:59:59 Berlin
    const after = new Date("2026-07-25T22:00:00.000Z"); // 00:00:00 Berlin, next day
    assert.equal(dayIndex(after, berlin) - dayIndex(before, berlin), 1);
  });

  it("switches at the zone's midnight, not at UTC midnight", () => {
    // 23:30 UTC on 2026-07-25 is already 01:30 on the 26th in Berlin.
    const lateUtc = new Date("2026-07-25T23:30:00.000Z");
    assert.equal(
      dayIndex(lateUtc, berlin),
      dayIndex(new Date("2026-07-26T09:00:00.000Z"), berlin),
    );
    assert.notEqual(dayIndex(lateUtc, berlin), dayIndex(lateUtc, { timeZone: "UTC" }));
  });

  it("differs between zones on either side of the date line", () => {
    const instant = new Date("2026-07-25T12:00:00.000Z");
    assert.equal(dayIndex(instant, { timeZone: "Pacific/Auckland" }) - dayIndex(instant, { timeZone: "UTC" }), 1);
    assert.equal(dayIndex(instant, { timeZone: "Pacific/Honolulu" }), dayIndex(instant, { timeZone: "UTC" }));
  });

  it("survives a DST transition without skipping or repeating a day", () => {
    // Europe/Berlin springs forward on 2026-03-29 (02:00 -> 03:00 local).
    const saturday = dayIndex(new Date("2026-03-28T12:00:00.000Z"), berlin);
    const sunday = dayIndex(new Date("2026-03-29T12:00:00.000Z"), berlin);
    const monday = dayIndex(new Date("2026-03-30T12:00:00.000Z"), berlin);
    assert.equal(sunday - saturday, 1);
    assert.equal(monday - sunday, 1);
  });

  it("advances a weekly cadence exactly once per seven days", () => {
    // Die Wochen-Buckets sind an der Epoche verankert (floor(days/7)), nicht am
    // Montag — geprüft wird deshalb die Invariante, nicht ein Wochentag.
    const weekly = { ...berlin, cadence: "weekly" } as const;
    const start = new Date("2026-07-20T10:00:00.000Z");
    const plusDays = (n: number) => new Date(start.getTime() + n * 864e5);

    for (let d = 0; d < 14; d++) {
      assert.equal(
        dayIndex(plusDays(d + 7), weekly) - dayIndex(plusDays(d), weekly),
        1,
        `day ${d}`,
      );
    }

    // Innerhalb von sieben aufeinanderfolgenden Tagen wechselt der Bucket
    // höchstens einmal.
    const window = Array.from({ length: 7 }, (_, d) => dayIndex(plusDays(d), weekly));
    assert.ok(new Set(window).size <= 2);
    assert.deepEqual([...window].sort((a, b) => a - b), window, "must be monotonic");
  });

  it("pins the index for the 'off' cadence", () => {
    const off = { ...berlin, cadence: "off" } as const;
    assert.equal(dayIndex(new Date("2020-01-01T00:00:00.000Z"), off), 0);
    assert.equal(dayIndex(new Date("2031-12-31T00:00:00.000Z"), off), 0);
  });

  it("defaults to the product zone", () => {
    assert.equal(SCENE_TIME_ZONE, "Europe/Berlin");
    const instant = new Date("2026-07-25T23:30:00.000Z");
    assert.equal(dayIndex(instant), dayIndex(instant, berlin));
  });
});

describe("resolveScenePair", () => {
  it("returns both layers so the crossfade never has to fetch", () => {
    for (const area of SCENE_AREAS) {
      for (const variant of SCENE_VARIANTS) {
        const pair = resolveScenePair(area, variant, 7);
        assert.ok(pair.day.src.startsWith(`tag-${variant}/`), `${area}/${variant}`);
        assert.ok(pair.night.src.startsWith(`nacht-${variant}/`), `${area}/${variant}`);
      }
    }
  });

  it("is a pure function of the index", () => {
    const a = resolveScenePair("portal", "desktop", 42);
    const b = resolveScenePair("portal", "desktop", 42);
    assert.deepEqual(a, b);
  });

  it("actually rotates across consecutive days", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      seen.add(resolveScenePair("landing", "desktop", i).day.src);
    }
    assert.equal(seen.size, 4, "the 4-entry landing pool should cycle through all motifs");
  });
});

describe("scene urls", () => {
  it("builds a public path with the file extension", () => {
    const scene = { src: "tag-desktop/01-alpen-flusstal", pos: "center 35%" };
    assert.equal(sceneUrl(scene), "/scenes/tag-desktop/01-alpen-flusstal.png");
    assert.equal(sceneCssUrl(scene), 'url("/scenes/tag-desktop/01-alpen-flusstal.png")');
  });

  it("honours a basePath so the Portal sub-path deployment resolves", () => {
    const scene = { src: "tag-mobil/01-gassenstadt-ranken", pos: "center 50%" };
    assert.equal(sceneUrl(scene, "/portal"), "/portal/scenes/tag-mobil/01-gassenstadt-ranken.png");
    assert.equal(sceneUrl(scene, "/portal/"), "/portal/scenes/tag-mobil/01-gassenstadt-ranken.png");
  });

  it("keeps the desktop breakpoint a single source of truth", () => {
    assert.equal(SCENE_BREAKPOINT_PX, 960);
  });
});
