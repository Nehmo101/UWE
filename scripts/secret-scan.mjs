#!/usr/bin/env node
/**
 * Lightweight secret scanner for the UWE repository.
 * Complements manual review; for deeper scans consider gitleaks or trufflehog.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "coverage",
  ".turbo",
  "generated",
]);

const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".env",
  ".example",
  ".sh",
  ".ps1",
]);

const ALLOWLIST_PATHS = [
  /packages\/database\/src\/auth-seed\.ts$/,
  /packages\/database\/prisma\/seed\.ts$/,
  /apps\/portal\/app\/login\/page\.tsx$/,
  /packages\/security-tests\/src\/fixtures\/security-fixture\.ts$/,
  /packages\/env\/src\/config\/env\.ts$/,
  /tools\/uwe-rtx-agent\/src\/test-helpers\.ts$/,
  /\.test\.(ts|tsx)$/,
  /docs\/secrets\.md$/,
  /\.env\.example$/,
];

const PATTERNS = [
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub PAT", regex: /ghp_[A-Za-z0-9]{20,}/g },
  { name: "OpenAI key", regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: "Slack token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "Hardcoded password assignment",
    regex:
      /(?:password|passwd|api[_-]?key|client[_-]?secret)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi,
  },
  {
    name: "Hardcoded bearer or auth token assignment",
    regex: /(?:auth[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi,
  },
  {
    name: "Weak docker default",
    regex: /AUTH_SECRET:\s*\$\{AUTH_SECRET:-change-me-in-production\}/g,
  },
];

function shouldScanFile(relativePath) {
  const ext = path.extname(relativePath);
  if (!SCAN_EXTENSIONS.has(ext) && !relativePath.endsWith(".env.example")) {
    return false;
  }

  return !ALLOWLIST_PATHS.some((pattern) => pattern.test(relativePath));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(relativePath, content) {
  const findings = [];

  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split("\n").length;
      findings.push({
        file: relativePath,
        line: lineNumber,
        rule: pattern.name,
        sample: match[0].slice(0, 80),
      });
    }
  }

  return findings;
}

const files = walk(root);
const findings = [];

for (const filePath of files) {
  const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
  if (!shouldScanFile(relativePath)) {
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");
  findings.push(...scanFile(relativePath, content));
}

if (findings.length === 0) {
  console.log("secret-scan: no suspicious patterns found.");
  process.exit(0);
}

console.error(`secret-scan: found ${findings.length} suspicious pattern(s):`);
for (const finding of findings) {
  console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.sample}`);
}

process.exit(1);
