import type { MailConfigStatus, SmtpConfig } from "./types";

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }
  return value === "true" || value === "1";
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "587", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

export function resolveSmtpConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides?: Partial<Pick<SmtpConfig, "enabled" | "logBody" | "useMock">>,
): SmtpConfig {
  const host = env.SMTP_HOST?.trim() ?? "";
  const user = env.SMTP_USER?.trim() ?? "";
  const password = env.SMTP_PASSWORD?.trim() ?? "";
  const from = env.MAIL_FROM?.trim() ?? "";

  return {
    enabled: overrides?.enabled ?? env.MAIL_ENABLED !== "false",
    host,
    port: parsePort(env.SMTP_PORT),
    secure: parseBoolean(env.SMTP_SECURE, false),
    user,
    password,
    from,
    logBody: overrides?.logBody ?? parseBoolean(env.MAIL_LOG_BODY, false),
    useMock: overrides?.useMock ?? parseBoolean(env.MAIL_USE_MOCK, false),
  };
}

export function isSmtpConfigured(config: SmtpConfig): boolean {
  if (config.useMock) {
    return true;
  }

  return Boolean(config.host && config.from);
}

export function getMailConfigStatus(
  env: NodeJS.ProcessEnv = process.env,
  overrides?: Partial<Pick<SmtpConfig, "enabled" | "logBody" | "useMock">>,
): MailConfigStatus {
  const config = resolveSmtpConfig(env, overrides);
  return getMailConfigStatusFromSmtpConfig(config);
}

export function getMailConfigStatusFromSmtpConfig(config: SmtpConfig): MailConfigStatus {
  const configured = isSmtpConfigured(config);

  let message: string;
  if (!config.enabled) {
    message = "Mail ist deaktiviert (MAIL_ENABLED=false).";
  } else if (config.useMock) {
    message = "Mock-Modus aktiv — keine echte SMTP-Verbindung.";
  } else if (!config.host) {
    message = "SMTP_HOST fehlt.";
  } else if (!config.from) {
    message = "MAIL_FROM fehlt.";
  } else if (!config.user || !config.password) {
    message = "SMTP-Anmeldedaten unvollständig — Testmail kann fehlschlagen.";
  } else {
    message = "SMTP konfiguriert.";
  }

  return {
    enabled: config.enabled,
    configured,
    host: config.host || null,
    port: config.port,
    secure: config.secure,
    userConfigured: Boolean(config.user),
    passwordConfigured: Boolean(config.password),
    fromAddress: config.from || null,
    logBody: config.logBody,
    useMock: config.useMock,
    message,
  };
}

export function mergeSmtpConfig(
  env: NodeJS.ProcessEnv = process.env,
  portal?: Partial<SmtpConfig> | null,
  overrides?: Partial<Pick<SmtpConfig, "enabled" | "logBody" | "useMock">>,
): SmtpConfig {
  const envConfig = resolveSmtpConfig(env, overrides);
  if (!portal?.host?.trim() && !portal?.useMock) {
    return envConfig;
  }

  return {
    enabled: overrides?.enabled ?? portal.enabled ?? envConfig.enabled,
    host: portal.host?.trim() ?? envConfig.host,
    port: portal.port ?? envConfig.port,
    secure: portal.secure ?? envConfig.secure,
    user: portal.user?.trim() ?? envConfig.user,
    password: portal.password ?? envConfig.password,
    from: portal.from?.trim() ?? envConfig.from,
    logBody: overrides?.logBody ?? portal.logBody ?? envConfig.logBody,
    useMock: overrides?.useMock ?? portal.useMock ?? envConfig.useMock,
  };
}
