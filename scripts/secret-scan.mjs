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
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".env",
  ".example",
  ".pem",
  ".toml",
  ".sh",
  ".ps1",
]);

const ALLOWLIST_PATHS = [
  /packages\/database\/src\/auth-seed\.ts$/,
  /packages\/database\/prisma\/seed\.ts$/,
  /packages\/security-tests\/src\/fixtures\/security-fixture\.ts$/,
  /apps\/portal\/app\/login\/page\.tsx$/,
  /packages\/env\/src\/config\/env\.ts$/,
  /\.test\.(ts|tsx)$/,
  /docs\/secrets\.md$/,
  // Example env templates (placeholders like CHANGE_ME), incl. .env.production.example
  /\.env(\.[^/]+)?\.example$/,
];

const PATTERNS = [
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
  // GitHub PAT (classic ghp_ + fine-grained github_pat_) and OAuth/app tokens.
  { name: "GitHub token", regex: /(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{20,}/g },
  { name: "GitHub fine-grained PAT", regex: /github_pat_[A-Za-z0-9_]{20,}/g },
  // OpenAI/Anthropic style keys — allow internal hyphens (sk-proj-…, sk-ant-…).
  { name: "OpenAI/Anthropic key", regex: /sk-[A-Za-z0-9-]{20,}/g },
  { name: "Slack token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "Hardcoded password assignment (quoted)",
    regex:
      /(?:password|passwd|api[_-]?key|client[_-]?secret)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi,
  },
  {
    // Unquoted env-style assignment (no space around '='), e.g. an API key or
    // password set directly on an env line. Requiring the tight `key=value` form
    // avoids matching TS `const password = …`; excluding `<>` skips `<placeholder>`
    // templates. `envOnly` keeps it off prose (markdown docs use example values).
    name: "Hardcoded password assignment (env)",
    regex: /(?:password|passwd|api[_-]?key|client[_-]?secret)=[^'"\s<>]{8,}/gi,
    envOnly: true,
  },
  {
    name: "Hardcoded bearer or auth token assignment (quoted)",
    regex: /(?:auth[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi,
  },
  {
    name: "Hardcoded bearer or auth token assignment (env)",
    regex: /(?:auth[_-]?token|access[_-]?token|refresh[_-]?token)=[^'"\s<>]{12,}/gi,
    envOnly: true,
  },
  {
    name: "Weak docker default",
    regex: /AUTH_SECRET:\s*\$\{AUTH_SECRET:-change-me-in-production\}/g,
  },
];

// Real dotenv files (`.env`, `.env.local`, `.env.production`, …) have an empty
// or misleading `path.extname`, so match them by basename instead.
function isEnvFile(basename) {
  return basename === ".env" || basename.startsWith(".env.");
}

function shouldScanFile(relativePath) {
  const ext = path.extname(relativePath);
  const basename = path.basename(relativePath);
  if (!SCAN_EXTENSIONS.has(ext) && !isEnvFile(basename)) {
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

  const isMarkdown = relativePath.endsWith(".md");

  for (const pattern of PATTERNS) {
    // `envOnly` patterns target real config leaks, not the illustrative
    // `KEY=value` examples that live in markdown documentation.
    if (pattern.envOnly && isMarkdown) {
      continue;
    }
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
