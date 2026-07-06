#!/usr/bin/env node
/**
 * Migrates Studio inline API errors to jsonError() from @/src/lib/api-response.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const studioRoot = path.join(root, "apps/studio");

const TARGET_DIRS = [
  path.join(studioRoot, "app/api"),
  path.join(studioRoot, "src/lib"),
];

const SKIP_FILES = new Set([
  path.join(studioRoot, "src/lib/api-response.ts"),
]);

const ERROR_JSON_PATTERN =
  /NextResponse\.json\(\s*\{\s*error:\s*([^}]+?)\s*\}\s*,\s*\{\s*status:\s*([^}]+?)\s*\}\s*\)/gs;

function listTsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

function ensureJsonErrorImport(source) {
  if (source.includes('from "@/src/lib/api-response"')) {
    if (!source.includes("jsonError")) {
      return source.replace(
        /import\s*\{([^}]+)\}\s*from\s*"@\/src\/lib\/api-response";/,
        (match, imports) => {
          const parts = imports.split(",").map((part) => part.trim()).filter(Boolean);
          if (!parts.includes("jsonError")) {
            parts.push("jsonError");
          }
          return `import { ${parts.join(", ")} } from "@/src/lib/api-response";`;
        },
      );
    }
    return source;
  }

  const nextImport = source.match(/^import[^\n]+from\s+"next\/server";?\s*$/m);
  if (nextImport) {
    return source.replace(
      nextImport[0],
      `${nextImport[0]}\nimport { jsonError } from "@/src/lib/api-response";`,
    );
  }

  return `import { jsonError } from "@/src/lib/api-response";\n${source}`;
}

function removeUnusedNextResponseImport(source) {
  if (!source.includes("NextResponse")) {
    return source.replace(/^import\s*\{\s*NextResponse\s*\}\s*from\s*"next\/server";\s*\n/m, "");
  }
  return source;
}

function migrateFile(filePath) {
  if (SKIP_FILES.has(filePath)) return false;

  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("NextResponse.json") || !original.includes("error:")) {
    return false;
  }

  let next = original;
  let replacements = 0;

  next = next.replace(ERROR_JSON_PATTERN, (_match, message, status) => {
    replacements += 1;
    return `jsonError(${message.trim()}, ${status.trim()})`;
  });

  if (replacements === 0) {
    return false;
  }

  next = ensureJsonErrorImport(next);
  next = removeUnusedNextResponseImport(next);

  if (next !== original) {
    fs.writeFileSync(filePath, next);
    console.log(`updated ${path.relative(root, filePath)} (${replacements} replacements)`);
    return true;
  }

  return false;
}

let changed = 0;
for (const dir of TARGET_DIRS) {
  for (const file of listTsFiles(dir)) {
    if (migrateFile(file)) changed += 1;
  }
}

console.log(`\nDone. Updated ${changed} files.`);
