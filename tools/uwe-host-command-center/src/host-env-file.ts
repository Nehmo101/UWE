/**
 * Die lokale `.env` des All-in-one-Hosts: erzeugen, ergänzen, lesen.
 *
 * Aus `desktop-host.ts` herausgezogen — dort ging es um Prozesse und Zustand,
 * hier ausschließlich um die Konfigurationsdatei. `desktop-host.ts`
 * re-exportiert `buildLocalHostEnv` und `resolveDatabasePath` weiter, damit
 * Bestandsimporte (u. a. die Tests) unverändert gültig bleiben.
 *
 * Abgrenzung zu `desktop-host-env.ts`: das ist der **Editor** für eine
 * Positivliste von Schlüsseln aus der Oberfläche. Hier steht die Vorlage der
 * Erstinstallation und das Lesen für Prozess-Umgebungen.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import {
  HOST_SERVICE_IDS,
  HOST_SERVICE_LABELS,
  parseServicePort,
  SERVICE_PORT_ENV,
  type HostPaths,
  type HostServiceId,
} from "./desktop-host-types.ts";
import type { InstallPorts } from "./install-selection.ts";

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

/**
 * Die Loopback-URLs, die einen Dienstport mitführen. Ändert sich der Port, muss
 * die zugehörige URL mitwandern — sonst zeigt der erste Link nach der
 * Einrichtung ins Leere.
 *
 * `PUBLIC_BASE_URL` steht bei beiden: lokal ist der Apex-Origin die Studio-
 * Adresse, bei öffentlicher Installation die Startseite. Welcher der beiden
 * gemeint ist, entscheidet der Portvergleich — und eine öffentliche (nicht
 * Loopback-)Adresse wird ohnehin nie angefasst.
 */
const PORT_COMPANION_URLS: Record<HostServiceId, string[]> = {
  studio: ["NEXT_PUBLIC_STUDIO_URL", "PUBLIC_BASE_URL"],
  portal: ["NEXT_PUBLIC_PORTAL_URL"],
  brain: ["NEXT_PUBLIC_BRAIN_URL"],
  family: ["NEXT_PUBLIC_FAMILY_URL"],
  landing: ["PUBLIC_BASE_URL"],
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Der Port dieses Dienstes: Wahl des Assistenten, sonst der Standard. */
export function resolveSelectedPort(id: HostServiceId, ports: InstallPorts = {}): number {
  return ports[id] ?? SERVICE_PORT_ENV[id].fallback;
}

/** Zeigt dieser Wert auf `127.0.0.1:<port>` (oder localhost/::1)? */
function isLoopbackUrlForPort(value: string | undefined, port: number): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) && url.port === String(port);
  } catch {
    return false;
  }
}

