import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

/**
 * Die Build-Kennung dieses Deployments — Next schreibt sie beim Build nach
 * `.next/BUILD_ID` (auch im Standalone-Ordner). Der Service Worker hängt sie
 * an seine URL, damit jeder neue Build einen neuen Cache-Namen bekommt und
 * `activate` die Chunks des vorigen Builds wegräumt.
 *
 * Im Dev-Server gibt es keine Datei — dort genügt eine feste Kennung, der
 * Worker verhält sich wie bisher.
 */
export const getBuildId = cache((): string => {
  try {
    return fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "dev";
  }
});
