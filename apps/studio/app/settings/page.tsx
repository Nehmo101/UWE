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
import { updateSettingsAction, setWorldGuestModeAction } from "../settings-actions";
import { PortalThemeSettingsSection } from "../../components/PortalThemeSettingsSection";
import { DesignAssistantWizard } from "../../components/DesignAssistantWizard";
import { CustomThemesManager } from "../../components/CustomThemesManager";
import { IntegrationsSetupPanel } from "../../components/IntegrationsSetupPanel";
import { BreadcrumbTrail, SettingsShell, SystemShell } from "@/src/components/shell";
import { resolveThemePreferencesForScope } from "@uwe/database/server";
import { getSpotifyConfigurationSummary } from "@/src/lib/spotify-handlers";

const TABS = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Design & Theme" },
  { id: "worlds", label: "Worlds" },
  { id: "portal", label: "Portal" },
  { id: "privacy", label: "Privacy" },
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
        description="Zentrale Konfiguration für App, Portal, Speicher, KI und Datenschutz."
        tabs={TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          href: `/settings?tab=${tab.id}`,
          active: activeTab === tab.id,
        }))}
      >
          {saved === "1" && (
            <p className="uwe-notice" style={{ marginBottom: "1rem" }}>
              Einstellungen gespeichert.
            </p>
          )}

          {activeTab === "general" && (
            <section className="uwe-form">
              <h2>App Settings</h2>
              <p className="uwe-hint">
                Visuelle Themes, Schrift, UI-Dichte und Hintergrundmuster konfigurierst du
                unter{" "}
                <Link href="/settings?tab=appearance">Design &amp; Theme</Link>. Einstellungen
                werden automatisch mit dem Server synchronisiert (
                <code>settings.app.themePreferences</code>).
              </p>
            </section>
          )}

          {activeTab === "appearance" && (
            <div className="uwe-settings-stack">
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
                <form id="uwe-visual-settings-form" action={updateSettingsAction} className="uwe-form">
                  <input type="hidden" name="tab" value="general" />
                  <p className="uwe-hint">
                    Dark/Light/System und Motion für <code>data-uwe-*</code>-Attribute beim
                    ersten Paint. Preset-Themes und erweiterte Optionen werden über das
                    Studio-Panel oben synchronisiert.
                  </p>
                  <div className="uwe-visual-settings-grid">
                    <div>
                      <ThemePicker defaultValue={settings.app.theme} preview />
                      <label>
                        Hintergrundmuster
                        <select
                          name="backgroundPattern"
                          defaultValue={settings.app.backgroundPattern}
                        >
                          {BACKGROUND_PATTERN_VALUES.map((pattern) => (
                            <option key={pattern} value={pattern}>
                              {BACKGROUND_PATTERN_LABELS[pattern]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="uwe-hint">
                        Reine CSS-Muster ohne Canvas — abschaltbar über „Keins“. Auf Mobilgeräten
                        keine Daueranimationen.
                      </p>
                      <label className="uwe-checkbox-row">
                        <input
                          type="checkbox"
                          name="frostedGlass"
                          value="on"
                          defaultChecked={settings.app.frostedGlass}
                        />
                        Frosted Glass (Milchglas-Oberflächen)
                      </label>
                      <p className="uwe-hint">
                        Aus = undurchsichtige Panels für maximale Lesbarkeit. An = dezenter
                        Backdrop-Blur auf Karten, Leisten und Modals.
                      </p>
                      <label className="uwe-checkbox-row">
                        <input
                          type="checkbox"
                          name="motionEnabled"
                          value="on"
                          defaultChecked={settings.app.motionEnabled}
                        />
                        Dezente UI-Animationen
                      </label>
                      <p className="uwe-hint">
                        Respektiert immer <code>prefers-reduced-motion</code> des Systems.
                      </p>
                    </div>
                    <VisualThemePreview
                      formId="uwe-visual-settings-form"
                      initial={{
                        theme: settings.app.theme,
                        backgroundPattern: settings.app.backgroundPattern,
                        frostedGlass: settings.app.frostedGlass,
                        motionEnabled: settings.app.motionEnabled,
                      }}
                    />
                  </div>
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                    Server-Standards speichern
                  </button>
                </form>
              </SettingsCollapsiblePanel>
            </div>
          )}

          {activeTab === "worlds" && (
            <>
              <form action={updateSettingsAction} className="uwe-form">
                <input type="hidden" name="tab" value="worlds" />
                <h2>World Settings</h2>
                <label>
                  Default Visibility
                  <select
                    name="defaultVisibility"
                    defaultValue={settings.worlds.defaultVisibility}
                  >
                    {Object.values(VisibilityEnum).map((value) => (
                      <option key={value} value={value}>
                        {VISIBILITY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Default Canonical Status
                  <select
                    name="defaultCanonicalStatus"
                    defaultValue={settings.worlds.defaultCanonicalStatus}
                  >
                    {Object.values(CanonicalStatusEnum).map((value) => (
                      <option key={value} value={value}>
                        {CANONICAL_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                  Speichern
                </button>
              </form>

              <section style={{ marginTop: "2rem" }}>
                <h2>Campaign Settings</h2>
                <p className="uwe-hint">
                  Kampagnen erben aktuell die Welt-Defaults (
                  {settings.campaigns.inheritWorldDefaults ? "aktiv" : "deaktiviert"}).
                </p>
              </section>

              <section style={{ marginTop: "2rem" }}>
                <h2>Bevorzugte DnD-Welt</h2>
                <p className="uwe-hint">
                  Wird auf /today prominent angezeigt. Leer = Env{" "}
                  <code>PREFERRED_WORLD_SLUG</code>, dann Terra (falls vorhanden), sonst erste
                  Welt. Terra wird nie hardcodiert erzwungen.
                </p>
                <label>
                  Favorit für Today-Dashboard
                  <select
                    name="favoriteWorldSlug"
                    defaultValue={settings.app.favoriteWorldSlug ?? ""}
                  >
                    <option value="">— Automatisch —</option>
                    {worlds.map((world) => (
                      <option key={world.id} value={world.slug}>
                        {world.name} ({world.slug})
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section style={{ marginTop: "2rem" }}>
                <h2>Gastmodus pro Welt</h2>
                <div className="uwe-page-table-wrap">
                  <table className="uwe-page-table">
                    <thead>
                      <tr>
                        <th>Welt</th>
                        <th>Gastmodus</th>
                        <th>Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {worlds.map((world) => (
                        <tr key={world.id}>
                          <td>{world.name}</td>
                          <td>{world.guestModeEnabled ? "Aktiv" : "Inaktiv"}</td>
                          <td>
                            <form action={setWorldGuestModeAction} className="uwe-inline-form">
                              <input type="hidden" name="worldId" value={world.id} />
                              <input type="hidden" name="tab" value="worlds" />
                              <input
                                type="hidden"
                                name="guestModeEnabled"
                                value={world.guestModeEnabled ? "0" : "1"}
                              />
                              <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
                                {world.guestModeEnabled ? "Deaktivieren" : "Aktivieren"}
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === "portal" && (
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="portal" />
              <h2>Portal Settings</h2>
              <p className="uwe-hint">
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
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "privacy" && (
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="privacy" />
              <h2>Privacy Settings</h2>
              <p className="uwe-hint">
                Secrets werden niemals im Klartext angezeigt. API Keys werden nur über
                Umgebungsvariablen konfiguriert.
              </p>
              <label className="uwe-checkbox">
                <input type="checkbox" checked disabled readOnly />
                Secrets in UI maskieren (immer aktiv)
              </label>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="restrictPublicExport"
                  defaultChecked={settings.privacy.restrictPublicExport}
                />
                Öffentlichen Export einschränken
              </label>

              <h3 style={{ marginTop: "1.5rem" }}>Session &amp; Abmeldung</h3>
              <p className="uwe-hint">
                Nach der eingestellten Inaktivitätszeit werden Benutzer automatisch abgemeldet
                (Studio und Portal). 0 = deaktiviert. Alternativ per ENV{" "}
                <code>SESSION_INACTIVITY_TIMEOUT_MINUTES</code>, wenn hier 0 gesetzt ist.
              </p>
              <label>
                Inaktivitäts-Timeout (Minuten)
                <input
                  type="number"
                  name="sessionInactivityTimeoutMinutes"
                  min={0}
                  max={1440}
                  step={5}
                  defaultValue={settings.auth.sessionInactivityTimeoutMinutes}
                />
              </label>

              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "storage" && (
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="storage" />
              <h2>Storage Settings</h2>
              <p className="uwe-hint">
                Persistente Pfade können über Umgebungsvariablen (`.env`) oder hier in den
                Studio-Einstellungen gesetzt werden. Studio-Einstellungen haben Vorrang vor ENV.
              </p>

              <section className="uwe-settings-path-overview" style={{ marginBottom: "1.5rem" }}>
                <h3>Aktive Pfade (Übersicht)</h3>
                <dl className="uwe-dl">
                  <div>
                    <dt>Datenverzeichnis</dt>
                    <dd>
                      <code>{paths.dataDir}</code>
                      <span className="uwe-hint"> — via <code>UWE_DATA_DIR</code> oder Standard</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Datenbank</dt>
                    <dd>
                      <code>{paths.databaseFile ?? "— (nicht file:-SQLite)"}</code>
                      <span className="uwe-hint"> — via <code>DATABASE_URL</code></span>
                    </dd>
                  </div>
                  <div>
                    <dt>Uploads</dt>
                    <dd>
                      <code>{paths.uploads.effectivePath}</code>
                      <span className="uwe-hint"> — {pathSourceLabel[paths.uploads.source]}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Backups</dt>
                    <dd>
                      <code>{paths.backups.effectivePath}</code>
                      <span className="uwe-hint"> — {pathSourceLabel[paths.backups.source]}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Exports</dt>
                    <dd>
                      <code>{paths.exports.effectivePath}</code>
                      <span className="uwe-hint"> — {pathSourceLabel[paths.exports.source]}</span>
                    </dd>
                  </div>
                </dl>
              </section>

              <label>
                Upload-Pfad
                <input
                  name="uploadsPath"
                  defaultValue={settings.storage.uploadsPath}
                  placeholder="Leer = Umgebungsvariable / Standard"
                />
              </label>
              <p className="uwe-hint">Aktiver Pfad: {uploadsPath}</p>

              <label>
                Export-Pfad
                <input
                  name="exportsPath"
                  defaultValue={settings.storage.exportsPath}
                  placeholder="Leer = Umgebungsvariable / Standard"
                />
              </label>
              <p className="uwe-hint">Aktiver Pfad: {exportsPath}</p>

              <p className="uwe-hint">
                Backup-Pfad wird unter dem Tab <Link href="/settings?tab=backup">Backup</Link>{" "}
                konfiguriert. Aktiver Pfad: <code>{backupsPath}</code>
              </p>

              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "ai" && (
            <form action={updateSettingsAction} className="uwe-form uwe-settings-stack">
              <input type="hidden" name="tab" value="ai" />
              <SettingsCollapsiblePanel title="KI-Allgemein" summary="Aktivierung und Betriebsmodus" defaultOpen>
                <label className="uwe-checkbox">
                  <input type="checkbox" name="aiEnabled" defaultChecked={settings.ai.enabled} />
                  AI Brain aktiv
                </label>
                <label className="uwe-checkbox">
                  <input
                    type="checkbox"
                    name="localOnlyMode"
                    defaultChecked={settings.ai.localOnlyMode}
                  />
                  Local-only AI Mode (kein Cloud-Provider erlaubt)
                </label>
              </SettingsCollapsiblePanel>

              <SettingsCollapsiblePanel
                title="Cloud-Provider API Keys"
                summary="Verschlüsselt gespeichert — ENV hat Vorrang"
                defaultOpen
              >
                <p className="uwe-hint">
                  API Keys können hier im Admin Portal hinterlegt werden (verschlüsselt gespeichert)
                  oder über Umgebungsvariablen (<code>.env</code>) konfiguriert werden.
                  Umgebungsvariablen haben immer Vorrang.
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
                    <div key={provider.id} className="uwe-settings-api-key-row">
                      <div className="uwe-settings-api-key-header">
                        <strong>{provider.label}</strong>
                        <span className={`uwe-badge ${provider.configured ? "uwe-badge-ok" : "uwe-badge-missing"}`}>
                          {provider.configured ? `Konfiguriert · ${sourceLabel}` : "Nicht konfiguriert"}
                        </span>
                      </div>
                      {envLocked ? (
                        <p className="uwe-hint">
                          Über Umgebungsvariable gesetzt — kann hier nicht überschrieben werden.
                        </p>
                      ) : (
                        <>
                          <label>
                            API Key
                            <input
                              type="password"
                              name={`apiKey_${provider.id}`}
                              placeholder={
                                provider.source === "db"
                                  ? "Leer lassen = bestehenden Key behalten"
                                  : "API Key eingeben"
                              }
                              autoComplete="new-password"
                            />
                          </label>
                          {provider.source === "db" && (
                            <label className="uwe-checkbox">
                              <input type="checkbox" name={`clearApiKey_${provider.id}`} />
                              Key löschen
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </SettingsCollapsiblePanel>

              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
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
            <form action={updateSettingsAction} className="uwe-form uwe-settings-stack">
              <input type="hidden" name="tab" value="mail" />
              <SettingsCollapsiblePanel title="Mail Center" summary="Aktivierung und Absender" defaultOpen>
                <p className="uwe-hint">
                  Versand erfolgt ausschließlich nach expliziter Aktion im{" "}
                  <Link href="/mail">Mail Center</Link>.
                </p>
                <label className="uwe-checkbox">
                  <input type="checkbox" name="mailEnabled" defaultChecked={settings.mail.enabled} />
                  Mail Center aktiv
                </label>
                <label>
                  Absender-Anzeigename (optional)
                  <input
                    name="fromDisplayName"
                    defaultValue={settings.mail.fromDisplayName}
                    placeholder="z. B. UWE Kampagne"
                  />
                </label>
                <label className="uwe-checkbox">
                  <input type="checkbox" name="mailLogBody" defaultChecked={settings.mail.logBody} />
                  Mail-Body in Logs speichern (nur für Diagnose — in Production eher aus)
                </label>
                <label>
                  Max. Anzahl E-Mails im Posteingang
                  <input
                    name="inboxLimit"
                    type="number"
                    min={10}
                    max={5000}
                    step={10}
                    defaultValue={settings.mail.inboxLimit}
                  />
                </label>
                <label className="uwe-checkbox">
                  <input
                    type="checkbox"
                    name="mailAutoSyncEnabled"
                    defaultChecked={settings.mail.autoSyncEnabled}
                  />
                  Auto-Sync im Hintergrund (Host-Timer &amp; Mail Center)
                </label>
                <label>
                  Auto-Sync-Intervall
                  <select
                    name="mailAutoSyncInterval"
                    defaultValue={String(settings.mail.autoSyncIntervalMinutes)}
                  >
                    <option value="5">alle 5 Minuten</option>
                    <option value="15">alle 15 Minuten</option>
                    <option value="30">alle 30 Minuten</option>
                    <option value="60">alle 60 Minuten</option>
                  </select>
                </label>
              </SettingsCollapsiblePanel>

              <SettingsCollapsiblePanel
                title="SMTP (Admin Portal)"
                summary="Verschlüsselt gespeichert oder .env-Fallback"
                defaultOpen
              >
                <p className="uwe-hint">
                  SMTP kann hier im Admin Portal konfiguriert werden (verschlüsselt gespeichert) oder
                  weiterhin über <code>.env</code> als Fallback.
                </p>
                <p className="uwe-hint">
                  Aktive Quelle:{" "}
                  <strong>{settings.mail.smtp.source === "portal" ? "Admin Portal" : ".env Fallback"}</strong>
                  {" · "}
                  {settings.mail.smtp.message}
                </p>
                <label>
                  SMTP-Host
                  <input
                    name="smtpHost"
                    defaultValue={settings.mail.smtp.host ?? ""}
                    placeholder="smtp.example.com"
                  />
                </label>
                <div className="uwe-form-row uwe-form-row-2">
                  <label>
                    Port
                    <input
                      name="smtpPort"
                      type="number"
                      min={1}
                      defaultValue={settings.mail.smtp.port ?? 587}
                    />
                  </label>
                  <label>
                    Absender (MAIL_FROM)
                    <input
                      name="mailFrom"
                      defaultValue={settings.mail.smtp.fromAddress ?? ""}
                      placeholder="UWE <noreply@example.org>"
                    />
                  </label>
                </div>
                <label>
                  SMTP-Benutzer
                  <input
                    name="smtpUser"
                    defaultValue={settings.mail.smtp.username ?? ""}
                    placeholder="mailer@example.org"
                    autoComplete="off"
                  />
                </label>
                <label>
                  SMTP-Passwort
                  <input
                    name="smtpPassword"
                    type="password"
                    placeholder={
                      settings.mail.smtp.passwordConfigured
                        ? "Leer lassen = bestehendes Passwort behalten"
                        : "Passwort eingeben"
                    }
                    autoComplete="new-password"
                  />
                </label>
                <label className="uwe-checkbox">
                  <input
                    type="checkbox"
                    name="smtpSecure"
                    defaultChecked={settings.mail.smtp.secure}
                  />
                  TLS/SSL (SMTP_SECURE)
                </label>
                <label className="uwe-checkbox">
                  <input
                    type="checkbox"
                    name="smtpUseMock"
                    defaultChecked={settings.mail.smtp.useMock}
                  />
                  Mock-Modus (keine echte SMTP-Verbindung)
                </label>
                <label className="uwe-checkbox">
                  <input type="checkbox" name="clearPortalSmtp" />
                  Portal-SMTP löschen und .env-Fallback nutzen
                </label>
              </SettingsCollapsiblePanel>

              <SettingsCollapsiblePanel
                title="IMAP / Posteingang"
                summary="Konten im Mail Center verwalten"
                defaultOpen={false}
              >
                <p className="uwe-hint">
                  IMAP-Konten werden im{" "}
                  <Link href="/mail?folder=inbox">Mail Center</Link> unter Einstellungen verwaltet
                  (verschlüsselte App-Passwörter). Dort laufen auch Smart Inbox, Regeln und KI-Entwürfe.
                </p>
                <p>
                  <Link href="/mail?folder=inbox" className="uwe-v2-btn uwe-v2-btn-secondary">
                    Mail Center — Konten einrichten
                  </Link>
                </p>
              </SettingsCollapsiblePanel>

              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "image-studio" && (
            <form action={updateSettingsAction} className="uwe-form uwe-settings-stack">
              <input type="hidden" name="tab" value="image-studio" />
              <SettingsCollapsiblePanel
                title="Image Studio — Allgemein"
                summary="Aktivierung, Provider, Cloud & Hintergrund"
                defaultOpen
              >
                <p className="uwe-hint">
                  Bild-Pipeline: RTX Host Connector (empfohlen) oder Legacy RTX Worker, optional
                  Cloud nur für generate/variant. Konfiguration in <code>.env</code>.
                </p>
                <p className="uwe-notice">
                  {imageStudioConfig.message}
                  {" · "}
                  Connector-Queue: {imageStudioConfig.connectorImageEnabled ? "an" : "aus"}
                  {" · "}
                  Lokales Backend: {imageStudioConfig.localImageBackendReady ? "bereit" : "fehlt"}
                  {" · "}
                  Cloud-Key: {imageStudioConfig.cloudApiKeyConfigured ? "vorhanden" : "fehlt"}
                </p>
                <label className="uwe-checkbox">
                  <input
                    type="checkbox"
                    name="imageStudioEnabled"
                    defaultChecked={imageStudioConfig.enabled}
                  />
                  Image Studio aktiv
                </label>
                <label>
                  Standard-Provider
                  <select
                    name="imageStudioDefaultProvider"
                    className="uwe-input"
                    defaultValue={imageStudioConfig.defaultProviderMode}
                  >
                    <option value="auto">auto (RTX, sonst Cloud wenn erlaubt)</option>
                    <option value="local_rtx">local_rtx (nur RTX)</option>
                    <option value="cloud">cloud</option>
                  </select>
                </label>
                <label className="uwe-checkbox">
                  <input
                    type="checkbox"
                    name="imageStudioAllowCloud"
                    defaultChecked={imageStudioConfig.allowCloud}
                  />
                  Cloud-KI erlauben (IMAGE_STUDIO_ALLOW_CLOUD — Datenschutz prüfen)
                </label>
                <label className="uwe-checkbox">
                  <input
                    type="checkbox"
                    name="imageStudioBgRemoval"
                    defaultChecked={imageStudioConfig.backgroundRemovalEnabled}
                  />
                  Hintergrund-Entfernung erlauben
                </label>
              </SettingsCollapsiblePanel>

              <SettingsCollapsiblePanel
                title="RTX / Diffusion"
                summary="Connector-Queue oder Legacy-Worker in .env"
                defaultOpen={false}
              >
                <p className="uwe-hint">
                  Empfohlen: <code>RTX_USE_CONNECTOR_IMAGE=true</code> und Connector unter{" "}
                  <Link href="/system/rtx-connector">System → RTX Connector</Link>. Legacy-Fallback:{" "}
                  <code>RTX_BASE_URL</code> / <code>RTX_SERVICE_TOKEN</code>. Diagnose unter{" "}
                  <Link href="/admin/status">Systemstatus</Link>.
                </p>
                <p>
                  <Link href="/image-studio" className="uwe-v2-btn uwe-v2-btn-secondary">
                    Image Studio öffnen
                  </Link>
                </p>
              </SettingsCollapsiblePanel>

              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "backup" && (
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="backup" />
              <h2>Backup Settings</h2>
              <label>
                Backup-Pfad
                <input
                  name="backupsPath"
                  defaultValue={settings.backup.backupsPath}
                  placeholder="Leer = Umgebungsvariable / Standard"
                />
              </label>
              <p className="uwe-hint">Aktiver Pfad: {backupsPath}</p>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="autoBackupEnabled"
                  defaultChecked={settings.backup.autoBackupEnabled}
                />
                Automatische Backups (systemd-Timer / schedule.json)
              </label>
              <label>
                Aufbewahrung (Anzahl Backups)
                <select name="retentionCount" defaultValue={String(settings.backup.retentionCount)}>
                  <option value="7">7</option>
                  <option value="14">14</option>
                  <option value="30">30</option>
                </select>
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "briefing" && (
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="briefing" />
              <h2>Morning Briefing</h2>
              <p className="uwe-hint">
                Erzeugt täglich lokal per RTX ein Morning Briefing. Der Schalter wird zum Host
                gesynct (<code>data/briefings/schedule.json</code>) — der systemd-Timer läuft nur,
                wenn aktiv. Einmalige Voraussetzung: installierter <code>uwe-briefing.timer</code>{" "}
                (siehe deployment-hardening.md).
              </p>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="autoBriefingEnabled"
                  defaultChecked={settings.briefing.autoBriefingEnabled}
                />
                Automatisches Morning Briefing (systemd-Timer / schedule.json)
              </label>
              <label>
                Uhrzeit (lokale Serverzeit)
                <input type="time" name="briefingTime" defaultValue={settings.briefing.time} />
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "maintenance" && (
            <section className="uwe-form">
              <h2>Owner-Notfallmodus</h2>
              <p className="uwe-hint">
                Sperrt Studio und/oder Portal für alle Nutzer außer Owner. Nützlich bei Wartung,
                Migrationen oder Sicherheitsvorfällen.
              </p>
              <form action={updateSettingsAction} className="uwe-form">
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
                <label>
                  Hinweistext für Nutzer
                  <textarea
                    name="maintenanceMessage"
                    rows={4}
                    defaultValue={settings.maintenance.message}
                    placeholder="UWE ist vorübergehend im Wartungsmodus."
                  />
                </label>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                  Speichern
                </button>
              </form>
            </section>
          )}

          {activeTab === "status" && (
            <section className="uwe-form">
              <h2>Systemstatus</h2>
              <p>
                Vollständige Diagnose für UWE, Datenbank, Storage, Cloudflare, Auth, Mail,
                Brain, RTX-Inference, Embeddings und Jobs — ohne Secrets.
              </p>
              <p style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/system">
                  System-Hub öffnen
                </Link>
                <Link className="uwe-v2-btn" href="/admin/status">
                  Admin Status Dashboard
                </Link>
                <Link className="uwe-v2-btn" href="/system/rtx-connector">
                  RTX Connector
                </Link>
                <Link className="uwe-v2-btn" href="/ai">
                  KI
                </Link>
              </p>
            </section>
          )}
      </SettingsShell>
    </SystemShell>
  );
}
