import { getTurnstileConfig } from "@uwe/auth";
import { createSettingsService, type PrismaClient } from "@uwe/database/server";
import {
  buildDeploymentEnvOverrides,
  buildDeploymentSettingsUpdate,
  type DeploymentOverride,
  type DeploymentSettingsInput,
} from "@uwe/database/deployment";

/**
 * Cloudflare Turnstile aus der Kommandozentrale — die „Bist du ein Mensch?"-Prüfung
 * *auf* den Login-Formularen von Studio, Portal und Startseite.
 *
 * Das Gegenstück zur Managed Challenge nebenan: die Challenge filtert an der Edge,
 * bevor ein Request den Host erreicht, Turnstile sichert das Anmeldeformular selbst
 * ab — und wirkt auch ohne Cloudflare-Tunnel davor. Beide dürfen gleichzeitig laufen.
 *
 * Die Funktion war vollständig gebaut (Widget in den Login-Formularen, Prüfung in
 * `@uwe/auth/turnstile`, CSP-Anpassung in `security-headers`), aber nirgends
 * einstellbar: die Schlüssel gab es nur über `.env` von Hand. Diese Aktion schließt
 * die Lücke nach demselben Muster wie die Managed Challenge — Deployment-Settings
 * in der DB, Secret verschlüsselt, `.env` bleibt Rückfallebene.
 *
 * Der Secret-Key verlässt den Host nie Richtung UI; der Status meldet nur, *ob*
 * einer hinterlegt ist.
 */

export interface TurnstileStatus {
  ok: boolean;
  /** Gespeicherter Schalter: "env" = `.env` entscheidet, "on"/"off" übersteuern. */
  mode: DeploymentOverride;
  siteKey: string;
  secretConfigured: boolean;
  /** Was die Apps tatsächlich tun — Schalter *und* beide Schlüssel entscheiden. */
  effective: boolean;
  /** Warum `effective` so ist, in einem Satz für die Karte. */
  message: string;
}

function parseMode(value: unknown): DeploymentOverride {
  return value === "on" || value === "off" ? value : "env";
}

/**
 * Baut die Umgebung nach, die die Apps zur Laufzeit sehen: Host-`.env` (von
 * `loadEnvFromRoot` bereits geladen) plus die gespeicherten Deployment-Overrides.
 * Damit beantwortet `getTurnstileConfig` dieselbe Frage wie im laufenden Studio,
 * statt dass die Karte die Regel ein zweites Mal nachbildet.
 */
function resolveEffective(
  overrides: Record<string, string>,
): ReturnType<typeof getTurnstileConfig> {
  return getTurnstileConfig({ ...process.env, ...overrides });
}

function describe(mode: DeploymentOverride, config: ReturnType<typeof getTurnstileConfig>): string {
  if (config.enabled) {
    return "Aktiv — Studio, Portal und Startseite zeigen die Prüfung vor dem Login.";
  }
  if (mode === "off") {
    return "Ausgeschaltet. Die Schlüssel bleiben gespeichert und greifen wieder, sobald du den Schalter umlegst.";
  }
  if (!config.siteKey && !config.secretConfigured) {
    return "Noch keine Schlüssel hinterlegt — ohne Site-Key und Secret bleibt die Prüfung aus.";
  }
  return config.siteKey
    ? "Es fehlt das Secret — ohne serverseitige Prüfung bliebe das Widget wirkungslos, deshalb bleibt es aus."
    : "Es fehlt der Site-Key — ohne ihn kann das Widget nicht gerendert werden.";
}

export async function getTurnstileStatus(db: PrismaClient): Promise<TurnstileStatus> {
  const deployment = (await createSettingsService(db).getSettings()).deployment;
  const config = resolveEffective(buildDeploymentEnvOverrides(deployment));
  const mode = deployment.turnstileEnabled;

  return {
    ok: true,
    mode,
    siteKey: deployment.turnstileSiteKey,
    secretConfigured: deployment.turnstileSecretConfigured,
    effective: config.enabled,
    message: describe(mode, config),
  };
}

export interface SetTurnstileBody {
  mode?: unknown;
  siteKey?: unknown;
  secret?: unknown;
  clearSecret?: unknown;
}

/**
 * Schreibt Schalter, Site-Key und (optional) das Secret. Ein leeres Secret-Feld
 * lässt das gespeicherte unangetastet — sonst würde jedes Speichern der Karte,
 * die das Secret nie zurückliest, es versehentlich löschen.
 */
export async function setTurnstile(
  db: PrismaClient,
  body: SetTurnstileBody,
): Promise<TurnstileStatus> {
  const service = createSettingsService(db);
  const current = await service.getSettings();

  const input: DeploymentSettingsInput = {
    turnstileEnabled: parseMode(body.mode),
    turnstileSiteKey: typeof body.siteKey === "string" ? body.siteKey.trim() : "",
    turnstileSecret: typeof body.secret === "string" ? body.secret.trim() : undefined,
    clearTurnstileSecret: body.clearSecret === true,
  };

  const deployment = buildDeploymentSettingsUpdate(input, current.deployment);
  await service.updateSettings({ deployment });

  return getTurnstileStatus(db);
}
