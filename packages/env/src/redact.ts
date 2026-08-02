import { resolveRawEnv } from "./config/env";

const STATIC_SECRET_KEYS = [
  "SESSION_SECRET",
  "AUTH_SECRET",
  "UWE_SETUP_TOKEN",
  "STUDIO_API_TOKEN",
  "RTX_SERVICE_TOKEN",
  "RTX_AGENT_TOKEN",
  "AI_INFERENCE_API_KEY",
  "CLOUD_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_ACCESS_TOKEN",
  "SPOTIFY_REFRESH_TOKEN",
  "SMTP_PASSWORD",
  "CALDAV_PASSWORD",
  "GITHUB_TOKEN",
  "GITHUB_ISSUE_TOKEN",
  "AGENT_TOKEN",
  "password",
  "token",
  "secret",
] as const;

const STATIC_SECRET_PATTERNS = [
  /password[=:]\s*\S+/gi,
  /smtp[_-]?pass(?:word)?[=:]\s*\S+/gi,
  /authorization:\s*\S+/gi,
  /bearer\s+[a-z0-9._-]+/gi,
  /api[_-]?key[=:]\s*\S+/gi,
  /client[_-]?secret[=:]\s*\S+/gi,
  /"content"\s*:\s*"[^"]+"/gi,
];

const REDACTED = "[REDACTED]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectKnownSecretValues(env: NodeJS.ProcessEnv = process.env): string[] {
  const values = new Set<string>();
  const raw = resolveRawEnv(env);

  for (const key of STATIC_SECRET_KEYS) {
    const value = env[key]?.trim();
    if (value && value.length >= 4) {
      values.add(value);
    }
  }

  const derived = [
    raw.SESSION_SECRET,
    raw.UWE_SETUP_TOKEN,
    raw.RTX_SERVICE_TOKEN,
  ];

  for (const value of derived) {
    if (value && value.length >= 4) {
      values.add(value);
    }
  }

  return [...values].sort((a, b) => b.length - a.length);
}

function redactKnownValues(text: string, env: NodeJS.ProcessEnv): string {
  let result = text;

  for (const value of collectKnownSecretValues(env)) {
    result = result.split(value).join(REDACTED);
  }

  return result;
}

function redactKeyValuePairs(text: string): string {
  let result = text;

  for (const key of STATIC_SECRET_KEYS) {
    const pattern = new RegExp(`(${escapeRegExp(key)}\\s*=\\s*)([^\\s\\r\\n]+)`, "gi");
    result = result.replace(pattern, `$1${REDACTED}`);
  }

  return result;
}

function redactPatterns(text: string): string {
  let result = text;

  for (const pattern of STATIC_SECRET_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }

  return result;
}

/**
 * Removes known secret values and common secret patterns from log/error text.
 */
export function redactSecrets(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!text) {
    return text;
  }

  let result = text;
  result = redactKnownValues(result, env);
  result = redactKeyValuePairs(result);
  result = redactPatterns(result);
  return result;
}

export function redactError(error: unknown, env: NodeJS.ProcessEnv = process.env): Error {
  if (error instanceof Error) {
    const redacted = new Error(redactSecrets(error.message, env));
    redacted.name = error.name;
    if (error.stack) {
      redacted.stack = redactSecrets(error.stack, env);
    }
    return redacted;
  }

  return new Error(redactSecrets(String(error), env));
}
