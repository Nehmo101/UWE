const SECRET_PATTERNS: RegExp[] = [
  /(rtx_agent_token\s*=\s*)([^\s\r\n]+)/gi,
  /(agent_token\s*=\s*)([^\s\r\n]+)/gi,
  /(studio_api_token\s*=\s*)([^\s\r\n]+)/gi,
  /(authorization:\s*bearer\s+)([^\s\r\n]+)/gi,
  /(bearer\s+)([^\s\r\n]+)/gi,
  /(api[_-]?key\s*[=:]\s*)([^\s\r\n&"']+)/gi,
  /(sk-[a-zA-Z0-9_-]{10,})/g,
  /("systemPrompt"\s*:\s*")([^"]+)(")/gi,
  /("content"\s*:\s*")([^"]{200,})(")/gi,
];

const DEFAULT_PROMPT_LOG_CHARS = 240;

export function redactAiSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (_match, prefix: string, _secret: string, suffix = "") => {
      return `${prefix}***REDACTED***${suffix}`;
    });
  }
  return result;
}

export function truncatePromptForLog(
  prompt: string,
  maxChars = resolvePromptLogMaxChars(),
): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}… (${trimmed.length} Zeichen gesamt)`;
}

export function resolvePromptLogMaxChars(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.AI_LOG_PROMPT_MAX_CHARS?.trim();
  if (!raw) {
    return DEFAULT_PROMPT_LOG_CHARS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROMPT_LOG_CHARS;
}

export function shouldLogAiPrompts(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AI_LOG_PROMPTS?.trim().toLowerCase() === "true";
}

export function formatAiPromptLog(prompt: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!shouldLogAiPrompts(env)) {
    return "[prompt logging disabled]";
  }
  return redactAiSecrets(truncatePromptForLog(prompt, resolvePromptLogMaxChars(env)));
}

export function sanitizeAiLogPayload(
  payload: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === "systemPrompt" || key === "apiKey" || key === "token") {
      continue;
    }

    if (key === "prompt" || key === "userPrompt") {
      sanitized[key] =
        typeof value === "string" ? formatAiPromptLog(value, env) : "[non-string prompt]";
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = redactAiSecrets(value);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}
