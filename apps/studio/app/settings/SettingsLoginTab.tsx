import {
  getUweDeploymentModel,
  getUweRuntimeConfig,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";
import { SettingToggleRow, SettingsToggleGroup } from "@uwe/shared-ui";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { updateSettingsAction } from "../settings-actions";
import { Alert, Button, Input, Label } from "@/src/components/ui";

const HINT_CLASS = "text-sm text-muted-foreground";
const FORM_CLASS = "flex flex-col gap-4";
const FIELD_CLASS = "flex flex-col gap-1.5";
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";
const HEADING_CLASS = "text-lg font-semibold tracking-tight";

interface SettingsLoginTabProps {
  auth: {
    passkeysEnabled: boolean;
    googleLoginEnabled: boolean;
    googleClientId: string;
    googleClientSecretConfigured: boolean;
  };
}

/** Settings tab "Anmeldung": passkeys toggle + owner-only Google OAuth config. */
export async function SettingsLoginTab({ auth }: SettingsLoginTabProps) {
  const currentUser = await getCurrentAuthUser();
  const isOwner = currentUser?.role === "owner";
  const googleRedirectUri = `${resolveStudioPublicBaseUrl()}/api/auth/google/callback`;
  const showSplitHostnameWarning =
    getUweDeploymentModel() === "split-hostname" && !getUweRuntimeConfig().sessionCookieDomain;

  return (
    <div className="flex flex-col gap-6">
      <form action={updateSettingsAction} className={FORM_CLASS}>
        <input type="hidden" name="tab" value="login" />
        <h2 className={HEADING_CLASS}>Anmeldung</h2>
        <p className={HINT_CLASS}>
          Zusätzliche Anmeldemethoden neben E-Mail + Passwort. Gilt für Studio und Portal.
        </p>
        <SettingsToggleGroup title="Passkeys">
          <SettingToggleRow
            name="passkeysEnabled"
            label="Passkey-Login aktiv"
            hint="Anmeldung per Face ID, Touch ID, Fingerabdruck oder Sicherheitsschlüssel (WebAuthn). Benutzer registrieren ihre Passkeys unter Account → Sicherheit. Benötigt HTTPS (oder localhost)."
            defaultChecked={auth.passkeysEnabled}
          />
        </SettingsToggleGroup>
        <p className={HINT_CLASS}>
          Passkeys sind fest an die Domain gebunden, unter der sie registriert wurden. Nach einem
          Domain-Wechsel müssen sie neu registriert werden.
        </p>
        <Button type="submit">Speichern</Button>
      </form>

      <form action={updateSettingsAction} className={FORM_CLASS}>
        <input type="hidden" name="tab" value="login-google" />
        <h3 className={HEADING_CLASS}>Google-Login</h3>
        <p className={HINT_CLASS}>
          „Mit Google anmelden“ — nur für bestehende Konten: Die Google-E-Mail muss zu einem
          eingeladenen UWE-Konto gehören (oder das Konto wurde vorher verknüpft). Es werden keine
          neuen Konten angelegt. Client-ID/Secret kommen aus einem kostenlosen Google-Cloud-Projekt
          (APIs &amp; Dienste → Anmeldedaten → OAuth-Client-ID, Typ „Webanwendung“).
        </p>
        {!isOwner && <Alert tone="info">Nur der Owner kann die Google-Zugangsdaten ändern.</Alert>}
        <SettingsToggleGroup title="Google">
          <SettingToggleRow
            name="googleLoginEnabled"
            label="Google-Login aktiv"
            hint="Zeigt den „Mit Google anmelden“-Button auf den Login-Seiten (sobald Client-ID und Secret gesetzt sind)."
            defaultChecked={auth.googleLoginEnabled}
          />
        </SettingsToggleGroup>
        <div className={FIELD_CLASS}>
          <Label htmlFor="settings-google-client-id">Client-ID</Label>
          <Input
            id="settings-google-client-id"
            name="googleClientId"
            placeholder="xxxx.apps.googleusercontent.com"
            defaultValue={auth.googleClientId}
            disabled={!isOwner}
          />
        </div>
        <div className={FIELD_CLASS}>
          <Label htmlFor="settings-google-client-secret">Client-Secret</Label>
          <Input
            id="settings-google-client-secret"
            name="googleClientSecret"
            type="password"
            autoComplete="off"
            placeholder={
              auth.googleClientSecretConfigured
                ? "Secret gespeichert — leer lassen zum Beibehalten"
                : "Client-Secret eintragen"
            }
            disabled={!isOwner}
          />
        </div>
        <label className={CHECKBOX_ROW_CLASS}>
          <input
            type="checkbox"
            name="clearGoogleClientSecret"
            className={CHECKBOX_CLASS}
            disabled={!isOwner}
          />
          Gespeichertes Secret löschen
        </label>
        <div className={FIELD_CLASS}>
          <Label>Redirect-URI für die Google-Konsole</Label>
          <p className="text-sm">
            <code>{googleRedirectUri}</code>
          </p>
          <p className={HINT_CLASS}>
            Diese URI unter „Autorisierte Weiterleitungs-URIs“ des OAuth-Clients eintragen. Auch
            Portal-Logins laufen über diesen einen Callback.
          </p>
        </div>
        {showSplitHostnameWarning && (
          <Alert tone="warning">
            Split-Hostname-Deployment ohne <code>SESSION_COOKIE_DOMAIN</code>: Google-Logins für
            das Portal können keine portal-lesbare Session setzen. Setze die Cookie-Domain
            (z.&nbsp;B. <code>.deine-domain.org</code>), damit die Anmeldung über Subdomains hinweg
            gilt.
          </Alert>
        )}
        <Button type="submit" disabled={!isOwner}>
          Speichern
        </Button>
      </form>
    </div>
  );
}
