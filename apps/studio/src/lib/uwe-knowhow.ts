import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
// apps/studio/src/lib -> repo root
const REPO_ROOT = join(MODULE_DIR, "..", "..", "..", "..");

export interface KnowHowDoc {
  title: string;
  /** Repo-relative path, e.g. "docs/ARCHITECTURE.md". */
  path: string;
  source: "README" | "CHANGELOG" | "docs";
  excerpt: string;
  updatedAt: string | null;
}

function readMarkdown(absPath: string): { title: string; excerpt: string } | null {
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
  const lines = content.split("\n");
  const headingLine = lines.find((line) => line.startsWith("# "));
  const title = headingLine ? headingLine.replace(/^#\s+/, "").trim() : "(ohne Titel)";
  const excerptLine = lines.find(
    (line) => line.trim().length > 0 && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("```"),
  );
  const excerpt = (excerptLine ?? "").trim().slice(0, 200);
  return { title, excerpt };
}

function mtime(absPath: string): string | null {
  try {
    return statSync(absPath).mtime.toISOString();
  } catch {
    return null;
  }
}

function walkDocs(dir: string, acc: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDocs(full, acc);
    } else if (entry.name.endsWith(".md")) {
      acc.push(full);
    }
  }
}

/**
 * Index the project's own documentation (README, CHANGELOG, docs/**) for the
 * in-app UWE KnowHow help. System help only — never mixed with world brain.
 * Reads from disk; degrades to an empty list when source docs are unavailable
 * (e.g. a standalone bundle without repo source).
 */
export function getKnowHowDocs(): KnowHowDoc[] {
  const docs: KnowHowDoc[] = [];

  const readmePath = join(REPO_ROOT, "README.md");
  if (existsSync(readmePath)) {
    const parsed = readMarkdown(readmePath);
    if (parsed) docs.push({ ...parsed, path: "README.md", source: "README", updatedAt: mtime(readmePath) });
  }

  const changelogPath = join(REPO_ROOT, "CHANGELOG.md");
  if (existsSync(changelogPath)) {
    const parsed = readMarkdown(changelogPath);
    if (parsed) docs.push({ ...parsed, path: "CHANGELOG.md", source: "CHANGELOG", updatedAt: mtime(changelogPath) });
  }

  const docsDir = join(REPO_ROOT, "docs");
  const files: string[] = [];
  walkDocs(docsDir, files);
  for (const abs of files.sort()) {
    const parsed = readMarkdown(abs);
    if (!parsed) continue;
    docs.push({
      ...parsed,
      path: relative(REPO_ROOT, abs).replace(/\\/g, "/"),
      source: "docs",
      updatedAt: mtime(abs),
    });
  }

  return docs;
}
