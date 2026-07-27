import { NextResponse } from "next/server";
import { requireOwnerApiAuth } from "@uwe/security";
import { SettingsService, prisma } from "@uwe/database/server";
import { buildManagedChallengeExpression, hasActiveManagedChallenge } from "@uwe/cloudflare-edge";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import {
  managedChallengeConfigFromSettings,
  readManagedChallengeEdgeState,
} from "@/src/lib/cloudflare-challenge-sync";

/**
 * Live state of the Cloudflare Managed Challenge — what the zone actually has,
 * next to what UWE wants it to have. Read-only and owner-gated; changing the
 * rule goes through the settings form (`updateDeploymentConfigAction`).
 *
 * Returns booleans, hostnames and the rule expression only — never the
 * Cloudflare API token.
 */
export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) return authError;

  const settings = await new SettingsService(prisma).getSettings();
  const config = managedChallengeConfigFromSettings(settings.deployment);
  const state = await readManagedChallengeEdgeState(settings.deployment);

  const desiredActive = hasActiveManagedChallenge(config);
  const inSync = state.ok && desiredActive === state.active;

  return NextResponse.json({
    ok: state.ok,
    inSync,
    desired: {
      active: desiredActive,
      hostnames: config.hostnames,
      skipPaths: config.skipPaths,
      action: config.action,
      expression: desiredActive ? buildManagedChallengeExpression(config) : null,
    },
    edge: {
      ok: state.ok,
      present: state.present,
      active: state.active,
      action: state.action,
      expression: state.expression,
      foreignRuleCount: state.foreignRuleCount,
      message: state.message,
    },
  });
}
