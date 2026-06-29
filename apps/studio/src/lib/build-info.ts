import { UWE_VERSION } from "@uwe/database/server";

export interface BuildInfo {
  version: string;
  commit: string | null;
  branch: string | null;
  builtAt: string | null;
  deployRunNumber: string | null;
}

function firstEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Resolve build/deploy metadata. Version comes from the VERSION file
 * (via UWE_VERSION); commit/branch/builtAt/deployRunNumber come from env that
 * CI/the deploy pipeline injects (GitHub Actions provides GITHUB_* by default).
 */
export function getBuildInfo(): BuildInfo {
  return {
    version: UWE_VERSION,
    commit: firstEnv("UWE_COMMIT", "GIT_COMMIT", "GITHUB_SHA"),
    branch: firstEnv("UWE_BRANCH", "GIT_BRANCH", "GITHUB_REF_NAME"),
    builtAt: firstEnv("UWE_BUILT_AT", "BUILD_TIMESTAMP"),
    deployRunNumber: firstEnv("UWE_DEPLOY_RUN_NUMBER", "GITHUB_RUN_NUMBER"),
  };
}

/** Short label for footers, e.g. "v0.1.0 · a1b2c3d". */
export function formatBuildLabel(info: BuildInfo = getBuildInfo()): string {
  const commit = info.commit ? ` · ${info.commit.slice(0, 7)}` : "";
  return `v${info.version}${commit}`;
}
