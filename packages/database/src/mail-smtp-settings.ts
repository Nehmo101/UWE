import { mergeSmtpConfig } from "@uwe/mail";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import type { MailSmtpStoredCredentials, UweSystemSettings } from "./settings-service";

export function resolveEffectiveSmtpConfig(
  settings: UweSystemSettings,
  env: NodeJS.ProcessEnv = process.env,
): import("@uwe/mail").SmtpConfig {
  const creds = settings.mail.smtpCredentials;
  const portalConfig = creds?.host
    ? {
        enabled: settings.mail.enabled,
        host: creds.host,
        port: creds.port,
        secure: creds.secure,
        user: creds.user,
        password: decryptSecret(creds.passwordEnc, resolveTokenEncryptionSecret()),
        from: creds.from,
        logBody: settings.mail.logBody,
        useMock: creds.useMock,
      }
    : null;

  return mergeSmtpConfig(env, portalConfig, {
    enabled: settings.mail.enabled,
    logBody: settings.mail.logBody,
  });
}

export function buildMailSmtpCredentialsUpdate(input: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  from: string;
  useMock: boolean;
  existing?: MailSmtpStoredCredentials | null;
}): MailSmtpStoredCredentials | null {
  const host = input.host.trim();
  if (!host && !input.useMock) {
    return null;
  }

  const password = input.password?.trim();
  const passwordEnc =
    password && password.length > 0
      ? encryptSecret(password, resolveTokenEncryptionSecret())
      : input.existing?.passwordEnc;

  if (!passwordEnc && !input.useMock) {
    throw new Error("SMTP_PASSWORD_REQUIRED");
  }

  return {
    host,
    port: input.port,
    secure: input.secure,
    user: input.user.trim(),
    passwordEnc: passwordEnc ?? "",
    from: input.from.trim(),
    useMock: input.useMock,
  };
}
