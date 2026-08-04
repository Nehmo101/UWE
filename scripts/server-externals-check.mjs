/**
 * Server-Externals-Check — läuft nach `pnpm build:release`.
 *
 * Der Nachweis aus #84 als Gate: jsdom (über isomorphic-dompurify) liest zur
 * Laufzeit `browser/default-stylesheet.css` relativ zu seinem `__dirname`.
 * Wird das Paket ins Server-Bundle gezogen, verrutscht dieses `__dirname` und
 * jede Sanitisierung stirbt mit ENOENT. Die Externals-Liste lebt zentral in
 * `packages/config/next-standalone.ts` (`uweServerOnlyHtmlPackages`); dieser
 * Check stellt sicher, dass kein Server-Chunk einer gebauten App jsdom-Interna
 * enthält — egal, wer die Liste als Nächstes anfasst.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = ["studio", "portal", "brain", "family", "landing"];

// Ein String, der nur in jsdoms eigenem Code vorkommt — nicht in einem
// `require("jsdom")`-Aufruf, wie ihn ein korrekt externes Bundle enthält.
const BUNDLED_JSDOM_MARKER = "default-stylesheet.css";

function fail(message) {
  console.error(`server-externals-check: ${message}`);
  process.exit(1);
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Extern gehaltene Pakete liegen im Standalone-Output unter
        // node_modules — dort DARF jsdom vollständig liegen.
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (entry.name.endsWith(".js")) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

let checkedApps = 0;

for (const app of APPS) {
  const serverDir = path.join(root, "apps", app, ".next", "server");
  const files = listJsFiles(serverDir);
  if (files.length === 0) continue;
  checkedApps += 1;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes(BUNDLED_JSDOM_MARKER)) {
      fail(
        `${path.relative(root, file)} enthält jsdom-Interna (${BUNDLED_JSDOM_MARKER}). ` +
          "jsdom/isomorphic-dompurify müssen extern bleiben — siehe " +
          "uweServerOnlyHtmlPackages in packages/config/next-standalone.ts (#84).",
      );
    }
  }
}

if (checkedApps === 0) {
  fail("kein .next/server gefunden — erst pnpm build:release laufen lassen");
}

console.log(`server-externals-check: OK (${checkedApps} App(s) geprüft, jsdom bleibt extern)`);
