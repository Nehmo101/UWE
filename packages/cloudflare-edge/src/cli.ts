/**
 * CLI for the Cloudflare Managed Challenge — the host-side half of the
 * self-service loop.
 *
 * Studio writes the desired state to `data/cloudflare/managed-challenge.json`
 * and normally applies it itself. This CLI re-applies the same file from the
 * host, for the cases Studio cannot cover: first bootstrap, recovery after a
 * dashboard edit, or a deployment where the Cloudflare API token lives only in
 * `/etc/uwe/cloudflare.env` and never in the database.
 *
 * Usage (see deploy/scripts/configure-cloudflare-managed-challenge.sh):
 *   pnpm cloudflare:challenge            # apply the stored desired state
 *   pnpm cloudflare:challenge --status   # read-only: what is live at the edge
 *   pnpm cloudflare:challenge --dry-run  # print the rule, call nothing
 */

import { readManagedChallengeConfig } from "./config-file";
import {
  buildManagedChallengeExpression,
  hasActiveManagedChallenge,
  type ManagedChallengeConfig,
} from "./managed-challenge";
import {
  applyManagedChallenge,
  fetchManagedChallengeState,
  hasCloudflareCredentials,
  type CloudflareEdgeCredentials,
} from "./ruleset-client";

function credentialsFromEnv(): CloudflareEdgeCredentials {
  return {
    apiToken: process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CF_API_TOKEN?.trim() || null,
    zoneId: process.env.CLOUDFLARE_ZONE_ID?.trim() || process.env.CF_ZONE_ID?.trim() || null,
  };
}

function describe(config: ManagedChallengeConfig): string {
  if (!hasActiveManagedChallenge(config)) {
    return config.enabled
      ? "Gewünscht: aktiv, aber kein gültiger Hostname konfiguriert → Regel wird entfernt."
      : "Gewünscht: keine Managed Challenge → Regel wird entfernt.";
  }
  return [
    `Gewünscht: ${config.action}`,
    `  Hostnames:  ${config.hostnames.join(", ")}`,
    `  Ausnahmen:  ${config.skipPaths.join(", ") || "—"}`,
    `  Ausdruck:   ${buildManagedChallengeExpression(config)}`,
  ].join("\n");
}

async function main(): Promise<number> {
  const args = new Set(process.argv.slice(2));
  if (args.has("-h") || args.has("--help")) {
    console.log("Usage: pnpm cloudflare:challenge [--status | --dry-run]");
    return 0;
  }

  const config = readManagedChallengeConfig();
  const credentials = credentialsFromEnv();

  if (args.has("--dry-run")) {
    console.log(describe(config));
    console.log(
      hasCloudflareCredentials(credentials)
        ? "[DRY-RUN] Zugangsdaten vorhanden — keine API-Aufrufe."
        : "[DRY-RUN] CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID fehlen — ein echter Lauf würde abbrechen.",
    );
    return 0;
  }

  if (!hasCloudflareCredentials(credentials)) {
    console.error("[FAIL] CLOUDFLARE_API_TOKEN und CLOUDFLARE_ZONE_ID müssen gesetzt sein.");
    console.error("Lege sie in /etc/uwe/cloudflare.env (mode 600) ab.");
    console.error("Token-Rechte: Zone → Zone WAF → Edit auf der UWE-Zone.");
    return 1;
  }

  if (args.has("--status")) {
    const state = await fetchManagedChallengeState(credentials);
    console.log(describe(config));
    console.log(`Edge: ${state.message}`);
    if (state.expression) {
      console.log(`  Aktiver Ausdruck: ${state.expression}`);
    }
    return state.ok ? 0 : 1;
  }

  console.log(describe(config));
  const result = await applyManagedChallenge(config, credentials);
  console.log(`${result.ok ? "[OK]" : "[FAIL]"} ${result.message}`);
  return result.ok ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error("[FAIL]", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
