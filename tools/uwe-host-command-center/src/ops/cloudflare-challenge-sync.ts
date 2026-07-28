import { resolveUweAppUrls } from "@uwe/auth";
import {
  DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS,
  applyManagedChallenge,
  fetchManagedChallengeState,
  hasCloudflareCredentials,
  normalizeChallengeHostname,
  normalizeManagedChallengeConfig,
  writeManagedChallengeConfig,
  type ApplyManagedChallengeResult,
  type ManagedChallengeConfig,
  type ManagedChallengeState,
} from "@uwe/cloudflare-edge";
import {
  resolveCloudflareEdgeCredentials,
  type DeploymentSettings,
} from "@uwe/database/deployment";

/**
 * Bridges the owner-editable deployment settings to the Cloudflare edge.
 *
 * Follows the UWE self-service pattern (docs/engineering/self-service-config.md):
 * saving writes the host-readable JSON *and* pushes the rule to Cloudflare, so
 * the Managed Challenge never needs a dashboard visit or a manual step.
 *
 * Kam mit dem Feature aus `apps/studio/src/lib` — dort lag es, weil die
 * Cloudflare-Karte in Studios System-Bereich saß. Auf diesem Stand ist der
 * System-Bereich in die Kommandozentrale gezogen (Abschnitt D), also wohnt die
 * Brücke jetzt hier, direkt neben den Ops-Aktionen, die sie aufrufen.
 */

export interface ManagedChallengeSyncResult {
  config: ManagedChallengeConfig;
  /** Path of the host-readable JSON that was written. */
  configPath: string;
  /** Result of the Cloudflare API apply, or null when no credentials are configured. */
  applied: ApplyManagedChallengeResult | null;
}

/**
 * Hostnames to challenge when the owner has not listed any explicitly: every
 * public UWE origin. Brain is included only when it has its own hostname — on
 * the shared Studio origin it is already covered by the Studio entry.
 */
function defaultHostnames(
  settings: DeploymentSettings,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const urls = resolveUweAppUrls(env);
  return [urls.publicBaseUrl, urls.studioUrl, urls.portalUrl, urls.brainUrl || settings.brainUrl]
    .map(normalizeChallengeHostname)
    .filter((host): host is string => host !== null);
}

/** Maps the stored deployment settings onto the edge rule's desired state. */
export function managedChallengeConfigFromSettings(
  settings: DeploymentSettings,
  env: NodeJS.ProcessEnv = process.env,
): ManagedChallengeConfig {
  const hostnames =
    settings.managedChallengeHostnames.length > 0
      ? settings.managedChallengeHostnames
      : defaultHostnames(settings, env);

  return normalizeManagedChallengeConfig({
    enabled: settings.managedChallengeEnabled,
    hostnames,
    // Additive, never replaceable: challenging the health and callback endpoints
    // would read as a hard outage to the tunnel probes and the systemd timers,
    // so UWE's machine-client exemptions always stay in place.
    skipPaths: [...DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS, ...settings.managedChallengeSkipPaths],
    action: settings.managedChallengeAction,
  });
}

/**
 * Mirrors the desired state to `data/cloudflare/managed-challenge.json` and, when
 * Cloudflare credentials are configured, pushes it to the zone. Never throws —
 * a failed API call is reported in the result so the UI can show it.
 */
export async function syncManagedChallengeFromSettings(
  settings: DeploymentSettings,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ManagedChallengeSyncResult> {
  const config = managedChallengeConfigFromSettings(settings, env);
  const configPath = writeManagedChallengeConfig(config);

  const credentials = resolveCloudflareEdgeCredentials(settings, env);
  if (!hasCloudflareCredentials(credentials)) {
    return { config, configPath, applied: null };
  }

  return { config, configPath, applied: await applyManagedChallenge(config, credentials) };
}

/** Reads the live edge state for the status panel. */
export async function readManagedChallengeEdgeState(
  settings: DeploymentSettings,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ManagedChallengeState> {
  return fetchManagedChallengeState(resolveCloudflareEdgeCredentials(settings, env), {});
}
