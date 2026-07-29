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

import { parseServicePort, type HostPaths } from "./desktop-host-types.ts";

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function buildLocalHostEnv(paths: HostPaths): string {
  const sessionSecret = randomBytes(48).toString("base64url");
  const setupToken = randomBytes(32).toString("base64url");
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
    "STUDIO_PORT=3000",
    "PORTAL_PORT=3001",
    "FAMILY_PORT=3004",
    // Öffentliche Startseite auf dem Apex-Origin — eigener Prozess, damit die
    // Hauptdomain keine Studio-Routen ausliefert.
    "LANDING_PORT=3103",
    "NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:3000",
    "PUBLIC_BASE_URL=http://127.0.0.1:3000",
    "NEXT_PUBLIC_PORTAL_URL=http://127.0.0.1:3001",
    "# Brain: owner-only on every route; reachability is a deliberate choice (ADR 004/007).",
    "# Empty NEXT_PUBLIC_BRAIN_URL = share the Studio origin; entry is /life-brain.",
    "NEXT_PUBLIC_BRAIN_URL=",
    "BRAIN_PATH=/life-brain",
    "BRAIN_EXPOSURE=loopback",
    // Family: eigener Origin, Zugang über das Häkchen `Family`. Der Wert ist die
    // Adresse, auf die jeder Family-Link zeigt — bei öffentlicher Installation
    // hier den Tunnel-Hostnamen eintragen (z. B. https://family.uwe.example).
    "NEXT_PUBLIC_FAMILY_URL=http://127.0.0.1:3004",
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
