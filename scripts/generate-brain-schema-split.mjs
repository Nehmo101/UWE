/**
 * Deterministically splits the Prisma schema across the three UWE databases —
 * the D&D core (`uwe.db`), the owner-private Brain (`uwe-brain.db`) and the
 * shared Family data (`uwe-family.db`) — derived authoritatively from
 * `@uwe/product-contracts` (`PRISMA_MODEL_BOUNDARIES.targetDatabase`) so it
 * never drifts.
 *
 * This is Runbook stage 3 (docs/engineering/brain-migration-runbook.md). It is
 * a pure schema transform — it writes files but applies NOTHING to a database.
 *
 * **Idempotent by construction.** The script pools the model and enum blocks of
 * *all* existing schema files (main + every split) and re-emits each file from
 * that pool. A model that already moved once can therefore move again, and a new
 * split database can be introduced later — the earlier version read only the
 * main schema and could split exactly once.
 *
 * Per target it produces a standalone schema (own datasource + generated
 * client) in which every foreign key leaving that database is resolved to an
 * opaque, nullable scalar: the `@relation` field is dropped, the scalar `xxxId`
 * column stays (Runbook 3a). Enums referenced by the models are copied in,
 * because a Prisma schema is standalone.
 *
 * Run: `node scripts/generate-brain-schema-split.mjs`
 * Then generate the clients on a host with the toolchain:
 *   pnpm --filter @uwe/database db:generate
 *
 * `--dry` prints the plan (counts, stripped edges) without writing files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAIN_MODEL_NAMES,
  FAMILY_MODEL_NAMES,
} from "../packages/product-contracts/src/prisma-model-boundaries.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry");

const brain = new Set(BRAIN_MODEL_NAMES.map(String));
const family = new Set(FAMILY_MODEL_NAMES.map(String));
/** Everything that does NOT stay in the main schema. */
const splitOut = new Set([...brain, ...family]);

/**
 * The two split databases. Family joined in Abschnitt G: it is shared with
 * everyone holding the `Family` checkbox, so it cannot live in the owner-private
 * Brain database.
 */
const SPLITS = [
  {
    key: "brain",
    dir: "brain",
    models: brain,
    title: "Owner-private Brain data model (uwe-brain.db)",
    clientSqlite: "../../src/generated/prisma-brain",
    clientPostgres: "../../src/generated/prisma-brain-postgres",
  },
  {
    key: "family",
    dir: "family",
    models: family,
    title: "Shared Family data model (uwe-family.db)",
    clientSqlite: "../../src/generated/prisma-family",
    clientPostgres: "../../src/generated/prisma-family-postgres",
  },
];

/** Split a schema's top-level blocks into {kind, name, text}. */
function parseBlocks(src) {
  const re = /(model|enum|datasource|generator|type)\s+([A-Za-z0-9_]+)?\s*\{[\s\S]*?\n\}/g;
  const blocks = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    blocks.push({ kind: m[1], name: m[2] ?? m[1], text: m[0] });
  }
  return blocks;
}

/**
 * A model-typed field line, e.g.
 *   `world World? @relation(fields: [worldId], references: [id], ...)`
 *   `mailTemplates MailTemplate[]`
 * Returns the referenced model name (stripped of `[]`/`?`) or null.
 */
function relationTarget(line, modelNames) {
  const mm = line.match(/^\s*(\w+)\s+([A-Za-z0-9_]+)(\[\])?(\??)\s*(@|$)/);
  if (!mm) return null;
  const type = mm[2];
  return modelNames.has(type) ? type : null;
}

/** Collect enum type names referenced by a model body. */
function enumsUsedIn(modelText, enumNames) {
  const used = new Set();
  for (const line of modelText.split("\n")) {
    const mm = line.match(/^\s*\w+\s+([A-Za-z0-9_]+)(\[\])?(\??)/);
    if (mm && enumNames.has(mm[1])) used.add(mm[1]);
  }
  return used;
}

