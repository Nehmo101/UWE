import {
  SettingsService,
  type PrismaClient,
} from "@uwe/database/server";
import {
  buildDeploymentSettingsUpdate,
  resolveCloudflareEdgeCredentials,
  sanitizeDeploymentSettingsForClient,
  type DeploymentSettingsInput,
} from "@uwe/database/deployment";
import {
  buildManagedChallengeExpression,
  hasActiveManagedChallenge,
  hasCloudflareCredentials,
  parseListInput,
} from "@uwe/cloudflare-edge";
import {
  managedChallengeConfigFromSettings,
  readManagedChallengeEdgeState,
  syncManagedChallengeFromSettings,
} from "./cloudflare-challenge-sync";

/**
 * Managed Challenge aus der Kommandozentrale — ersetzt Studios
 * System-→-Cloudflare-Karte (die Seite gibt es seit Abschnitt D nicht mehr).
 *
 * Drei Aktionen, gleicher Schnitt wie auf der Studio-Seite zuvor:
 * - status: gespeicherter Soll-Zustand plus Ist-Stand aus der Zone.
 * - set:    Einstellungen speichern, Host-JSON schreiben, Regel sofort anwenden.
 * - apply:  nur die Regel erneut anwenden (Recovery, ohne Speichern).
 *
 * Der API-Token bleibt verschlüsselt in den Deployment-Settings und verlässt
 * den Host nie Richtung UI — Status und Antworten laufen durch
 * `sanitizeDeploymentSettingsForClient`.
 */

function parseChallengeAction(value: unknown): string {
  return value === "js_challenge" ? "js_challenge" : "managed_challenge";
}

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return parseListInput(typeof value === "string" ? value : "");
}

export async function getManagedChallengeStatus(db: PrismaClient): Promise<unknown> {
  const service = new SettingsService(db);
  const settings = await service.getSettings();
  const deployment = settings.deployment;

  const config = managedChallengeConfigFromSettings(deployment);
  const desiredActive = hasActiveManagedChallenge(config);
  const credentialsConfigured = hasCloudflareCredentials(
    resolveCloudflareEdgeCredentials(deployment),
  );

  // Der Ist-Stand kommt live aus der Zone; ohne Zugangsdaten gibt es nur den
  // Soll-Zustand. fetchManagedChallengeState wirft nie, sondern beschreibt
  // Fehler im Ergebnis. Antwortform wie Studios frühere Status-Route, damit die
  // Karte in der Kommandozentrale dieselben Felder liest.
  const edge = credentialsConfigured ? await readManagedChallengeEdgeState(deployment) : null;
  const inSync = edge !== null && edge.ok && desiredActive === edge.active;

  return {
    ok: edge === null || edge.ok,
    inSync,
    credentialsConfigured,
    desired: {
      active: desiredActive,
      hostnames: config.hostnames,
      skipPaths: config.skipPaths,
      action: config.action,
      expression: desiredActive ? buildManagedChallengeExpression(config) : null,
    },
    edge,
    deployment: sanitizeDeploymentSettingsForClient(deployment),
  };
}

export async function setManagedChallenge(
  db: PrismaClient,
  body: Record<string, unknown>,
): Promise<unknown> {
  const service = new SettingsService(db);
  const current = await service.getSettings();

  const input: DeploymentSettingsInput = {
    managedChallengeEnabled: body.enabled === true,
    managedChallengeHostnames: parseList(body.hostnames),
    managedChallengeSkipPaths: parseList(body.skipPaths),
    managedChallengeAction: parseChallengeAction(body.action),
    cloudflareZoneId: typeof body.zoneId === "string" ? body.zoneId.trim() : "",
    cloudflareApiToken: typeof body.apiToken === "string" ? body.apiToken.trim() : "",
    clearCloudflareApiToken: body.clearApiToken === true,
  };

  const deployment = buildDeploymentSettingsUpdate(input, current.deployment);
  await service.updateSettings({ deployment });

  // Sofort an die Edge — der Sinn des Self-Service-Musters ist, dass nach dem
  // Speichern kein Dashboard- oder Host-Schritt mehr folgt. Ein Fehler steht
  // im Ergebnis, damit die Oberfläche ihn zeigt, statt Erfolg zu melden.
  const { config, applied } = await syncManagedChallengeFromSettings(deployment);
  return {
    ok: applied === null || applied.ok,
    config,
    applied,
    deployment: sanitizeDeploymentSettingsForClient(deployment),
  };
}

export async function applyManagedChallengeNow(db: PrismaClient): Promise<unknown> {
  const service = new SettingsService(db);
  const settings = await service.getSettings();
  const { config, applied } = await syncManagedChallengeFromSettings(settings.deployment);
  return { ok: applied === null || applied.ok, config, applied };
}
