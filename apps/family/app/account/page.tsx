import { createSettingsService } from "@uwe/database/server";
import { getSharedPrismaClient } from "@uwe/database/client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { AccountSecurity } from "@/src/components/account/AccountSecurity";

/**
 * Konto — Passwort, Zwei-Faktor, FaceID.
 *
 * Der Grund für diese Seite: wer ausschliesslich Family nutzt, konnte sein
 * Konto bisher gar nicht verwalten. Passwort ändern, 2FA einrichten und einen
 * Passkey hinterlegen ging nur in Portal oder Studio — Bereiche, die dieselbe
 * Person weder betreten darf noch je sehen sollte.
 *
 * Die Abläufe sind dieselben wie dort; geteilt werden die Route-Handler
 * (`@uwe/auth`, `@uwe/passkeys`), nicht die Oberfläche.
 */

export const dynamic = "force-dynamic";

export default async function FamilyAccountPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/account" title="Konto">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const settings = await createSettingsService(getSharedPrismaClient()).getSettings();

  return (
    <FamilyShell
      active="/account"
      title="Konto"
      eyebrow="Gemeinsamer Bereich"
      lede={`Angemeldet als ${user.displayName}. Passwort, Zwei-Faktor-Anmeldung und FaceID richtest du hier ein — alles an einem Ort.`}
    >
      <AccountSecurity passkeysEnabled={settings.auth.passkeysEnabled} />
    </FamilyShell>
  );
}
