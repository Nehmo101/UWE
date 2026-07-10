import {
  decryptSecret,
  encryptSecret,
  resolveTokenEncryptionSecret,
} from "./token-crypto";
import type {
  AiProviderKeyPlaceholder,
  AiProviderStoredKey,
  UweSystemSettings,
} from "./settings-service";

// AI-Provider-Schlüssel-Helfer (Env-/DB-Auflösung, Verschlüsselung, Placeholder).
// Aus `settings-service.ts` herausgezogen (Modul-Disziplin) — Verhalten unverändert.
// Öffentliche Symbole werden über `settings-service.ts` re-exportiert.

export function buildProviderKeyPlaceholders(
  storedKeys?: AiProviderStoredKey[] | null,
): AiProviderKeyPlaceholder[] {
  const providers: Array<{ id: string; label: string; envKey: string }> = [
    { id: "openai", label: "OpenAI", envKey: "OPENAI_API_KEY" },
    { id: "anthropic", label: "Anthropic", envKey: "ANTHROPIC_API_KEY" },
    { id: "gemini", label: "Google Gemini", envKey: "GEMINI_API_KEY" },
    { id: "openrouter", label: "OpenRouter", envKey: "OPENROUTER_API_KEY" },
  ];

  return providers.map((provider) => {
    const fromEnv = Boolean(process.env[provider.envKey]?.trim());
    if (fromEnv) {
      return { id: provider.id, label: provider.label, configured: true, source: "env" as const };
    }
    const fromDb = storedKeys?.some((k) => k.providerId === provider.id && k.keyEnc);
    if (fromDb) {
      return { id: provider.id, label: provider.label, configured: true, source: "db" as const };
    }
    return { id: provider.id, label: provider.label, configured: false, source: "none" as const };
  });
}

/** Encrypts or replaces a single provider key in the stored list. Pass key=undefined to remove. */
export function buildAiProviderKeyUpdate(
  providerId: string,
  key: string | undefined,
  existing: AiProviderStoredKey[] | null | undefined,
): AiProviderStoredKey[] {
  const current = existing ?? [];
  if (!key || !key.trim()) {
    return current.filter((k) => k.providerId !== providerId);
  }
  const keyEnc = encryptSecret(key.trim(), resolveTokenEncryptionSecret());
  return [
    ...current.filter((k) => k.providerId !== providerId),
    { providerId, keyEnc },
  ];
}

/** Returns decrypted API keys from settings (env takes precedence, then DB). */
export function resolveDecryptedProviderKeys(
  settings: UweSystemSettings,
): Record<string, string> {
  const result: Record<string, string> = {};
  const stored = settings.ai.cloudApiKeys;
  if (!stored?.length) return result;

  const secret = resolveTokenEncryptionSecret();
  for (const storedKey of stored) {
    if (storedKey.keyEnc) {
      try {
        const decrypted = decryptSecret(storedKey.keyEnc, secret);
        if (decrypted) {
          result[storedKey.providerId] = decrypted;
        }
      } catch {
        // ignore individual decrypt failures
      }
    }
  }
  return result;
}