export function buildLocalHostEnv(paths: HostPaths, ports: InstallPorts = {}): string {
  const sessionSecret = randomBytes(48).toString("base64url");
  const setupToken = randomBytes(32).toString("base64url");
  const port = (id: HostServiceId) => resolveSelectedPort(id, ports);
  return [
    "# Managed initial local-host configuration for UWE Command Center.",
    "# Existing files are preserved and can be edited in Studio later.",
    "NODE_ENV=production",
    `SESSION_SECRET=${sessionSecret}`,
    `UWE_SETUP_TOKEN=${setupToken}`,
    "UWE_RUNTIME_ROLE=host",
    "RUN_DB_SEED=false",
    "AUTH_REQUIRED=true",
    "SESSION_COOKIE_SECURE=false",
    "SESSION_COOKIE_SAMESITE=lax",
    "TRUST_PROXY=false",
    "CLOUDFLARE_TUNNEL=false",
    `STUDIO_PORT=${port("studio")}`,
    `PORTAL_PORT=${port("portal")}`,
    `BRAIN_PORT=${port("brain")}`,
    `FAMILY_PORT=${port("family")}`,
    // Öffentliche Startseite auf dem Apex-Origin — eigener Prozess, damit die
    // Hauptdomain keine Studio-Routen ausliefert.
    `LANDING_PORT=${port("landing")}`,
    `NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:${port("studio")}`,
    `PUBLIC_BASE_URL=http://127.0.0.1:${port("studio")}`,
    `NEXT_PUBLIC_PORTAL_URL=http://127.0.0.1:${port("portal")}`,
    "# Brain: owner-only on every route; reachability is a deliberate choice (ADR 004/007).",
    "# Empty NEXT_PUBLIC_BRAIN_URL = share the Studio origin; entry is /life-brain.",
    "NEXT_PUBLIC_BRAIN_URL=",
    "BRAIN_PATH=/life-brain",
    "BRAIN_EXPOSURE=loopback",
    // Family: eigener Origin, Zugang über das Häkchen `Family`. Der Wert ist die
    // Adresse, auf die jeder Family-Link zeigt — bei öffentlicher Installation
    // hier den Tunnel-Hostnamen eintragen (z. B. https://family.uwe.example).
    `NEXT_PUBLIC_FAMILY_URL=http://127.0.0.1:${port("family")}`,
    `DATABASE_URL=file:${toPosixPath(paths.database)}`,
    // Owner-private Brain DB lives next to uwe.db so both are found deterministically
    // (the Next standalone build can't reliably resolve brain-client's relative default).
    `BRAIN_DATABASE_URL=file:${toPosixPath(path.join(paths.data, "uwe-brain.db"))}`,
    `FAMILY_DATABASE_URL=file:${toPosixPath(path.join(paths.data, "uwe-family.db"))}`,
    `UWE_DATA_DIR=${toPosixPath(paths.data)}`,
    `UWE_UPLOADS_DIR=${toPosixPath(paths.uploads)}`,
    `UWE_BACKUP_DIR=${toPosixPath(paths.backups)}`,
    `UWE_EXPORT_DIR=${toPosixPath(paths.exports)}`,
    "AI_INFERENCE_ENABLED=true",
    "AI_INFERENCE_PROVIDER=ollama",
    "AI_INFERENCE_BASE_URL=http://127.0.0.1:11434",
    "AI_INFERENCE_ALLOW_PUBLIC_URL=false",
    "UWE_AI_CLOUD_FALLBACK=false",
    "BRAIN_EMBEDDINGS_ENABLED=true",
    "BRAIN_EMBEDDING_PROVIDER=ollama",
    "BRAIN_EMBEDDING_MODEL=nomic-embed-text",
    "",
  ].join("\n");
}

/**
 * Ergänzt Pflichtwerte, die eine ältere oder von Hand gepflegte `.env` nicht
 * kennt. `onLog` meldet die Ergänzung ins Einrichtungs-Log; der Aufrufer
 * besitzt das Log, dieses Modul nur die Datei.
 */
export function ensureRequiredLocalEnv(
  paths: HostPaths,
  onLog: (line: string) => void = () => {},
): void {
  const content = fs.readFileSync(paths.envFile, "utf8");
  const env = readEnvFile(paths.envFile);
  const studioPort = parseServicePort(env.STUDIO_PORT, 3000);
  const publicBaseUrl = env.PUBLIC_BASE_URL?.trim() || `http://127.0.0.1:${studioPort}`;
  let loopback = false;
  try {
    const hostname = new URL(publicBaseUrl).hostname.toLowerCase();
    loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    // The central environment validator reports malformed URLs with full context.
  }
  const defaults = [
    ["PUBLIC_BASE_URL", publicBaseUrl],
    ...(loopback ? [["TRUST_PROXY", "false"], ["CLOUDFLARE_TUNNEL", "false"]] : []),
  ];
  const missing = defaults.filter(([key]) => !new RegExp(`^${key}=`, "m").test(content));
  if (missing.length === 0) return;
  fs.appendFileSync(
    paths.envFile,
    `\n# Required runtime defaults for the local all-in-one host.\n${missing.map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    "utf8",
  );
  onLog(`Fehlende lokale Laufzeitwerte ergänzt: ${missing.map(([key]) => key).join(", ")}.`);
}

/**
 * Setzt Schlüssel in einer bestehenden `.env`, ohne den Rest der Datei
 * anzufassen: ein vorhandener Schlüssel wird an Ort und Stelle ersetzt, ein
 * neuer angehängt. Kommentare, Reihenfolge und alle nicht genannten Schlüssel
 * bleiben, wie sie sind.
 *
 * Die eine Schreibstelle für `.env`-Werte — der Editor unter „Deployment"
 * (`desktop-host-env.ts`) und die Portübernahme der Einrichtung benutzen sie
 * beide.
 */
export function updateEnvKeys(file: string, updates: Record<string, string>): string[] {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  const written: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^\\s*${key}\\s*=`);
    const index = lines.findIndex((line) => pattern.test(line) && !line.trim().startsWith("#"));
    if (index >= 0) {
      lines[index] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
    written.push(key);
  }
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  return written;
}

