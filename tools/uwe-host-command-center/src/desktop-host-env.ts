import fs from "node:fs";
import path from "node:path";

import { resolveDesktopHostRoot } from "./desktop-host.ts";

/**
 * Allow-listed host `.env` editing for the Command Center. Only these keys can be
 * read/written from the UI — never arbitrary env — and secrets are marked so the
 * frontend can mask them. Writing preserves the rest of the file (comments, order,
 * unlisted keys) and only touches the listed keys.
 */
export type HostEnvGroup = "Ports" | "Öffentliche URLs" | "Auth & Sicherheit" | "KI" | "Mail";
export type HostEnvKind = "text" | "number" | "boolean" | "password";

export interface HostEnvField {
  key: string;
  label: string;
  group: HostEnvGroup;
  kind: HostEnvKind;
  help?: string;
}

export const HOST_ENV_FIELDS: HostEnvField[] = [
  { key: "STUDIO_PORT", label: "Studio-Port", group: "Ports", kind: "number" },
  { key: "PORTAL_PORT", label: "Portal-Port", group: "Ports", kind: "number" },
  { key: "BRAIN_PORT", label: "Brain-Port", group: "Ports", kind: "number" },
  { key: "PUBLIC_BASE_URL", label: "Öffentliche Basis-URL", group: "Öffentliche URLs", kind: "text" },
  { key: "NEXT_PUBLIC_STUDIO_URL", label: "Studio-URL", group: "Öffentliche URLs", kind: "text" },
  { key: "NEXT_PUBLIC_PORTAL_URL", label: "Portal-URL", group: "Öffentliche URLs", kind: "text" },
  { key: "NEXT_PUBLIC_BRAIN_URL", label: "Brain-URL", group: "Öffentliche URLs", kind: "text", help: "Leer = Brain teilt die Studio-Origin (/life-brain)." },
  { key: "AUTH_REQUIRED", label: "Login erzwingen", group: "Auth & Sicherheit", kind: "boolean" },
  { key: "CLOUDFLARE_TUNNEL", label: "Cloudflare-Tunnel aktiv", group: "Auth & Sicherheit", kind: "boolean" },
  { key: "BRAIN_PUBLIC_TUNNEL", label: "Brain öffentlich (Opt-in)", group: "Auth & Sicherheit", kind: "boolean", help: "Brain über den Tunnel veröffentlichen (owner-gated, 2FA vorausgesetzt)." },
  { key: "BRAIN_EXPOSURE", label: "Brain-Bindung", group: "Auth & Sicherheit", kind: "text", help: "loopback | lan | off" },
  { key: "AI_INFERENCE_PROVIDER", label: "KI-Provider", group: "KI", kind: "text" },
  { key: "AI_INFERENCE_BASE_URL", label: "KI-Basis-URL", group: "KI", kind: "text" },
  { key: "UWE_AI_CLOUD_FALLBACK", label: "Cloud-Fallback erlauben", group: "KI", kind: "boolean" },
  { key: "BRAIN_EMBEDDING_MODEL", label: "Embedding-Modell", group: "KI", kind: "text" },
  { key: "SMTP_HOST", label: "SMTP-Host", group: "Mail", kind: "text" },
  { key: "SMTP_PORT", label: "SMTP-Port", group: "Mail", kind: "number" },
  { key: "SMTP_USER", label: "SMTP-Benutzer", group: "Mail", kind: "text" },
  { key: "SMTP_PASSWORD", label: "SMTP-Passwort", group: "Mail", kind: "password" },
  { key: "SMTP_FROM", label: "Absender (From)", group: "Mail", kind: "text" },
  { key: "SMTP_SECURE", label: "TLS/SSL", group: "Mail", kind: "boolean" },
];

const ALLOWED_KEYS = new Set(HOST_ENV_FIELDS.map((field) => field.key));
const SECRET_KEYS = new Set(HOST_ENV_FIELDS.filter((f) => f.kind === "password").map((f) => f.key));

function envFilePath(rootInput?: string): string {
  return path.join(resolveDesktopHostRoot(rootInput), ".env");
}

function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

/** Allow-listed env values. Secrets are returned as `""` with `configured` flags. */
export function getHostEnv(rootInput?: string): {
  fields: HostEnvField[];
  values: Record<string, string>;
  configured: Record<string, boolean>;
} {
  const file = envFilePath(rootInput);
  const map = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, "utf8")) : new Map<string, string>();
  const values: Record<string, string> = {};
  const configured: Record<string, boolean> = {};
  for (const field of HOST_ENV_FIELDS) {
    const raw = map.get(field.key) ?? "";
    configured[field.key] = raw.trim().length > 0;
    values[field.key] = SECRET_KEYS.has(field.key) ? "" : raw;
  }
  return { fields: HOST_ENV_FIELDS, values, configured };
}

/**
 * Update allow-listed keys in `.env`, preserving every other line. A key present
 * in the file is replaced in place; a new key is appended. A blank value for a
 * secret is ignored (keeps the existing secret) so the masked UI never wipes it.
 */
export function setHostEnv(rootInput: string | undefined, updates: Record<string, string>): {
  ok: boolean;
  written: string[];
} {
  const file = envFilePath(rootInput);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  const written: string[] = [];

  for (const [key, rawValue] of Object.entries(updates)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    const value = String(rawValue ?? "").trim();
    if (SECRET_KEYS.has(key) && value === "") continue; // don't overwrite a secret with blank
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
  return { ok: true, written };
}
