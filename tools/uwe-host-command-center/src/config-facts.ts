import fs from "node:fs/promises";

export interface ConfigFact {
  key: string;
  value: string;
  redacted: boolean;
}

export interface ConfigFactsSnapshot {
  envFile: string;
  available: boolean;
  message: string;
  facts: ConfigFact[];
}

const SENSITIVE_KEY = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_KEY|AUTH_KEY)/i;

const INTERESTING_KEYS = new Set([
  "NODE_ENV",
  "STUDIO_PORT",
  "PORTAL_PORT",
  "PORT",
  "PUBLIC_APP_URL",
  "NEXT_PUBLIC_STUDIO_URL",
  "NEXT_PUBLIC_PORTAL_URL",
  "TRUST_PROXY",
  "CLOUDFLARE_TUNNEL",
  "AUTH_REQUIRED",
  // Owner-only Brain surface. NEXT_PUBLIC_BRAIN_URL
  // already passes via the NEXT_PUBLIC_ prefix; surface path + exposure too.
  "BRAIN_PATH",
  "BRAIN_EXPOSURE",
  "UWE_DATA_DIR",
  "UWE_BACKUP_DIR",
  "UWE_EXPORT_DIR",
  "DATABASE_URL",
  "MAIL_ENABLED",
  "UWE_HOST_UPDATE_ENABLED",
  "HOST_COMMAND_CENTER_PORT",
  "HOST_COMMAND_CENTER_BIND",
]);

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const eq = withoutExport.indexOf("=");
  if (eq <= 0) return null;
  const key = withoutExport.slice(0, eq).trim();
  let value = withoutExport.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function isInteresting(key: string): boolean {
  if (INTERESTING_KEYS.has(key)) return true;
  if (key.startsWith("UWE_") && !SENSITIVE_KEY.test(key)) return true;
  if (key.startsWith("NEXT_PUBLIC_")) return true;
  return false;
}

function redactValue(key: string, value: string): ConfigFact {
  const sensitive = SENSITIVE_KEY.test(key);
  if (!sensitive) {
    return { key, value, redacted: false };
  }
  if (!value) {
    return { key, value: "—", redacted: true };
  }
  const tail = value.length > 4 ? value.slice(-4) : "••••";
  return { key, value: `••••${tail}`, redacted: true };
}

export async function collectConfigFacts(
  envFile = process.env.UWE_ENV ?? "/etc/uwe/uwe.env",
): Promise<ConfigFactsSnapshot> {
  let raw: string;
  try {
    raw = await fs.readFile(envFile, "utf8");
  } catch {
    return {
      envFile,
      available: false,
      message: "uwe.env nicht lesbar",
      facts: [],
    };
  }

  const facts: ConfigFact[] = [];
  for (const line of raw.split("\n")) {
    const parsed = parseEnvLine(line);
    if (!parsed || !isInteresting(parsed.key)) continue;
    facts.push(redactValue(parsed.key, parsed.value));
  }

  facts.sort((a, b) => a.key.localeCompare(b.key, "de"));

  return {
    envFile,
    available: true,
    message: facts.length ? `${facts.length} Konfigurationswerte` : "Keine relevanten Keys",
    facts,
  };
}
