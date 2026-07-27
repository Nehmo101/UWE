/**
 * Host-readable mirror of the Managed-Challenge desired state.
 *
 * Follows the UWE self-service pattern (docs/engineering/self-service-config.md):
 * the owner edits the setting in Studio, Studio writes this JSON, and the host
 * script `deploy/scripts/configure-cloudflare-managed-challenge.sh` reads it to
 * (re-)apply the rule from the host — for bootstrap, recovery, or when Studio
 * has no Cloudflare API token of its own.
 *
 * Deliberately secret-free: the file holds only the desired rule shape, never
 * the Cloudflare API token (that stays encrypted in the database or in
 * `/etc/uwe/cloudflare.env`).
 */

import fs from "node:fs";
import path from "node:path";
import { resolveDataDir } from "@uwe/assets";
import {
  DEFAULT_MANAGED_CHALLENGE_CONFIG,
  normalizeManagedChallengeConfig,
  type ManagedChallengeConfig,
} from "./managed-challenge";

const CONFIG_DIRNAME = "cloudflare";
const CONFIG_FILENAME = "managed-challenge.json";

/** Absolute path of the host-readable config (`<data>/cloudflare/managed-challenge.json`). */
export function resolveManagedChallengeConfigPath(baseDir?: string): string {
  return path.join(resolveDataDir(baseDir), CONFIG_DIRNAME, CONFIG_FILENAME);
}

/** Reads the config; a missing or corrupt file yields the safe default (disabled). */
export function readManagedChallengeConfig(baseDir?: string): ManagedChallengeConfig {
  const configPath = resolveManagedChallengeConfigPath(baseDir);
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_MANAGED_CHALLENGE_CONFIG };
  }
  try {
    return normalizeManagedChallengeConfig(JSON.parse(fs.readFileSync(configPath, "utf-8")));
  } catch {
    return { ...DEFAULT_MANAGED_CHALLENGE_CONFIG };
  }
}

/** Writes the normalised config so host scripts can read the same desired state. */
export function writeManagedChallengeConfig(
  config: ManagedChallengeConfig,
  baseDir?: string,
): string {
  const configPath = resolveManagedChallengeConfigPath(baseDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const safe = normalizeManagedChallengeConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(safe, null, 2)}\n`, "utf-8");
  return configPath;
}
