import { isWeakAuthSecret } from "./production-safety";
import type { SecretsStatusSection, SecretsStatusWarning } from "./secrets-status-service";

function resolveSessionSecretKey(env: NodeJS.ProcessEnv): string {
  return env.SESSION_SECRET?.trim() ? "SESSION_SECRET" : "AUTH_SECRET";
}

function resolveSessionSecretValue(env: NodeJS.ProcessEnv): string | undefined {
  return env.SESSION_SECRET?.trim() || env.AUTH_SECRET?.trim();
}

export function collectRotationDueSecretIds(
  sections: SecretsStatusSection[],
  rotationReminderDays: number,
): string[] {
  const thresholdMs = rotationReminderDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return sections
    .flatMap((section) => section.items)
    .filter((item) => {
      if (item.source !== "db-encrypted" || item.status !== "set" || !item.updatedAt) {
        return false;
      }
      const ageMs = now - new Date(item.updatedAt).getTime();
      return ageMs > thresholdMs;
    })
    .map((item) => item.id);
}

export function buildSecretsStatusWarnings(
  env: NodeJS.ProcessEnv,
  sections: SecretsStatusSection[],
  affectedByRotation: string[],
  rotationDueSecretIds: string[],
  rotationReminderDays: number,
): SecretsStatusWarning[] {
  const warnings: SecretsStatusWarning[] = [];
  const sessionValue = resolveSessionSecretValue(env);
  const sessionKey = resolveSessionSecretKey(env);

  if (!sessionValue) {
    warnings.push({
      id: "secrets:encryption-key-missing",
      severity: "critical",
      title: `${sessionKey} fehlt`,
      description:
        "Ohne Session-/Auth-Secret können verschlüsselte DB-Felder weder geschrieben noch gelesen werden.",
    });
  } else if (isWeakAuthSecret(sessionValue)) {
    warnings.push({
      id: "secrets:encryption-key-weak",
      severity: "critical",
      title: `${sessionKey} ist unsicher`,
      description: "Platzhalter oder zu kurze Werte sind in Production nicht zulässig.",
    });
  }

  if (affectedByRotation.length > 0) {
    warnings.push({
      id: "secrets:auth-secret-rotation",
      severity: "critical",
      title: "AUTH_SECRET-Rotation — verschlüsselte Secrets betroffen",
      description: `${affectedByRotation.length} DB-Secret(s) können nicht entschlüsselt werden. Betroffene Integrationen (Spotify, SMTP in DB, Provider-Keys) müssen neu eingegeben werden — siehe Liste unten.`,
    });
  } else if (sessionValue) {
    warnings.push({
      id: "secrets:auth-secret-rotation-info",
      severity: "info",
      title: "Hinweis: AUTH_SECRET-Rotation",
      description:
        "Eine Änderung von SESSION_SECRET/AUTH_SECRET macht alle DB-verschlüsselten Secrets unlesbar. Plane Re-Konfiguration der betroffenen Dienste vor einer Rotation.",
    });
  }

  const missingBootstrap = sections
    .find((section) => section.id === "bootstrap")
    ?.items.filter((item) => item.status === "missing");
  if (missingBootstrap && missingBootstrap.length > 0) {
    warnings.push({
      id: "secrets:bootstrap-missing",
      severity: "warning",
      title: "Bootstrap-Secrets unvollständig",
      description: `Fehlend: ${missingBootstrap.map((item) => item.label).join(", ")}`,
    });
  }

  if (rotationDueSecretIds.length > 0) {
    const labels = sections
      .flatMap((section) => section.items)
      .filter((item) => rotationDueSecretIds.includes(item.id))
      .map((item) => item.label);
    warnings.push({
      id: "secrets:rotation-due",
      severity: "warning",
      title: `Rotation empfohlen (älter als ${rotationReminderDays} Tage)`,
      description:
        labels.length > 0
          ? `Prüfe und rotiere: ${labels.join(", ")}. Details im Audit-Log unter „Secrets-Status eingesehen“.`
          : `${rotationDueSecretIds.length} DB-Secret(s) sollten rotiert werden.`,
    });
  }

  return warnings;
}
