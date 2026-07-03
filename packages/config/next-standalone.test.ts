import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getUweStandaloneNextConfig,
  uweMonorepoRoot,
  uwePrismaRuntimePackages,
} from "./next-standalone";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("uweMonorepoRoot", () => {
  it("points at the monorepo root (two levels above packages/config)", () => {
    assert.equal(uweMonorepoRoot, repoRoot);
  });
});

describe("getUweStandaloneNextConfig", () => {
  it("builds app-relative tracing includes for an app under apps/*", () => {
    const config = getUweStandaloneNextConfig(path.join(repoRoot, "apps", "studio"));

    assert.equal(config.outputFileTracingRoot, repoRoot);

    const includes = config.outputFileTracingIncludes["/**/*"];
    assert.ok(Array.isArray(includes) && includes.length > 0);
    assert.ok(
      includes.every((entry) => entry.startsWith("../../")),
      "all includes are relative to the app dir",
    );
    assert.ok(
      includes.every((entry) => !entry.includes("\\")),
      "includes use forward slashes (glob-safe on Windows)",
    );
    assert.ok(includes.includes("../../packages/database/prisma/**/*"));
    assert.ok(includes.includes("../../packages/database/src/generated/**/*"));
    assert.ok(includes.includes("../../node_modules/@prisma/client/**/*"));
  });

  it("omits the prefix when the app dir is the monorepo root itself", () => {
    const config = getUweStandaloneNextConfig(repoRoot);
    const includes = config.outputFileTracingIncludes["/**/*"];

    assert.ok(includes.includes("packages/database/prisma/**/*"));
    assert.ok(
      includes.every((entry) => !entry.startsWith("./") && !entry.startsWith("../")),
      "root-level includes carry no relative prefix",
    );
  });

  it("externalizes every Prisma runtime package", () => {
    const config = getUweStandaloneNextConfig(path.join(repoRoot, "apps", "portal"));

    assert.deepEqual(config.serverExternalPackages, [...uwePrismaRuntimePackages]);
    assert.notEqual(
      config.serverExternalPackages,
      uwePrismaRuntimePackages,
      "returns a fresh mutable copy, not the shared constant",
    );
    assert.ok(config.serverExternalPackages.includes("@prisma/client"));
    assert.ok(config.serverExternalPackages.includes("better-sqlite3"));
  });
});
