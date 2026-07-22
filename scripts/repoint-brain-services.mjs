/**
 * Repoints owner-private Brain services from the D&D core Prisma client to the
 * Brain client (Runbook stage 6). Deterministic codemod — it only relocates
 * import/export *sources*, it invents no logic:
 *
 *   • `{ …brain types… } from "…/generated/prisma/client"`  →  same names from
 *     "…/generated/prisma-brain/client"; core-typed names stay on the core
 *     client (the statement is split when it mixes both). `PrismaClient` counts
 *     as a Brain symbol here (the service's db is now the Brain client).
 *   • `import type { PrismaClient } from "…/client"`  →
 *     `import type { BrainPrismaClient as PrismaClient } from "…/brain-client"`.
 *
 * Scope is the SAFE set only: `@uwe/database`-internal, single-domain Brain
 * services with no cross-DB reads and no contested campaign-mail models. The
 * contested mail set and the 20 cross-DB services are NOT touched here — they
 * are the host-guided worklist in the runbook.
 *
 * Run: `node scripts/repoint-brain-services.mjs`  (`--dry` to preview)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRAIN_MODEL_NAMES } from "../packages/product-contracts/src/prisma-model-boundaries.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry");

// Brain type-export surface = brain models + brain enums + the client type.
const brainSchema = fs.readFileSync(
  path.join(root, "packages/database/prisma/brain/schema.prisma"),
  "utf8",
);
const brainEnums = [...brainSchema.matchAll(/enum\s+([A-Za-z0-9_]+)\s*\{/g)].map((m) => m[1]);
const brainTypes = new Set([...BRAIN_MODEL_NAMES.map(String), ...brainEnums, "PrismaClient"]);

const TARGETS = [
  "packages/database/src/continue-work-service.ts",
  "packages/database/src/finance-overview-service.ts",
  "packages/database/src/personal-brain-service.ts",
  "packages/database/src/research-service.ts",
  "packages/database/src/document-template-service.ts",
  "packages/database/src/miniature-collection-service.ts",
  "packages/database/src/life-admin/life-admin-brain-service.ts",
  "packages/database/src/life-admin/life-admin-capture-service.ts",
  "packages/database/src/life-admin/life-admin-contract-service.ts",
  "packages/database/src/life-admin/life-admin-hardware-service.ts",
  "packages/database/src/life-admin/life-admin-project-service.ts",
  "packages/database/src/life-admin/life-admin-today-service.ts",
  "packages/database/src/life-admin/life-admin-workshop-service.ts",
];

/** Original (pre-`as`) name of a named import/export specifier. */
function originalName(spec) {
  return spec.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "").trim();
}

function rewriteFile(rel) {
  const abs = path.join(root, rel);
  let src = fs.readFileSync(abs, "utf8");
  const changes = [];

  // 1) import/export … from "<rel>/generated/prisma/client"
  // `[^}]*` (not `[\s\S]*?`) keeps each match inside ONE brace group so it can
  // never span across adjacent statements — multi-line specifier lists still
  // match (newline is not `}`), but a second statement cannot be swallowed.
  const genRe =
    /(import|export)\s+(type\s+)?\{([^}]*)\}\s+from\s+"((?:\.\.?\/)+generated\/)prisma\/client"\s*;/g;
  src = src.replace(genRe, (full, kw, typeKw, body, prefix) => {
    const specs = body.split(",").map((s) => s.trim()).filter(Boolean);
    const brain = specs.filter((s) => brainTypes.has(originalName(s)));
    const core = specs.filter((s) => !brainTypes.has(originalName(s)));
    if (!brain.length) return full; // nothing brain here
    const t = typeKw ? "type " : "";
    const brainStmt = `${kw} ${t}{ ${brain.join(", ")} } from "${prefix}prisma-brain/client";`;
    changes.push(`  split ${prefix}prisma/client -> prisma-brain (${brain.map(originalName).join(", ")})`);
    if (!core.length) return brainStmt;
    const coreStmt = `${kw} ${t}{ ${core.join(", ")} } from "${prefix}prisma/client";`;
    return `${coreStmt}\n${brainStmt}`;
  });

  // 2) import type { PrismaClient } from "<rel>/client"  (the singleton module)
  const clientRe = /import\s+type\s+\{\s*PrismaClient\s*\}\s+from\s+"((?:\.\.?\/)+)client"\s*;/g;
  src = src.replace(clientRe, (_full, prefix) => {
    changes.push(`  ${prefix}client -> ${prefix}brain-client (BrainPrismaClient as PrismaClient)`);
    return `import type { BrainPrismaClient as PrismaClient } from "${prefix}brain-client";`;
  });

  return { abs, rel, src, changes };
}

let total = 0;
for (const rel of TARGETS) {
  const r = rewriteFile(rel);
  if (!r.changes.length) {
    console.log(`— ${rel}: no change`);
    continue;
  }
  total += r.changes.length;
  console.log(`✎ ${rel}`);
  for (const c of r.changes) console.log(c);
  if (!dry) fs.writeFileSync(r.abs, r.src);
}
console.log(dry ? `\n(dry run) ${total} rewrites planned` : `\nDone: ${total} rewrites.`);
