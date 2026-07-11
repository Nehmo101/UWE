/**
 * Bundle the @uwe/atlas engine into a single browser ES module for the
 * single-file Atlas runtime (atlas.html imports ./atlas-engine.js).
 *
 * SINGLE SOURCE: the browser engine is generated from packages/atlas/src, never
 * hand-copied — so the Studio editor, Portal viewer and static export all run
 * the exact same engine as the @uwe/atlas package. Re-run after engine changes:
 *
 *   pnpm --filter @uwe/static-export build:atlas-engine
 *
 * @uwe/atlas is dependency-free, so the bundle has no external imports and works
 * offline (no CDN).
 */
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const bundles = [
  { name: "engine", entry: resolve(pkgRoot, "../atlas/src/index.ts"), outfile: resolve(pkgRoot, "static/atlas-engine.js") },
  { name: "3d", entry: resolve(pkgRoot, "../atlas-3d/src/index.ts"), outfile: resolve(pkgRoot, "static/atlas-3d.js") },
];

for (const bundle of bundles) {
  await build({
    entryPoints: [bundle.entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    outfile: bundle.outfile,
    minify: bundle.name === "3d",
    charset: "utf8",
    legalComments: "none",
    banner: {
      js:
        `/* AUTO-GENERATED from @uwe/atlas${bundle.name === "3d" ? "-3d" : ""} — do not edit by hand.\n` +
        "   Regenerate: pnpm --filter @uwe/static-export build:atlas-engine */",
    },
  });
  console.log(`[atlas] ${bundle.name} bundled →`, bundle.outfile);
}