/**
 * Die Folgeänderungen einer Portänderung: die Loopback-URL des Dienstes wandert
 * mit. Ohne sie schreibt jeder Portwechsel eine `.env`, in der der Dienst auf
 * dem neuen Port lauscht, während `NEXT_PUBLIC_*_URL` weiter auf den alten
 * zeigt — der Dienst läuft, aber jeder Link führt ins Leere.
 *
 * Zwei Adressen bleiben unangetastet: eine öffentliche (Tunnel-Hostname), die
 * gehört Cloudflare und nicht dem Port. Und eine, die der Aufrufer im selben
 * Speichervorgang selbst ändert — dann gilt seine Eingabe, nicht die Ableitung.
 *
 * `updates` ist die Menge, die geschrieben werden soll (Schlüssel → Wert);
 * verglichen wird gegen den Stand in der Datei.
 */
export function companionUrlUpdates(
  envFile: string,
  updates: Record<string, string>,
): Record<string, string> {
  if (!fs.existsSync(envFile)) return {};
  const env = readEnvFile(envFile);
  const result: Record<string, string> = {};

  for (const id of HOST_SERVICE_IDS) {
    const { key, fallback } = SERVICE_PORT_ENV[id];
    if (!(key in updates)) continue;
    const wanted = Number(updates[key]);
    if (!Number.isInteger(wanted)) continue;
    const current = parseServicePort(env[key], fallback);
    if (current === wanted) continue;

    for (const urlKey of PORT_COMPANION_URLS[id]) {
      const submitted = updates[urlKey];
      if (submitted !== undefined && submitted !== (env[urlKey] ?? "").trim()) continue;
      if (isLoopbackUrlForPort(env[urlKey], current)) {
        result[urlKey] = `http://127.0.0.1:${wanted}`;
      }
    }
  }

  return result;
}

/**
 * Trägt die im Ersteinrichtungs-Assistenten gewählten Ports in eine **bestehende**
 * `.env` ein. Eine frisch angelegte Datei bringt sie schon mit
 * (`buildLocalHostEnv`); dieser Weg ist der für Installationen, die es vorher
 * schon gab — „Reparieren" und ein zweiter Lauf des Assistenten.
 */
export function applySelectedPorts(
  paths: HostPaths,
  ports: InstallPorts,
  onLog: (line: string) => void = () => {},
): string[] {
  if (!fs.existsSync(paths.envFile)) return [];
  const env = readEnvFile(paths.envFile);
  const updates: Record<string, string> = {};
  const changed: string[] = [];

  for (const id of HOST_SERVICE_IDS) {
    const wanted = ports[id];
    if (wanted === undefined) continue;
    const { key, fallback } = SERVICE_PORT_ENV[id];
    const current = parseServicePort(env[key], fallback);
    if (current === wanted) continue;

    updates[key] = String(wanted);
    changed.push(`${HOST_SERVICE_LABELS[id]} ${current} → ${wanted}`);
  }

  if (changed.length === 0) return [];
  const written = updateEnvKeys(paths.envFile, {
    ...updates,
    ...companionUrlUpdates(paths.envFile, updates),
  });
  onLog(`Ports übernommen: ${changed.join(", ")}.`);
  return written;
}

/** `.env` über `process.env` gelegt — die Umgebung für gestartete Dienste. */
export function readEnvFile(envFile: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!fs.existsSync(envFile)) return env;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function resolveDatabasePath(root: string, envFile: string, fallback: string): string {
  const value = readEnvFile(envFile).DATABASE_URL?.trim();
  if (!value?.startsWith("file:")) return fallback;
  const raw = value.slice("file:".length);
  if (/^[A-Za-z]:[\\/]/.test(raw) || path.isAbsolute(raw)) return path.normalize(raw);
  return path.resolve(root, "packages", "database", raw);
}
