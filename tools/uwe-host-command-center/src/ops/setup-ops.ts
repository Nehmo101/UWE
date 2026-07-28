import { buildGoogleOAuthSettingsUpdate } from "@uwe/database/login-methods-settings";
import {
  buildMailSmtpCredentialsUpdate,
  createSettingsService,
  getOwnerSetupSnapshot,
  type PrismaClient,
} from "@uwe/database/server";

/**
 * Owner-Einrichtung vom Command Center aus — Ersatz für Studio `/admin/setup`
 * (Abschnitt D7).
 *
 * Zwei Dinge, die die Deployment-Fläche nicht abdeckt:
 *
 * 1. Der Setup-Überblick: was ist konfiguriert, was fehlt noch. Reine Statuslage,
 *    ohne Secret-Werte — `getOwnerSetupSnapshot` liefert Labels, keine Klartexte.
 * 2. Die SMTP-Zugangsdaten *in der Datenbank*. Deployment schreibt `.env`; ist in
 *    der DB etwas hinterlegt, gewinnt das gegen `.env`. Ohne einen Weg, den
 *    DB-Eintrag zu löschen, wäre eine alte Konfiguration nicht mehr ablösbar.
 */

export async function setupStatus(db: PrismaClient): Promise<unknown> {
  // Das Command Center läuft auf dem Host; physischer Zugang ist die
  // Autorisierung. Deshalb der volle Owner-Blick, so wie bei jeder anderen
  // Aktion dieser CLI.
  return getOwnerSetupSnapshot(db, { isOwner: true, canEdit: true });
}

export async function smtpStatus(db: PrismaClient): Promise<unknown> {
  const settings = await createSettingsService(db).getSettingsForClient();
  return settings.mail.smtp;
}

export interface SetSmtpBody {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from?: string;
  useMock?: boolean;
}

/** Schreibt die DB-SMTP-Zugangsdaten. Das Passwort kommt über stdin, nie über argv. */
export async function setSmtp(db: PrismaClient, body: SetSmtpBody): Promise<unknown> {
  const service = createSettingsService(db);
  const current = await service.getSettings();
  const useMock = body.useMock === true;
  const host = (body.host ?? "").trim();

  if (!host && !useMock) {
    throw new Error("SMTP-Host ist erforderlich (oder useMock setzen).");
  }

  let credentials;
  try {
    credentials = buildMailSmtpCredentialsUpdate({
      host,
      port: Number.isFinite(body.port) && (body.port ?? 0) > 0 ? Number(body.port) : 587,
      secure: body.secure === true,
      user: body.user ?? "",
      password: body.password,
      from: body.from ?? "",
      useMock,
      existing: current.mail.smtpCredentials,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SMTP_PASSWORD_REQUIRED") {
      throw new Error("SMTP-Passwort ist erforderlich (oder das bestehende beibehalten).");
    }
    throw error;
  }

  await service.updateSettings({ mail: { smtpCredentials: credentials } });
  return (await service.getSettingsForClient()).mail.smtp;
}

/** Entfernt die DB-Zugangsdaten, damit wieder `.env` gilt. */
export async function clearSmtp(db: PrismaClient): Promise<unknown> {
  const service = createSettingsService(db);
  await service.updateSettings({ mail: { smtpCredentials: null } });
  return (await service.getSettingsForClient()).mail.smtp;
}

/**
 * Google-Login setzen — Anmeldemethoden sind Systemeinstellungen und gehören
 * damit hierher (Abschnitt D33), nicht in Studio. Das Client-Secret läuft wie
 * das SMTP-Passwort über eine eigene Aktion statt über settings-update, weil
 * es verschlüsselt zusammengebaut wird und den Host nie wieder verlässt.
 */
export async function setGoogleLogin(
  db: PrismaClient,
  body: {
    googleLoginEnabled?: boolean;
    googleClientId?: string;
    googleClientSecret?: string;
    clearGoogleClientSecret?: boolean;
  },
): Promise<{ ok: boolean; googleClientSecretConfigured: boolean }> {
  const service = createSettingsService(db);
  const current = await service.getSettings();
  // Nicht mitgesendete Felder bleiben, wie sie sind — die Karte schickt nur das
  // Secret, Schalter und Client-ID laufen über settings-update.
  const auth = buildGoogleOAuthSettingsUpdate(
    {
      googleLoginEnabled:
        body.googleLoginEnabled === undefined
          ? current.auth.googleLoginEnabled
          : body.googleLoginEnabled === true,
      googleClientId:
        body.googleClientId === undefined ? current.auth.googleClientId : String(body.googleClientId),
      googleClientSecret: body.googleClientSecret,
      clearGoogleClientSecret: body.clearGoogleClientSecret === true,
    },
    current.auth,
  );
  await service.updateSettings({ auth });
  return { ok: true, googleClientSecretConfigured: auth.googleClientSecretConfigured };
}
