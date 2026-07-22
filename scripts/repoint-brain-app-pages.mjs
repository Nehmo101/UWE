/**
 * Repoints the owner-private Brain app pages (`apps/brain/app/**`) from the D&D
 * core client to the Brain client (Runbook stage 6 D). Only the KEEP target —
 * these pages are the replacements for the retiring Studio Brain routes.
 *
 * Two shapes:
 *   • single-client Brain services  →  pass `brainPrisma`
 *   • the LifeAdmin two-client aggregate  →  pass `(brainPrisma, prisma)`
 * plus an added `import { brainPrisma } from "@uwe/database/brain-client";`.
 *
 * Run: `node scripts/repoint-brain-app-pages.mjs` (`--dry` to preview)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry");

// page → { call: regex on the factory call, twoClient: bool }
const PAGES = {
  "apps/brain/app/life-brain/page.tsx": { fn: "createLifeAdminService", two: true },
  "apps/brain/app/today/page.tsx": { fn: "createLifeAdminService", two: true },
  "apps/brain/app/capture/page.tsx": { fn: "createLifeAdminService", two: true },
  "apps/brain/app/projects/page.tsx": { fn: "createLifeAdminService", two: true },
  "apps/brain/app/workshop/page.tsx": { fn: "createLifeAdminService", two: true },
  "apps/brain/app/contracts/page.tsx": { fn: "createLifeAdminService", two: true },
  "apps/brain/app/hardware/page.tsx": { fn: "createLifeAdminService", two: true },
  "apps/brain/app/documents/page.tsx": { fn: "createDocumentTemplateService", two: false },
  "apps/brain/app/miniatures/page.tsx": { fn: "createMiniatureCollectionService", two: false },
};

let total = 0;
for (const [rel, cfg] of Object.entries(PAGES)) {
  const abs = path.join(root, rel);
  let src = fs.readFileSync(abs, "utf8");
  const before = src;

  // 1) rewrite the factory call: (prisma) -> (brainPrisma, prisma) | (brainPrisma)
  const callRe = new RegExp(`${cfg.fn}\\(\\s*prisma\\s*\\)`, "g");
  src = src.replace(callRe, cfg.two ? `${cfg.fn}(brainPrisma, prisma)` : `${cfg.fn}(brainPrisma)`);

  // 2) ensure the brainPrisma import (right after the @uwe/database/server import)
  if (!/from "@uwe\/database\/brain-client"/.test(src)) {
    src = src.replace(
      /(import\s+\{[^}]*\}\s+from\s+"@uwe\/database\/server";\n)/,
      `$1import { brainPrisma } from "@uwe/database/brain-client";\n`,
    );
  }

  if (src !== before) {
    total += 1;
    console.log(`✎ ${rel}`);
    if (!dry) fs.writeFileSync(abs, src);
  } else {
    console.log(`— ${rel}: no change`);
  }
}
console.log(dry ? `\n(dry) ${total} pages` : `\nDone: ${total} pages.`);
