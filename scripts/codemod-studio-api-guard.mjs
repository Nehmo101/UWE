/**
 * Migrates Studio API routes from sync requireStudioApiAuth/guardStudioMutation
 * to async guardStudioApiRequest/guardStudioApiMutation with role enforcement.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const studioApiRoot = path.join(root, "apps/studio/app/api");

const PUBLIC_ALLOWLIST = new Set([
  "auth/login/route.ts",
  "auth/logout/route.ts",
  "auth/setup/route.ts",
  "auth/forgot-password/route.ts",
  "auth/reset-password/route.ts",
  "auth/two-factor/verify/route.ts",
  "health/route.ts",
  "health/public/route.ts",
  "maintenance/status/route.ts",
  "maintenance/evaluate/route.ts",
  "spotify/callback/route.ts",
  "agent-jobs/callback/route.ts",
]);

const ADMIN_GUARD_PATTERN = /requireAdminApiAuth|guardStudioAdminApiRequest|resolveStudioApiAuthContext/;

function listRouteFiles(dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(full, relative));
      continue;
    }
    if (entry.name === "route.ts") {
      files.push(relative);
    }
  }
  return files;
}

function ensureImport(content) {
  const importLine =
    'import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";';
  if (content.includes("guardStudioApiRequest")) {
    return content;
  }
  const securityImport = content.match(/^import .+ from "@uwe\/security";?\n/m);
  if (securityImport) {
    return content.replace(securityImport[0], `${securityImport[0]}${importLine}\n`);
  }
  const firstImport = content.match(/^import .+\n/m);
  if (firstImport) {
    return content.replace(firstImport[0], `${firstImport[0]}${importLine}\n`);
  }
  return `${importLine}\n${content}`;
}

function stripLegacyGuardImports(content) {
  return content
    .replace(
      /^import \{([^}]*)\} from "@uwe\/security";\n/m,
      (_match, inner) => {
        const parts = inner
          .split(",")
          .map((part) => part.trim())
          .filter(
            (part) =>
              part &&
              part !== "requireStudioApiAuth" &&
              part !== "guardStudioMutation",
          );
        if (parts.length === 0) {
          return "";
        }
        return `import { ${parts.join(", ")} } from "@uwe/security";\n`;
      },
    )
    .replace(
      /^import \{ requireStudioApiAuth \} from "@\/src\/lib\/studio-api-auth";\n/m,
      "",
    )
    .replace(
      /^import \{ requireStudioApiAuth, guardStudioMutation \} from "@uwe\/security";\n/m,
      "",
    );
}

function migrateContent(content, relativePath) {
  if (PUBLIC_ALLOWLIST.has(relativePath)) {
    return null;
  }
  if (ADMIN_GUARD_PATTERN.test(content)) {
    return null;
  }
  if (
    !content.includes("requireStudioApiAuth") &&
    !content.includes("guardStudioMutation")
  ) {
    return null;
  }

  let next = content;
  next = next.replace(
    /\bawait requireStudioApiAuth\(/g,
    "await guardStudioApiRequest(",
  );
  next = next.replace(
    /\brequireStudioApiAuth\(/g,
    "await guardStudioApiRequest(",
  );
  next = next.replace(
    /\bguardStudioMutation\(/g,
    "await guardStudioApiMutation(",
  );

  next = ensureImport(next);
  next = stripLegacyGuardImports(next);

  return next;
}

const routes = listRouteFiles(studioApiRoot);
let changed = 0;

for (const route of routes) {
  const filePath = path.join(studioApiRoot, route);
  const original = fs.readFileSync(filePath, "utf8");
  const updated = migrateContent(original, route);
  if (updated && updated !== original) {
    fs.writeFileSync(filePath, updated);
    changed += 1;
    console.log(`updated ${route}`);
  }
}

console.log(`Done. Updated ${changed} route files.`);