function readIfExists(relPath) {
  const abs = path.join(root, relPath);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

function processFlavour({ mainRel, fileName, isSqlite }) {
  const mainAbs = path.join(root, mainRel);
  const mainSrc = fs.readFileSync(mainAbs, "utf8");
  const mainBlocks = parseBlocks(mainSrc);

  // Pool every model/enum across main + existing splits, so a model that already
  // moved once can move again.
  const models = new Map();
  const enums = new Map();
  const collect = (blocks) => {
    for (const b of blocks) {
      if (b.kind === "model" && !models.has(b.name)) models.set(b.name, b.text);
      if (b.kind === "enum" && !enums.has(b.name)) enums.set(b.name, b.text);
    }
  };
  collect(mainBlocks);
  for (const split of SPLITS) {
    const src = readIfExists(`packages/database/prisma/${split.dir}/${fileName}`);
    if (src) collect(parseBlocks(src));
  }

  const modelNames = new Set(models.keys());
  const enumNames = new Set(enums.keys());
  const strippedEdges = [];
  const requiredCrossFk = [];

  /** Drop relation fields that leave `members`; the scalar FK column stays. */
  function transformForSplit(text, name, members) {
    const out = [];
    for (const line of text.split("\n")) {
      const target = relationTarget(line, modelNames);
      if (target && !members.has(target)) {
        strippedEdges.push(`${name}.${line.trim().split(/\s+/)[0]} -> ${target}`);
        if (/@relation/.test(line) && !/\?/.test(line) && !/\[\]/.test(line)) {
          requiredCrossFk.push(`${name} -> ${target} (required relation)`);
        }
        continue;
      }
      out.push(line);
    }
    return out.join("\n");
  }

  const provider = isSqlite ? "sqlite" : "postgresql";

  const outputs = SPLITS.map((split) => {
    const names = [...models.keys()].filter((name) => split.models.has(name));
    const usedEnums = new Set();
    for (const name of names) {
      for (const e of enumsUsedIn(models.get(name), enumNames)) usedEnums.add(e);
    }

    const clientOut = isSqlite ? split.clientSqlite : split.clientPostgres;
    const header = `// AUTO-GENERATED by scripts/generate-brain-schema-split.mjs — do not edit by hand.
// ${split.title}. Runbook stage 3.
// Cross-database FKs (-> World/Page/User/GameSession/…) are opaque scalars.

generator client {
  provider = "prisma-client"
  output   = "${clientOut}"
}

datasource db {
  provider = "${provider}"
}
`;
    const body = [
      ...[...usedEnums].sort().map((e) => enums.get(e)),
      ...names.map((name) => transformForSplit(models.get(name), name, split.models)),
    ].join("\n\n");

    return {
      key: split.key,
      relPath: `packages/database/prisma/${split.dir}/${fileName}`,
      schema: `${header}\n${body}\n`,
      modelCount: names.length,
      enumCount: usedEnums.size,
    };
  });

  // The main schema keeps everything that is not in a split, minus the
  // back-relations pointing into one (Prisma errors on a missing opposite side).
  const mainOut = mainBlocks
    .map((b) => {
      if (b.kind === "model" && splitOut.has(b.name)) return null;
      if (b.kind !== "model") return b.text;
      return b.text
        .split("\n")
        .filter((line) => {
          const target = relationTarget(line, modelNames);
          return !(target && splitOut.has(target));
        })
        .join("\n");
    })
    .filter((t) => t !== null)
    .join("\n\n");

  const leadComment = mainSrc.slice(0, mainSrc.indexOf(mainBlocks[0].text)).trimEnd();

  return {
    outputs,
    mainAbs,
    mainSchema: `${leadComment}\n\n${mainOut}\n`,
    stats: { strippedEdges, requiredCrossFk },
  };
}

const FLAVOURS = [
  { mainRel: "packages/database/prisma/schema.prisma", fileName: "schema.prisma", isSqlite: true },
  {
    mainRel: "packages/database/prisma/schema.postgresql.prisma",
    fileName: "schema.postgresql.prisma",
    isSqlite: false,
  },
];

for (const flavour of FLAVOURS) {
  const r = processFlavour(flavour);
  console.log(`\n# ${flavour.mainRel}`);
  for (const out of r.outputs) {
    console.log(`  ${out.key}: ${out.modelCount} models, ${out.enumCount} enums -> ${out.relPath}`);
  }
  console.log(`  stripped edges: ${r.stats.strippedEdges.length}`);
  for (const e of r.stats.strippedEdges) console.log(`    - ${e}`);
  if (r.stats.requiredCrossFk.length) {
    console.log(`  ⚠ required cross-database relations (kept as non-null opaque scalar):`);
    for (const e of r.stats.requiredCrossFk) console.log(`    - ${e}`);
  }
  if (!dry) {
    for (const out of r.outputs) {
      fs.mkdirSync(path.join(root, path.dirname(out.relPath)), { recursive: true });
      fs.writeFileSync(path.join(root, out.relPath), out.schema);
    }
    fs.writeFileSync(r.mainAbs, r.mainSchema);
    console.log(`  rewrote ${flavour.mainRel}`);
  }
}
console.log(dry ? "\n(dry run — no files written)" : "\nDone.");
