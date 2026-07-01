/**
 * Copy the single-file Atlas runtime (atlas.html + atlas-engine.js) from
 * @uwe/static-export into apps/studio/public/atlas/ so the Studio can embed it
 * same-origin via <iframe src="/atlas/atlas.html?mode=editor&embed=1"> (M3).
 *
 * Runs on predev/prebuild. The engine bundle is generated from @uwe/atlas
 * (see packages/static-export/scripts/build-atlas-engine.mjs) and committed, so
 * this is a plain copy — public/atlas/ is a build artifact (gitignored).
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../../../packages/static-export/static");
const outDir = resolve(here, "../public/atlas");
const files = ["atlas.html", "atlas-engine.js"];

await mkdir(outDir, { recursive: true });
for (const file of files) {
  await copyFile(resolve(srcDir, file), resolve(outDir, file));
}
console.log(`[studio] copied Atlas runtime (${files.join(", ")}) → public/atlas/`);
