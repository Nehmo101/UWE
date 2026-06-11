import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const UWE_PRODUCT_NAME = "Universeller Welten-Editor";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function readVersionFile(path: string): string | null {
  try {
    const value = readFileSync(path, "utf8").trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function resolveUweVersion(): string {
  const candidates = [
    join(moduleDir, "..", "..", "..", "VERSION"),
    join(process.cwd(), "VERSION"),
    join(process.cwd(), "..", "..", "VERSION"),
  ];

  for (const candidate of candidates) {
    const version = readVersionFile(candidate);
    if (version) {
      return version;
    }
  }

  try {
    const packageJson = join(moduleDir, "..", "..", "..", "package.json");
    const parsed = JSON.parse(readFileSync(packageJson, "utf8")) as { version?: string };
    if (parsed.version) {
      return parsed.version;
    }
  } catch {
    // fall through
  }

  return "0.0.0";
}

export const UWE_VERSION = resolveUweVersion();
