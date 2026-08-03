/**
 * Drift-Wächter für die bewegte Bühne.
 *
 * Vorgeschichte: alle zwanzig Clips standen in `sceneMotion.ts` auf
 * `available: true`, alle achtzig Dateien lagen in `assets/scenes-motion/`,
 * `copy-scenes.mjs` lieferte sie in fünf `public/scenes/motion/`-Ordner aus —
 * und drei der fünf Bereiche haben sie nie angefragt:
 *
 *   - Studio band überhaupt keine Route ein (0 von 89 Seiten)
 *   - Family reichte `sceneIndex` an keiner Stelle in die Shell (0 von 22)
 *   - Brain und Portal hatten je genau einen Auftritt
 *
 * Aufgefallen ist es nicht, weil `e2e/portal-motion.spec.ts` nur das Portal
 * kennt: ein grüner Test über einem Bereich, während vier andere leer laufen.
 *
 * Dieser Test schließt die Lücke ohne einen einzigen Browser. Er prüft zwei
 * Dinge, die zusammen genau den Fehler beschreiben, der passiert ist:
 *
 *   1. Jeder Bereich mit ausgelieferten Clips hat mindestens einen Auftritt.
 *   2. Jeder eingetragene Auftritt existiert und übergibt den Szenen-Index
 *      wirklich — eine Shell, die `PaintedScene` nur *enthält*, rendert noch
 *      nichts. Genau daran ist Family gescheitert.
 *
 * Wer einen Bereich hinzufügt oder eine Bühne verschiebt, trägt sie hier ein.
 * Wer eine ersatzlos entfernt, muss den passenden `available`-Schalter
 * mitnehmen — sonst liefert der Build Dateien aus, die niemand abruft.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { SCENE_AREAS, type SceneArea } from "../packages/shared-ui/src/scene/scenePools";
import { hasSceneMotion } from "../packages/shared-ui/src/scene/sceneMotion";

const root = path.resolve(import.meta.dirname, "..");

/**
 * Der Szenen-Index wird überall gleich übergeben. Die Studio-Bühne ist die
 * Ausnahme: sie hängt am Shell im Root-Layout, nicht an einer Seite — deshalb
 * steht dort dieselbe Zuweisung, nur an `AppShell`.
 */
const INDEX_UEBERGABE = /sceneIndex=\{dayIndex\(\)\}/;

interface Auftritt {
  area: SceneArea;
  /** Die Datei, die den Index übergibt — nicht die, die die Szene malt. */
  datei: string;
  /** Wofür die Bühne dort steht; erscheint in der Fehlermeldung. */
  zweck: string;
}

const AUFTRITTE: readonly Auftritt[] = [
  { area: "landing", datei: "apps/landing/app/page.tsx", zweck: "öffentliche Startseite" },
  { area: "landing", datei: "apps/studio/app/page.tsx", zweck: "Landing ohne getrennte Hosts" },
  { area: "studio", datei: "apps/studio/app/layout.tsx", zweck: "Band auf den Studio-Einstiegen" },
  {
    area: "portal",
    datei: "apps/portal/app/auth/worlds/(hub)/layout.tsx",
    zweck: "Welten-Hub",
  },
  {
    area: "portal",
    datei: "apps/portal/app/auth/worlds/[worldSlug]/page.tsx",
    zweck: "Weltseite",
  },
  { area: "brain", datei: "apps/brain/app/page.tsx", zweck: "Brain-Start" },
  { area: "brain", datei: "apps/brain/app/today/page.tsx", zweck: "Heute" },
  { area: "family", datei: "apps/family/app/page.tsx", zweck: "Family-Start" },
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("bewegte Bühne — Abdeckung", () => {
  it("kennt nur echte Bereiche", () => {
    for (const auftritt of AUFTRITTE) {
      assert.ok(
        (SCENE_AREAS as readonly string[]).includes(auftritt.area),
        `Unbekannter Bereich "${auftritt.area}" in AUFTRITTE`,
      );
    }
  });

  it("gibt jedem Bereich mit ausgelieferten Clips mindestens einen Auftritt", () => {
    for (const area of SCENE_AREAS) {
      if (!hasSceneMotion(area)) continue;
      const treffer = AUFTRITTE.filter((auftritt) => auftritt.area === area);
      assert.ok(
        treffer.length > 0,
        `Bereich "${area}" hat Clips auf available: true, aber keinen Auftritt. ` +
          "Entweder eine Bühne einbauen und hier eintragen — oder available auf " +
          "false setzen, damit copy-scenes.mjs die vier Dateien nicht ausliefert.",
      );
    }
  });

  it("übergibt an jedem Auftritt wirklich einen Szenen-Index", () => {
    for (const { area, datei, zweck } of AUFTRITTE) {
      assert.ok(
        fs.existsSync(path.join(root, datei)),
        `Auftritt "${zweck}" (${area}): ${datei} existiert nicht mehr`,
      );
      assert.match(
        read(datei),
        INDEX_UEBERGABE,
        `Auftritt "${zweck}" (${area}) in ${datei} übergibt keinen sceneIndex — ` +
          "die Shell rendert dann einen schlichten Kopf und die Bühne fällt still aus.",
      );
    }
  });
});
