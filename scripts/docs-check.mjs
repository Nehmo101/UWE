#!/usr/bin/env node
/**
 * Lightweight documentation checks for UWE CI.
 * Verifies required engineering docs exist and basic Markdown structure is sane.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const REQUIRED_FILES = [
  "README.md",
  "AGENTS.md",
  "docs/engineering/ci.md",
  "docs/engineering/brain-local-runtime.md",
  "docs/engineering/cursor-workflow.md",
  "docs/engineering/migration-from-copilot.md",
  "docs/engineering/self-hosted-ci.md",
];

const MARKDOWN_DIRS = ["docs", ".cursor/commands", ".cursor/rules"];

function assertExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return `missing required file: ${relativePath}`;
  }
  return null;
}

function checkMarkdownFile(relativePath) {
  const fullPath = path.join(root, relativePath);
  const content = fs.readFileSync(fullPath, "utf8");
  const issues = [];

  if (content.trim().length === 0) {
    issues.push(`${relativePath}: file is empty`);
  }

  if (relativePath.endsWith(".md") && !content.startsWith("#")) {
    const startsWithFrontmatter = /^---\r?\n/.test(content);
    if (!startsWithFrontmatter) {
      issues.push(`${relativePath}: should start with a top-level heading`);
    }
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/\t/.test(line)) {
      issues.push(`${relativePath}:${i + 1}: contains tab characters (use spaces)`);
    }
  }

  return issues;
}

function walkMarkdown(dir, files = []) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) {
    return files;
  }

  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const relativePath = path.join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      walkMarkdown(relativePath, files);
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdc")) {
      files.push(relativePath);
    }
  }

  return files;
}

const errors = [];

for (const file of REQUIRED_FILES) {
  const issue = assertExists(file);
  if (issue) {
    errors.push(issue);
  }
}

const markdownFiles = MARKDOWN_DIRS.flatMap((dir) => walkMarkdown(dir));
for (const file of markdownFiles) {
  errors.push(...checkMarkdownFile(file));
}

if (errors.length === 0) {
  console.log(`docs-check: OK (${REQUIRED_FILES.length} required files, ${markdownFiles.length} markdown files scanned)`);
  process.exit(0);
}

console.error(`docs-check: found ${errors.length} issue(s):`);
for (const error of errors) {
  console.error(`- ${error}`);
}

process.exit(1);
