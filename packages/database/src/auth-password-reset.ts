import type { PrismaClient } from "./client";
import { auditRequestFromHeaders, logAuditEvent } from "./audit-log-service";
import { createMailService } from "./mail-service";
import { createUserService } from "./user-service";

export type PasswordResetSurface = "studio" | "portal";

const NEUTRAL_FORGOT_PASSWORD_MESSAGE =
  "Wenn ein Konto mit dieser E-Mail existiert, erhältst du in Kürze Anweisungen zum Zurücksetzen.";

function buildResetPasswordUrl(
  requestUrl: string,
  email: string,
  resetToken: string,
  resetPath = "/reset-password",
): string {
  const url = new URL(resetPath, requestUrl);
  url.searchParams.set("email", email);
  url.searchParams.set("token", resetToken);
  return url.toString();
}

async function sendPasswordResetEmail(input: {
  db: PrismaClient;
  requestUrl: string;
  email: string;
  resetToken: string;
  surface: PasswordResetSurface;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const env = input.env ?? process.env;
  const resetUrl = buildResetPasswordUrl(input.requestUrl, input.email, input.resetToken);
  const appLabel = input.surface === "studio" ? "UWE Studio" : "UWE Portal";
  const mail = createMailService(input.db);
  const status = await mail.getConfigStatus(env);

  if (!status.configured || !status.enabled) {
    if (env.NODE_ENV !== "production") {
      console.info(
        `[UWE] Passwort-Reset für ${input.email} (${appLabel}) — SMTP nicht konfiguriert. Reset-URL (nur Dev): ${resetUrl}`,
      );
    }
    return;
  }

  const result = await mail.sendMail(
    {
      to: [{ email: input.email }],
      subject: `${appLabel} — Passwort zurücksetzen`,
      bodyText: [
        `Du hast eine Anfrage zum Zurücksetzen deines Passworts für ${appLabel} gestellt.`,
        "",
        `Öffne diesen Link (gültig für eine Stunde):`,
        resetUrl,
        "",
        "Wenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.",
      ].join("\n"),
      bodyHtml: [
        `<p>Du hast eine Anfrage zum Zurücksetzen deines Passworts für <strong>${appLabel}</strong> gestellt.</p>`,
        `<p><a href="${resetUrl}">Passwort zurücksetzen</a></p>`,
        "<p>Wenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.</p>",
      ].join(""),
      sourceType: "password_reset",
      sourceId: input.surface,
    },
    env,
  );

  if (!result.ok && env.NODE_ENV !== "production") {
    console.info(
      `[UWE] Passwort-Reset-Mail fehlgeschlagen für ${input.email}: ${result.error ?? "unbekannt"}`,
    );
  }
}

export async function requestPasswordReset(input: {
  db: PrismaClient;
  email: string;
  request: Pick<Request, "headers" | "url">;
  surface: PasswordResetSurface;
}): Promise<{ ok: true; message: string }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const users = createUserService(input.db);
  const tokenResult = await users.createPasswordResetToken({ email: normalizedEmail });

  if (tokenResult) {
    const user = await users.findUserForAuthentication(normalizedEmail);

    await logAuditEvent(input.db, {
      actorUserId: user?.id,
      action: "password_reset",
      targetType: "user",
      targetId: user?.id,
      request: auditRequestFromHeaders(input.request.headers),
      metadata: {
        email: normalizedEmail,
        method: "request",
        surface: input.surface,
      },
    });

    if (input.request.url) {
      await sendPasswordResetEmail({
        db: input.db,
        requestUrl: input.request.url,
        email: normalizedEmail,
        resetToken: tokenResult.resetToken,
        surface: input.surface,
      });
    }
  }

  return {
    ok: true,
    message: NEUTRAL_FORGOT_PASSWORD_MESSAGE,
  };
}

export async function completePasswordReset(input: {
  db: PrismaClient;
  email: string;
  resetToken: string;
  newPassword: string;
  request: Pick<Request, "headers">;
  surface: PasswordResetSurface;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const newPassword = input.newPassword;

  if (!normalizedEmail || !input.resetToken || !newPassword) {
    return {
      ok: false,
      error: "E-Mail, Reset-Token und neues Passwort sind erforderlich.",
      status: 400,
    };
  }

  if (newPassword.length < 8) {
    return {
      ok: false,
      error: "Neues Passwort muss mindestens 8 Zeichen haben.",
      status: 400,
    };
  }

  const users = createUserService(input.db);
  const success = await users.resetPasswordWithToken({
    email: normalizedEmail,
    resetToken: input.resetToken.trim(),
    newPassword,
  });

  if (!success) {
    await logAuditEvent(input.db, {
      action: "login_failed",
      targetType: "session",
      request: auditRequestFromHeaders(input.request.headers),
      metadata: {
        email: normalizedEmail,
        reason: "invalid_reset_token",
        surface: input.surface,
      },
    });

    return {
      ok: false,
      error: "Ungültiger oder abgelaufener Reset-Link.",
      status: 400,
    };
  }

  return { ok: true };
}
