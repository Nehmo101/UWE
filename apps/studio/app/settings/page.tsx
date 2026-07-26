import Link from "next/link";
import {
  BACKGROUND_PATTERN_LABELS,
  CANONICAL_LABELS,
  SettingToggleRow,
  SettingsToggleGroup,
  ThemeSettingsPanel,
  ThemePicker,
  VISIBILITY_LABELS,
  VisualThemePreview,
} from "@uwe/shared-ui";
import { SettingsCollapsiblePanel } from "../../components/SettingsCollapsiblePanel";
import { SettingsGeneralTab } from "./SettingsGeneralTab";
import { SettingsStatusTab } from "./SettingsStatusTab";
import {
  BACKGROUND_PATTERN_VALUES,
  CanonicalStatusEnum,
  getAppRepository,
  getPersistentPathConfiguration,
  resolveEffectiveBackupsPath,
  resolveEffectiveExportsPath,
  resolveEffectiveUploadsPath,
  resolveAgentJobsConfig,
  resolveCalendarConfig,
  resolveDndApiConfig,
  VisibilityEnum,
} from "@uwe/database/server";
import {
  getUweDeploymentModel,
  getUweRuntimeConfig,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { updateSettingsAction, setWorldGuestModeAction } from "../settings-actions";
import { PortalThemeSettingsSection } from "../../components/PortalThemeSettingsSection";
import { DesignAssistantWizard } from "../../components/DesignAssistantWizard";
import { CustomThemesManager } from "../../components/CustomThemesManager";
import { IntegrationsSetupPanel } from "../../components/IntegrationsSetupPanel";
import { BreadcrumbTrail, SettingsShell, SystemShell } from "@/src/components/shell";
import { resolveThemePreferencesForScope } from "@uwe/database/server";
import { getSpotifyConfigurationSummary } from "@/src/lib/spotify-handlers";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

const TABS = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Design & Theme" },
  { id: "worlds", label: "Worlds" },
  { id: "portal", label: "Portal" },
  { id: "privacy", label: "Privacy" },
  { id: "login", label: "Anmeldung" },
  { id: "storage", label: "Storage" },
  { id: "ai", label: "AI" },
  { id: "integrations", label: "Integrationen" },
  { id: "image-studio", label: "Image Studio" },
  { id: "mail", label: "Mail" },
  { id: "backup", label: "Backup" },
  { id: "briefing", label: "Briefing" },
  { id: "maintenance", label: "Notfallmodus" },
  { id: "status", label: "Systemstatus" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  searchParams: Promise<{ tab?: string; saved?: string }>;
}

function isTabId(value: string | undefined): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

// Lokale Helfer/Konstanten, um Kit-Markup kompakt zu halten (siehe design-consolidation.md).
const HINT_CLASS = "text-sm text-muted-foreground";
const FORM_CLASS = "flex flex-col gap-4";
const STACK_CLASS = "flex flex-col gap-6";
const FIELD_CLASS = "flex flex-col gap-1.5";
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";
const HEADING_CLASS = "text-lg font-semibold tracking-tight";
const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";
const NATIVE_SELECT_CLASS =
  "flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Kompakter Label+Select-Wrapper für Felder ohne Leerwert-Bedarf (Kit-Select). */
function FieldSelect({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: Props) {
  const { tab: tabParam, saved } = await searchParams;
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "general";

  const repo = getAppRepository();
  const [settings, worlds] = await Promise.all([
    repo.getSystemSettings(),
    repo.listWorldsWithGuestMode(),
  ]);

  const uploadsPath = resolveEffectiveUploadsPath(settings);
  const backupsPath = resolveEffectiveBackupsPath(settings);
  const exportsPath = resolveEffectiveExportsPath(settings);
  const paths = getPersistentPathConfiguration(settings);
  const imageStudioConfig = settings.imageStudio;
  const calendarConfig = resolveCalendarConfig();
  const agentJobsConfig = resolveAgentJobsConfig();
  const dndApiConfig = resolveDndApiConfig();
  const spotifyOAuth = getSpotifyConfigurationSummary();
  const currentUser = await getCurrentAuthUser();
  const isOwner = currentUser?.role === "owner";
  const googleRedirectUri = `${resolveStudioPublicBaseUrl()}/api/auth/google/callback`;
  const deploymentModel = getUweDeploymentModel();
  const sessionCookieDomain = getUweRuntimeConfig().sessionCookieDomain;

  const pathSourceLabel = {
    settings: "Studio-Einstellungen",
    env: "Umgebungsvariable",
    default: "Standard",
  } as const;

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Heute", href: "/today" }, { label: "Einstellungen" }]}
        />
      }
    >
      <SettingsShell
        title="Admin- & Systemeinstellungen"
        description="Laufende App-Konfiguration für Design, Welten, KI und Mail Center. Host-Setup, Secrets und Verbindungstests: Einrichtung."
        tabs={TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          href: `/settings?tab=${tab.id}`,
          active: activeTab === tab.id,
        }))}
      >
        {saved === "1" && (
          <Alert tone="success" className="mb-4">
            Einstellungen gespeichert.
          </Alert>
        )}

        <Alert tone="info" className="mb-4">
          Host-Setup, Secrets und Verbindungstests findest du in der{" "}
          <Link href="/admin/setup">Einrichtung</Link>.
        </Alert>

        {activeTab === "general" && (
          <SettingsGeneralTab defaultLandingPage={settings.app.defaultLandingPage} />
        )}

        {activeTab === "appearance" && (
          <div className={STACK_CLASS}>
            <ThemeSettingsPanel />
            <SettingsCollapsiblePanel
              title="Neues Design mit KI erstellen"
              summary="Farbpalette per Fragebogen-Chat mit dem lokalen RTX-Assistenten"
              defaultOpen={false}
            >
              <DesignAssistantWizard />
            </SettingsCollapsiblePanel>
            {(settings.app.customThemes?.length ?? 0) > 0 && (
              <SettingsCollapsiblePanel
                title="Eigene Designs verwalten"
                summary={`${settings.app.customThemes?.length} gespeicherte(s) Custom-Design(s)`}
                defaultOpen={false}
              >
                <CustomThemesManager themes={settings.app.customThemes ?? []} />
              </SettingsCollapsiblePanel>
            )}
            <SettingsCollapsiblePanel
              title="Portal-Design"
              summary="Separates Theme für das Spieler-Portal"
              defaultOpen
            >
              <PortalThemeSettingsSection
                initialPreferences={resolveThemePreferencesForScope(settings.app, "portal")}
              />
            </SettingsCollapsiblePanel>
            <SettingsCollapsiblePanel
              title="Server-Standards (SSR)"
              summary="Dark/Light, Muster, Motion beim ersten Paint"
              defaultOpen={false}
            >
              <form id="settings-visual-preview-form" action={updateSettingsAction} className={FORM_CLASS}>
                <input type="hidden" name="tab" value="general" />
                <p className={HINT_CLASS}>
                  Dark/Light/System und Motion für <code>data-uwe-*</code>-Attribute beim ersten
                  Paint. Preset-Themes und erweiterte Optionen werden über das Studio-Panel oben
                  synchronisiert.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={FORM_CLASS}>
                    <ThemePicker defaultValue={settings.app.theme} preview />
                    <FieldSelect
                      id="settings-background-pattern"
                      name="backgroundPattern"
                      label="Hintergrundmuster"
                      defaultValue={settings.app.backgroundPattern}
                      options={BACKGROUND_PATTERN_VALUES.map((pattern) => ({
                        value: pattern,
                        label: BACKGROUND_PATTERN_LABELS[pattern],
                      }))}
                    />
                    <p className={HINT_CLASS}>
                      Reine CSS-Muster ohne Canvas — abschaltbar über „Keins“. Auf Mobilgeräten
                      keine Daueranimationen.
                    </p>
                    {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                    <label className={CHECKBOX_ROW_CLASS}>
                      <input type="checkbox" name="frostedGlass" value="on" defaultChecked={settings.app.frostedGlass} className={CHECKBOX_CLASS} />
                      Frosted Glass (Milchglas-Oberflächen)
                    </label>
                    <p className={HINT_CLASS}>
                      Aus = undurchsichtige Panels für maximale Lesbarkeit. An = dezenter
                      Backdrop-Blur auf Karten, Leisten und Modals.
                    </p>
                    <label className={CHECKBOX_ROW_CLASS}>
                      <input type="checkbox" name="motionEnabled" value="on" defaultChecked={settings.app.motionEnabled} className={CHECKBOX_CLASS} />
                      Dezente UI-Animationen
                    </label>
                    <p className={HINT_CLASS}>
                      Respektiert immer <code>prefers-reduced-motion</code> des Systems.
                    </p>
                  </div>
                  <VisualThemePreview
                    formId="settings-visual-preview-form"
                    initial={{
                      theme: settings.app.theme,
                      backgroundPattern: settings.app.backgroundPattern,
                      frostedGlass: settings.app.frostedGlass,
                      motionEnabled: settings.app.motionEnabled,
                    }}
                  />
                </div>
                <Button type="submit">Server-Standards speichern</Button>
              </form>
            </SettingsCollapsiblePanel>
          </div>
        )}

        {activeTab === "worlds" && (
          <div className={STACK_CLASS}>
            <form action={updateSettingsAction} className={FORM_CLASS}>
              <input type="hidden" name="tab" value="worlds" />
              <h2 className={HEADING_CLASS}>World Settings</h2>
              <FieldSelect
                id="settings-default-visibility"
                name="defaultVisibility"
                label="Default Visibility"
                defaultValue={settings.worlds.defaultVisibility}
                options={Object.values(VisibilityEnum).map((value) => ({
                  value,
                  label: VISIBILITY_LABELS[value],
                }))}
              />
              <FieldSelect
                id="settings-default-canonical-status"
                name="defaultCanonicalStatus"
                label="Default Canonical Status"
                defaultValue={settings.worlds.defaultCanonicalStatus}
                options={Object.values(CanonicalStatusEnum).map((value) => ({
                  value,
                  label: CANONICAL_LABELS[value],
                }))}
              />
              <Button type="submit">Speichern</Button>
            </form>

            <section>
              <h2 className={HEADING_CLASS}>Campaign Settings</h2>
              <p className={HINT_CLASS}>
                Kampagnen erben aktuell die Welt-Defaults (
                {settings.campaigns.inheritWorldDefaults ? "aktiv" : "deaktiviert"}).
              </p>
            </section>

            <section>
              <h2 className={HEADING_CLASS}>Bevorzugte DnD-Welt</h2>
              <p className={HINT_CLASS}>
                Wird auf /today prominent angezeigt. Leer = Env{" "}
                <code>PREFERRED_WORLD_SLUG</code>, dann Terra (falls vorhanden), sonst erste
                Welt. Terra wird nie hardcodiert erzwungen.
              </p>
              <div className={FIELD_CLASS}>
                <Label htmlFor="settings-favorite-world">Favorit für Today-Dashboard</Label>
                {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
                    "Automatisch" — natives Select beibehalten. */}
                <select
                  id="settings-favorite-world"
                  name="favoriteWorldSlug"
                  defaultValue={settings.app.favoriteWorldSlug ?? ""}
                  className={NATIVE_SELECT_CLASS}
                >
                  <option value="">— Automatisch —</option>
                  {worlds.map((world) => (
                    <option key={world.id} value={world.slug}>
                      {world.name} ({world.slug})
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section>
              <h2 className={HEADING_CLASS}>Gastmodus pro Welt</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Welt</th>
                      <th className={TH_CLASS}>Gastmodus</th>
                      <th className={TH_CLASS}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worlds.map((world) => (
                      <tr key={world.id}>
                        <td className={TD_CLASS}>{world.name}</td>
                        <td className={TD_CLASS}>{world.guestModeEnabled ? "Aktiv" : "Inaktiv"}</td>
                        <td className={TD_CLASS}>
                          <form action={setWorldGuestModeAction} className="inline">
                            <input type="hidden" name="worldId" value={world.id} />
                            <input type="hidden" name="tab" value="worlds" />
                            <input
                              type="hidden"
                              name="guestModeEnabled"
                              value={world.guestModeEnabled ? "0" : "1"}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              {world.guestModeEnabled ? "Deaktivieren" : "Aktivieren"}
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === "portal" && (
          <form action={updateSettingsAction} className={FORM_CLASS}>
            <input type="hidden" name="tab" value="portal" />
            <h2 className={HEADING_CLASS}>Portal Settings</h2>
            <p className={HINT_CLASS}>
              Steuert Sichtbarkeit und Zugang zum Spieler-Portal. Änderungen wirken sofort nach
              Speichern.
            </p>
            <SettingsToggleGroup title="Portal-Zugang">
              <SettingToggleRow
                name="portalEnabled"
                label="Portal aktiv"
                hint="Schaltet das Spieler-Portal ein oder aus. Deaktiviert = keine Wiki-Ausgabe für Spieler."
                defaultChecked={settings.portal.portalEnabled}
              />
              <SettingToggleRow
                name="guestAccessEnabled"
                label="Guest Access aktiv"
                hint="Erlaubt anonymen Lesezugriff auf Welten im Gastmodus (nur player_visible Inhalte)."
                defaultChecked={settings.portal.guestAccessEnabled}
              />
              <SettingToggleRow
                name="publicSharingEnabled"
                label="Public Sharing aktiv"
                hint="Erlaubt öffentliche Share-Links für Handouts — prüfe bewusst, welche Inhalte geteilt werden."
                defaultChecked={settings.portal.publicSharingEnabled}
              />
            </SettingsToggleGroup>
            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "privacy" && (
          <form action={updateSettingsAction} className={FORM_CLASS}>
            <input type="hidden" name="tab" value="privacy" />
            <h2 className={HEADING_CLASS}>Privacy Settings</h2>
            <p className={HINT_CLASS}>
              Secrets werden niemals im Klartext angezeigt. API Keys werden nur über
              Umgebungsvariablen konfiguriert.
            </p>
            <label className={CHECKBOX_ROW_CLASS}>
              <input type="checkbox" checked disabled readOnly className={CHECKBOX_CLASS} />
              Secrets in UI maskieren (immer aktiv)
            </label>
            <label className={CHECKBOX_ROW_CLASS}>
              <input type="checkbox" name="restrictPublicExport" defaultChecked={settings.privacy.restrictPublicExport} className={CHECKBOX_CLASS} />
              Öffentlichen Export einschränken
            </label>

            <h3 className={HEADING_CLASS}>Session &amp; Abmeldung</h3>
            <p className={HINT_CLASS}>
              Nach der eingestellten Inaktivitätszeit werden Benutzer automatisch abgemeldet
              (Studio und Portal). 0 = deaktiviert. Alternativ per ENV{" "}
              <code>SESSION_INACTIVITY_TIMEOUT_MINUTES</code>, wenn hier 0 gesetzt ist.
            </p>
            <div className={FIELD_CLASS}>
              <Label htmlFor="settings-session-timeout">Inaktivitäts-Timeout (Minuten)</Label>
              <Input
                id="settings-session-timeout"
                type="number"
                name="sessionInactivityTimeoutMinutes"
                min={0}
                max={1440}
                step={5}
                defaultValue={settings.auth.sessionInactivityTimeoutMinutes}
              />
            </div>

            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "login" && (
          <div className={STACK_CLASS}>
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
                  defaultChecked={settings.auth.passkeysEnabled}
                />
              </SettingsToggleGroup>
              <p className={HINT_CLASS}>
                Passkeys sind fest an die Domain gebunden, unter der sie registriert wurden. Nach
                einem Domain-Wechsel müssen sie neu registriert werden.
              </p>
              <Button type="submit">Speichern</Button>
            </form>

            <form action={updateSettingsAction} className={FORM_CLASS}>
              <input type="hidden" name="tab" value="login-google" />
              <h3 className={HEADING_CLASS}>Google-Login</h3>
              <p className={HINT_CLASS}>
                „Mit Google anmelden“ — nur für bestehende Konten: Die Google-E-Mail muss zu einem
                eingeladenen UWE-Konto gehören (oder das Konto wurde vorher verknüpft). Es werden
                keine neuen Konten angelegt. Client-ID/Secret kommen aus einem kostenlosen
                Google-Cloud-Projekt (APIs &amp; Dienste → Anmeldedaten → OAuth-Client-ID,
                Typ „Webanwendung“).
              </p>
              {!isOwner && (
                <Alert tone="info">
                  Nur der Owner kann die Google-Zugangsdaten ändern.
                </Alert>
              )}
              <SettingsToggleGroup title="Google">
                <SettingToggleRow
                  name="googleLoginEnabled"
                  label="Google-Login aktiv"
                  hint="Zeigt den „Mit Google anmelden“-Button auf den Login-Seiten (sobald Client-ID und Secret gesetzt sind)."
                  defaultChecked={settings.auth.googleLoginEnabled}
                />
              </SettingsToggleGroup>
              <div className={FIELD_CLASS}>
                <Label htmlFor="settings-google-client-id">Client-ID</Label>
                <Input
                  id="settings-google-client-id"
                  name="googleClientId"
                  placeholder="xxxx.apps.googleusercontent.com"
                  defaultValue={settings.auth.googleClientId}
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
                    settings.auth.googleClientSecretConfigured
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
                  Diese URI unter „Autorisierte Weiterleitungs-URIs“ des OAuth-Clients eintragen.
                  Auch Portal-Logins laufen über diesen einen Callback.
                </p>
              </div>
              {deploymentModel === "split-hostname" && !sessionCookieDomain && (
                <Alert tone="warning">
                  Split-Hostname-Deployment ohne <code>SESSION_COOKIE_DOMAIN</code>: Google-Logins
                  für das Portal können keine portal-lesbare Session setzen. Setze die
                  Cookie-Domain (z.&nbsp;B. <code>.deine-domain.org</code>), damit die Anmeldung
                  über Subdomains hinweg gilt.
                </Alert>
              )}
              <Button type="submit" disabled={!isOwner}>
                Speichern
              </Button>
            </form>
          </div>
        )}

        {activeTab === "storage" && (
          <form action={updateSettingsAction} className={FORM_CLASS}>
            <input type="hidden" name="tab" value="storage" />
            <h2 className={HEADING_CLASS}>Storage Settings</h2>
            <p className={HINT_CLASS}>
              Persistente Pfade können über Umgebungsvariablen (`.env`) oder hier in den
              Studio-Einstellungen gesetzt werden. Studio-Einstellungen haben Vorrang vor ENV.
            </p>

            <section>
              <h3 className={HEADING_CLASS}>Aktive Pfade (Übersicht)</h3>
              <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium">Datenverzeichnis</dt>
                  <dd className="text-sm">
                    <code>{paths.dataDir}</code>
                    <span className={HINT_CLASS}> — via <code>UWE_DATA_DIR</code> oder Standard</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Datenbank</dt>
                  <dd className="text-sm">
                    <code>{paths.databaseFile ?? "— (nicht file:-SQLite)"}</code>
                    <span className={HINT_CLASS}> — via <code>DATABASE_URL</code></span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Uploads</dt>
                  <dd className="text-sm">
                    <code>{paths.uploads.effectivePath}</code>
                    <span className={HINT_CLASS}> — {pathSourceLabel[paths.uploads.source]}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Backups</dt>
                  <dd className="text-sm">
                    <code>{paths.backups.effectivePath}</code>
                    <span className={HINT_CLASS}> — {pathSourceLabel[paths.backups.source]}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Exports</dt>
                  <dd className="text-sm">
                    <code>{paths.exports.effectivePath}</code>
                    <span className={HINT_CLASS}> — {pathSourceLabel[paths.exports.source]}</span>
                  </dd>
                </div>
              </dl>
            </section>

            <div className={FIELD_CLASS}>
              <Label htmlFor="settings-uploads-path">Upload-Pfad</Label>
              <Input
                id="settings-uploads-path"
                name="uploadsPath"
                defaultValue={settings.storage.uploadsPath}
                placeholder="Leer = Umgebungsvariable / Standard"
              />
            </div>
            <p className={HINT_CLASS}>Aktiver Pfad: {uploadsPath}</p>

            <div className={FIELD_CLASS}>
              <Label htmlFor="settings-exports-path">Export-Pfad</Label>
              <Input
                id="settings-exports-path"
                name="exportsPath"
                defaultValue={settings.storage.exportsPath}
                placeholder="Leer = Umgebungsvariable / Standard"
              />
            </div>
            <p className={HINT_CLASS}>Aktiver Pfad: {exportsPath}</p>

            <p className={HINT_CLASS}>
              Backup-Pfad wird unter dem Tab <Link href="/settings?tab=backup">Backup</Link>{" "}
              konfiguriert. Aktiver Pfad: <code>{backupsPath}</code>
            </p>

            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "ai" && (
          <form action={updateSettingsAction} className={STACK_CLASS}>
            <input type="hidden" name="tab" value="ai" />
            <SettingsCollapsiblePanel title="KI-Allgemein" summary="Aktivierung und Betriebsmodus" defaultOpen>
              <div className={FORM_CLASS}>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="aiEnabled" defaultChecked={settings.ai.enabled} className={CHECKBOX_CLASS} />
                  AI Brain aktiv
                </label>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="localOnlyMode" defaultChecked={settings.ai.localOnlyMode} className={CHECKBOX_CLASS} />
                  Local-only AI Mode (kein Cloud-Provider erlaubt)
                </label>
              </div>
            </SettingsCollapsiblePanel>

            <SettingsCollapsiblePanel
              title="Cloud-Provider API Keys"
              summary="Verschlüsselt gespeichert — ENV hat Vorrang"
              defaultOpen
            >
              <div className={FORM_CLASS}>
                <p className={HINT_CLASS}>
                  API Keys können hier im Admin Portal hinterlegt werden (verschlüsselt
                  gespeichert) oder über Umgebungsvariablen (<code>.env</code>) konfiguriert
                  werden. Umgebungsvariablen haben immer Vorrang.
                </p>
                {settings.ai.providerKeyPlaceholders.map((provider) => {
                  const sourceLabel =
                    provider.source === "env"
                      ? "Umgebungsvariable"
                      : provider.source === "db"
                        ? "Admin Portal"
                        : "—";
                  const envLocked = provider.source === "env";
                  return (
                    <div key={provider.id} className="flex flex-col gap-2 border-b border-border/60 pb-3 last:border-0">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{provider.label}</strong>
                        <Badge variant={provider.configured ? "success" : "default"}>
                          {provider.configured ? `Konfiguriert · ${sourceLabel}` : "Nicht konfiguriert"}
                        </Badge>
                      </div>
                      {envLocked ? (
                        <p className={HINT_CLASS}>
                          Über Umgebungsvariable gesetzt — kann hier nicht überschrieben werden.
                        </p>
                      ) : (
                        <>
                          <div className={FIELD_CLASS}>
                            <Label htmlFor={`settings-api-key-${provider.id}`}>API Key</Label>
                            <Input
                              id={`settings-api-key-${provider.id}`}
                              type="password"
                              name={`apiKey_${provider.id}`}
                              placeholder={
                                provider.source === "db"
                                  ? "Leer lassen = bestehenden Key behalten"
                                  : "API Key eingeben"
                              }
                              autoComplete="new-password"
                            />
                          </div>
                          {provider.source === "db" && (
                            <label className={CHECKBOX_ROW_CLASS}>
                              <input type="checkbox" name={`clearApiKey_${provider.id}`} className={CHECKBOX_CLASS} />
                              Key löschen
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </SettingsCollapsiblePanel>

            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "integrations" && (
          <SettingsCollapsiblePanel
            title="Aktive Integrationen"
            summary="ENV-gesteuerte Features und Admin-Links"
            defaultOpen
          >
            <IntegrationsSetupPanel
              worlds={worlds.map((world) => ({ slug: world.slug, name: world.name }))}
              spotifyOAuth={spotifyOAuth}
              imageStudio={{
                enabled: imageStudioConfig.enabled,
                connectorImageEnabled: imageStudioConfig.connectorImageEnabled,
                localImageBackendReady: imageStudioConfig.localImageBackendReady,
                cloudApiKeyConfigured: imageStudioConfig.cloudApiKeyConfigured,
              }}
              calendar={{
                enabled: calendarConfig.enabled,
                caldavEnabled: calendarConfig.caldavEnabled,
              }}
              agentJobs={{
                enabled: agentJobsConfig.enabled,
                githubTokenConfigured: agentJobsConfig.githubTokenConfigured,
              }}
              dndApi={{
                open5eEnabled: dndApiConfig.open5eEnabled,
                dnd5eSrdEnabled: dndApiConfig.dnd5eSrdEnabled,
              }}
            />
          </SettingsCollapsiblePanel>
        )}

        {activeTab === "mail" && (
          <form action={updateSettingsAction} className={STACK_CLASS}>
            <input type="hidden" name="tab" value="mail" />
            <SettingsCollapsiblePanel title="Mail Center" summary="Aktivierung und Absender" defaultOpen>
              <div className={FORM_CLASS}>
                <p className={HINT_CLASS}>
                  Versand erfolgt ausschließlich nach expliziter Aktion im{" "}
                  <Link href="/mail">Mail Center</Link>.
                </p>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="mailEnabled" defaultChecked={settings.mail.enabled} className={CHECKBOX_CLASS} />
                  Mail Center aktiv
                </label>
                <div className={FIELD_CLASS}>
                  <Label htmlFor="settings-mail-from-name">Absender-Anzeigename (optional)</Label>
                  <Input
                    id="settings-mail-from-name"
                    name="fromDisplayName"
                    defaultValue={settings.mail.fromDisplayName}
                    placeholder="z. B. UWE Kampagne"
                  />
                </div>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="mailLogBody" defaultChecked={settings.mail.logBody} className={CHECKBOX_CLASS} />
                  Mail-Body in Logs speichern (nur für Diagnose — in Production eher aus)
                </label>
                <div className={FIELD_CLASS}>
                  <Label htmlFor="settings-mail-inbox-limit">Max. Anzahl E-Mails im Posteingang</Label>
                  <Input
                    id="settings-mail-inbox-limit"
                    name="inboxLimit"
                    type="number"
                    min={10}
                    max={5000}
                    step={10}
                    defaultValue={settings.mail.inboxLimit}
                  />
                </div>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="mailAutoSyncEnabled" defaultChecked={settings.mail.autoSyncEnabled} className={CHECKBOX_CLASS} />
                  Auto-Sync im Hintergrund (Host-Timer &amp; Mail Center)
                </label>
                <FieldSelect
                  id="settings-mail-auto-sync-interval"
                  name="mailAutoSyncInterval"
                  label="Auto-Sync-Intervall"
                  defaultValue={String(settings.mail.autoSyncIntervalMinutes)}
                  options={[
                    { value: "5", label: "alle 5 Minuten" },
                    { value: "15", label: "alle 15 Minuten" },
                    { value: "30", label: "alle 30 Minuten" },
                    { value: "60", label: "alle 60 Minuten" },
                  ]}
                />
              </div>
            </SettingsCollapsiblePanel>

            <SettingsCollapsiblePanel
              title="SMTP (Admin Portal)"
              summary="Verschlüsselt gespeichert oder .env-Fallback"
              defaultOpen
            >
              <div className={FORM_CLASS}>
                <p className={HINT_CLASS}>
                  SMTP kann hier im Admin Portal konfiguriert werden (verschlüsselt gespeichert)
                  oder weiterhin über <code>.env</code> als Fallback.
                </p>
                <p className={HINT_CLASS}>
                  Aktive Quelle:{" "}
                  <strong>{settings.mail.smtp.source === "portal" ? "Admin Portal" : ".env Fallback"}</strong>
                  {" · "}
                  {settings.mail.smtp.message}
                </p>
                <div className={FIELD_CLASS}>
                  <Label htmlFor="settings-smtp-host">SMTP-Host</Label>
                  <Input id="settings-smtp-host" name="smtpHost" defaultValue={settings.mail.smtp.host ?? ""} placeholder="smtp.example.com" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={FIELD_CLASS}>
                    <Label htmlFor="settings-smtp-port">Port</Label>
                    <Input id="settings-smtp-port" name="smtpPort" type="number" min={1} defaultValue={settings.mail.smtp.port ?? 587} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <Label htmlFor="settings-mail-from">Absender (MAIL_FROM)</Label>
                    <Input id="settings-mail-from" name="mailFrom" defaultValue={settings.mail.smtp.fromAddress ?? ""} placeholder="UWE <noreply@example.org>" />
                  </div>
                </div>
                <div className={FIELD_CLASS}>
                  <Label htmlFor="settings-smtp-user">SMTP-Benutzer</Label>
                  <Input
                    id="settings-smtp-user"
                    name="smtpUser"
                    defaultValue={settings.mail.smtp.username ?? ""}
                    placeholder="mailer@example.org"
                    autoComplete="off"
                  />
                </div>
                <div className={FIELD_CLASS}>
                  <Label htmlFor="settings-smtp-password">SMTP-Passwort</Label>
                  <Input
                    id="settings-smtp-password"
                    name="smtpPassword"
                    type="password"
                    placeholder={
                      settings.mail.smtp.passwordConfigured
                        ? "Leer lassen = bestehendes Passwort behalten"
                        : "Passwort eingeben"
                    }
                    autoComplete="new-password"
                  />
                </div>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="smtpSecure" defaultChecked={settings.mail.smtp.secure} className={CHECKBOX_CLASS} />
                  TLS/SSL (SMTP_SECURE)
                </label>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="smtpUseMock" defaultChecked={settings.mail.smtp.useMock} className={CHECKBOX_CLASS} />
                  Mock-Modus (keine echte SMTP-Verbindung)
                </label>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="clearPortalSmtp" className={CHECKBOX_CLASS} />
                  Portal-SMTP löschen und .env-Fallback nutzen
                </label>
              </div>
            </SettingsCollapsiblePanel>

            <SettingsCollapsiblePanel
              title="IMAP / Posteingang"
              summary="Konten im Mail Center verwalten"
              defaultOpen={false}
            >
              <div className={FORM_CLASS}>
                <p className={HINT_CLASS}>
                  IMAP-Konten werden im{" "}
                  <Link href="/mail?folder=inbox">Mail Center</Link> unter Einstellungen verwaltet
                  (verschlüsselte App-Passwörter). Dort laufen auch Smart Inbox, Regeln und
                  KI-Entwürfe.
                </p>
                <Link href="/mail?folder=inbox" className={buttonVariants({ variant: "secondary" })}>
                  Mail Center — Konten einrichten
                </Link>
              </div>
            </SettingsCollapsiblePanel>

            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "image-studio" && (
          <form action={updateSettingsAction} className={STACK_CLASS}>
            <input type="hidden" name="tab" value="image-studio" />
            <SettingsCollapsiblePanel
              title="Image Studio — Allgemein"
              summary="Aktivierung, Provider, Cloud & Hintergrund"
              defaultOpen
            >
              <div className={FORM_CLASS}>
                <p className={HINT_CLASS}>
                  Bild-Pipeline: RTX Host Connector (empfohlen) oder Legacy RTX Worker, optional
                  Cloud nur für generate/variant. Konfiguration in <code>.env</code>.
                </p>
                <Alert tone="info">
                  {imageStudioConfig.message}
                  {" · "}
                  Connector-Queue: {imageStudioConfig.connectorImageEnabled ? "an" : "aus"}
                  {" · "}
                  Lokales Backend: {imageStudioConfig.localImageBackendReady ? "bereit" : "fehlt"}
                  {" · "}
                  Cloud-Key: {imageStudioConfig.cloudApiKeyConfigured ? "vorhanden" : "fehlt"}
                </Alert>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="imageStudioEnabled" defaultChecked={imageStudioConfig.enabled} className={CHECKBOX_CLASS} />
                  Image Studio aktiv
                </label>
                <FieldSelect
                  id="settings-image-studio-provider"
                  name="imageStudioDefaultProvider"
                  label="Standard-Provider"
                  defaultValue={imageStudioConfig.defaultProviderMode}
                  options={[
                    { value: "auto", label: "auto (RTX, sonst Cloud wenn erlaubt)" },
                    { value: "local_rtx", label: "local_rtx (nur RTX)" },
                    { value: "cloud", label: "cloud" },
                  ]}
                />
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="imageStudioAllowCloud" defaultChecked={imageStudioConfig.allowCloud} className={CHECKBOX_CLASS} />
                  Cloud-KI erlauben (IMAGE_STUDIO_ALLOW_CLOUD — Datenschutz prüfen)
                </label>
                <label className={CHECKBOX_ROW_CLASS}>
                  <input type="checkbox" name="imageStudioBgRemoval" defaultChecked={imageStudioConfig.backgroundRemovalEnabled} className={CHECKBOX_CLASS} />
                  Hintergrund-Entfernung erlauben
                </label>
              </div>
            </SettingsCollapsiblePanel>

            <SettingsCollapsiblePanel
              title="RTX / Diffusion"
              summary="Connector-Queue oder Legacy-Worker in .env"
              defaultOpen={false}
            >
              <div className={FORM_CLASS}>
                <p className={HINT_CLASS}>
                  Empfohlen: <code>RTX_USE_CONNECTOR_IMAGE=true</code> und Connector unter{" "}
                  <Link href="/system/rtx-connector">System → RTX Connector</Link>. Legacy-Fallback:{" "}
                  <code>RTX_BASE_URL</code> / <code>RTX_SERVICE_TOKEN</code>. Diagnose unter{" "}
                  <Link href="/system?tab=diagnose">System-Diagnose</Link>.
                </p>
                <Link href="/image-studio" className={buttonVariants({ variant: "secondary" })}>
                  Image Studio öffnen
                </Link>
              </div>
            </SettingsCollapsiblePanel>

            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "backup" && (
          <form action={updateSettingsAction} className={FORM_CLASS}>
            <input type="hidden" name="tab" value="backup" />
            <h2 className={HEADING_CLASS}>Backup Settings</h2>
            <div className={FIELD_CLASS}>
              <Label htmlFor="settings-backups-path">Backup-Pfad</Label>
              <Input
                id="settings-backups-path"
                name="backupsPath"
                defaultValue={settings.backup.backupsPath}
                placeholder="Leer = Umgebungsvariable / Standard"
              />
            </div>
            <p className={HINT_CLASS}>Aktiver Pfad: {backupsPath}</p>
            <label className={CHECKBOX_ROW_CLASS}>
              <input type="checkbox" name="autoBackupEnabled" defaultChecked={settings.backup.autoBackupEnabled} className={CHECKBOX_CLASS} />
              Automatische Backups (systemd-Timer / schedule.json)
            </label>
            <FieldSelect
              id="settings-retention-count"
              name="retentionCount"
              label="Aufbewahrung (Anzahl Backups)"
              defaultValue={String(settings.backup.retentionCount)}
              options={[
                { value: "7", label: "7" },
                { value: "14", label: "14" },
                { value: "30", label: "30" },
              ]}
            />
            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "briefing" && (
          <form action={updateSettingsAction} className={FORM_CLASS}>
            <input type="hidden" name="tab" value="briefing" />
            <h2 className={HEADING_CLASS}>Morning Briefing</h2>
            <p className={HINT_CLASS}>
              Erzeugt täglich lokal per RTX ein Morning Briefing. Der Schalter wird zum Host
              gesynct (<code>data/briefings/schedule.json</code>) — der systemd-Timer läuft nur,
              wenn aktiv. Einmalige Voraussetzung: installierter <code>uwe-briefing.timer</code>{" "}
              (siehe deployment-hardening.md).
            </p>
            <label className={CHECKBOX_ROW_CLASS}>
              <input type="checkbox" name="autoBriefingEnabled" defaultChecked={settings.briefing.autoBriefingEnabled} className={CHECKBOX_CLASS} />
              Automatisches Morning Briefing (systemd-Timer / schedule.json)
            </label>
            <div className={FIELD_CLASS}>
              <Label htmlFor="settings-briefing-time">Uhrzeit (lokale Serverzeit)</Label>
              <Input id="settings-briefing-time" type="time" name="briefingTime" defaultValue={settings.briefing.time} />
            </div>
            <Button type="submit">Speichern</Button>
          </form>
        )}

        {activeTab === "maintenance" && (
          <section className={FORM_CLASS}>
            <h2 className={HEADING_CLASS}>Owner-Notfallmodus</h2>
            <p className={HINT_CLASS}>
              Sperrt Studio und/oder Portal für alle Nutzer außer Owner. Nützlich bei Wartung,
              Migrationen oder Sicherheitsvorfällen.
            </p>
            <form action={updateSettingsAction} className={FORM_CLASS}>
              <input type="hidden" name="tab" value="maintenance" />
              <SettingToggleRow
                name="maintenanceMode"
                label="Wartungsmodus (Studio + Portal)"
                defaultChecked={settings.maintenance.maintenanceMode}
                hint="Aktiviert alle Sperren unten implizit."
              />
              <SettingToggleRow
                name="lockStudio"
                label="Studio sperren"
                defaultChecked={settings.maintenance.lockStudio}
              />
              <SettingToggleRow
                name="lockPortal"
                label="Portal sperren"
                defaultChecked={settings.maintenance.lockPortal}
              />
              <div className={FIELD_CLASS}>
                <Label htmlFor="settings-maintenance-message">Hinweistext für Nutzer</Label>
                <Textarea
                  id="settings-maintenance-message"
                  name="maintenanceMessage"
                  rows={4}
                  defaultValue={settings.maintenance.message}
                  placeholder="UWE ist vorübergehend im Wartungsmodus."
                />
              </div>
              <Button type="submit">Speichern</Button>
            </form>
          </section>
        )}

        {activeTab === "status" && <SettingsStatusTab />}
      </SettingsShell>
    </SystemShell>
  );
}
