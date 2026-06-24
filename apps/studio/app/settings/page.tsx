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
import { SettingsPageSidebar } from "../../components/SettingsPageSidebar";
import { StudioAppShell } from "@/components/StudioAppShell";
import { resolveThemePreferencesForScope } from "@uwe/database/server";

const TABS = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Erscheinungsbild" },
  { id: "worlds", label: "Worlds" },
  { id: "portal", label: "Portal" },
  { id: "privacy", label: "Privacy" },
  { id: "storage", label: "Storage" },
  { id: "ai", label: "AI" },
  { id: "integrations", label: "Integrationen" },
  { id: "image-studio", label: "Image Studio" },
  { id: "mail", label: "Mail" },
  { id: "backup", label: "Backup" },
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
  const dndApiConfig = resolveDndApiConfig();
  const agentJobsConfig = resolveAgentJobsConfig();

  const pathSourceLabel = {
    settings: "Studio-Einstellungen",
    env: "Umgebungsvariable",
    default: "Standard",
  } as const;

  return (
    <StudioAppShell
      variant="module"
      activePath={`/settings${activeTab !== "general" ? `?tab=${activeTab}` : ""}`}
      title="Admin- & Systemeinstellungen"
      summary="Zentrale Konfiguration für App, Portal, Speicher, KI und Datenschutz."
      sidebar={<SettingsPageSidebar activeTab={activeTab} />}
    >
          {saved === "1" && (
            <p className="uwe-notice" style={{ marginBottom: "1rem" }}>
              Einstellungen gespeichert.
            </p>
          )}

          <nav className="uwe-settings-tabs" aria-label="Einstellungsbereiche">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={`/settings?tab=${tab.id}`}
                className={activeTab === tab.id ? "active" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {activeTab === "general" && (
            <section className="uwe-form">
              <h2>App Settings</h2>
              <p className="uwe-hint">
                Visuelle Themes, Schrift, UI-Dichte und Hintergrundmuster konfigurierst du
                unter{" "}
                <Link href="/settings?tab=appearance">Erscheinungsbild</Link>. Einstellungen
                werden automatisch mit dem Server synchronisiert (
                <code>settings.app.themePreferences</code>).
              </p>
            </section>
          )}

          {activeTab === "appearance" && (
            <div className="uwe-settings-stack">
              <ThemeSettingsPanel />
              <SettingsCollapsiblePanel
                title="Portal-Erscheinungsbild"
                summary="Separates Theme für das Spieler-Portal"
                defaultOpen
              >
                <PortalThemeSettingsSection
                  initialPreferences={resolveThemePreferencesForScope(settings.app, "portal")}
                />
              </SettingsCollapsiblePanel>
              <SettingsCollapsiblePanel
                title="SSR-Visual-Standards"
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
                  <button type="submit" className="uwe-btn uwe-btn-primary">
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
                <button type="submit" className="uwe-btn uwe-btn-primary">
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
                              <button type="submit" className="uwe-btn uwe-btn-ghost">
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
              <button type="submit" className="uwe-btn uwe-btn-primary">
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

              <button type="submit" className="uwe-btn uwe-btn-primary">
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

              <button type="submit" className="uwe-btn uwe-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "ai" && (
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="ai" />
              <h2>AI Settings</h2>
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
                Local-only AI Mode
              </label>
              <section style={{ marginTop: "1.5rem" }}>
                <h3>API Keys (Platzhalter)</h3>
                <div className="uwe-page-table-wrap">
                  <table className="uwe-page-table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Status</th>
                        <th>Quelle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.ai.providerKeyPlaceholders.map((provider) => (
                        <tr key={provider.id}>
                          <td>{provider.label}</td>
                          <td>{provider.configured ? "••••••••" : "Nicht konfiguriert"}</td>
                          <td>{provider.source === "env" ? "Umgebungsvariable" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <button type="submit" className="uwe-btn uwe-btn-primary">
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
              <section className="uwe-form">
                <p className="uwe-hint">
                  Alle externen Integrationen sind deaktivierbar. Secrets nur serverseitig in .env —
                  nie im Frontend.
                </p>
                <table className="uwe-table" style={{ width: "100%", marginTop: "1rem" }}>
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Status</th>
                      <th>Admin-Seite</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Image Studio</td>
                      <td>{imageStudioConfig.enabled ? "aktiv" : "deaktiviert"}</td>
                      <td>
                        <Link href="/image-studio">/image-studio</Link>
                      </td>
                    </tr>
                    <tr>
                      <td>Kalender</td>
                      <td>{calendarConfig.enabled ? "aktiv" : "deaktiviert"}</td>
                      <td>
                        <Link href="/calendar">/calendar</Link>
                      </td>
                    </tr>
                    <tr>
                      <td>DnD API (Open5e/SRD)</td>
                      <td>
                        Open5e: {dndApiConfig.open5eEnabled ? "an" : "aus"} · SRD:{" "}
                        {dndApiConfig.dnd5eSrdEnabled ? "an" : "aus"}
                      </td>
                      <td>Welt → DnD API</td>
                    </tr>
                    <tr>
                      <td>Agent Jobs</td>
                      <td>
                        {agentJobsConfig.enabled ? "aktiv" : "deaktiviert"} · Token:{" "}
                        {agentJobsConfig.githubTokenConfigured ? "OK" : "fehlt"}
                      </td>
                      <td>
                        <Link href="/admin/agent-jobs">/admin/agent-jobs</Link>
                      </td>
                    </tr>
                    <tr>
                      <td>Spotify Soundboard</td>
                      <td>
                        OAuth über <code>SPOTIFY_CLIENT_ID</code> / <code>SPOTIFY_CLIENT_SECRET</code> in
                        .env
                      </td>
                      <td>
                        <Link href="/worlds">Welten</Link> → Soundboard (pro Welt, Spotify Premium)
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="uwe-hint" style={{ marginTop: "1rem" }}>
                  Siehe <code>.env.example</code> für IMAGE_STUDIO_*, CALENDAR_*, DND_*, AGENT_JOBS_*,
                  SPOTIFY_* und CALDAV_PASSWORD. Mail-SMTP kann alternativ unter Tab Mail im Portal
                  konfiguriert werden.
                </p>
              </section>
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
                summary="Konten im Mail Portal verwalten"
                defaultOpen={false}
              >
                <p className="uwe-hint">
                  IMAP-Konten werden im{" "}
                  <Link href="/admin/mail">Mail Portal</Link> verwaltet (verschlüsselte App-Passwörter).
                  Der <Link href="/mail?tab=inbox">Mail Center Posteingang</Link> zeigt synchronisierte
                  Nachrichten; Smart Inbox und KI-Entwürfe nur im Mail Portal.
                </p>
                <p>
                  <Link href="/admin/mail" className="uwe-btn uwe-btn-secondary">
                    Mail Portal — Konten einrichten
                  </Link>
                </p>
              </SettingsCollapsiblePanel>

              <button type="submit" className="uwe-btn uwe-btn-primary">
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
                  Odysseus-inspirierte Bild-Pipeline: RTX Agent lokal, optional Cloud nur für
                  generate/variant. RTX-URL und API-Keys bleiben in <code>.env</code>.
                </p>
                <p className="uwe-notice">
                  {imageStudioConfig.message}
                  {" · "}
                  RTX: {imageStudioConfig.rtxAgentConfigured ? "konfiguriert" : "fehlt"}
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
                summary="Agent-URL in .env, Diagnose-Links"
                defaultOpen={false}
              >
                <p className="uwe-hint">
                  Setze <code>RTX_AGENT_URL</code> und optional <code>RTX_AGENT_TOKEN</code> in{" "}
                  <code>.env</code>. Diagnose unter{" "}
                  <Link href="/admin/cookbook">Cookbook</Link> und{" "}
                  <Link href="/admin/status">Systemstatus</Link>.
                </p>
                <p>
                  <Link href="/image-studio" className="uwe-btn uwe-btn-secondary">
                    Image Studio öffnen
                  </Link>
                </p>
              </SettingsCollapsiblePanel>

              <button type="submit" className="uwe-btn uwe-btn-primary">
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
                Automatische Backups (Platzhalter)
              </label>
              <button type="submit" className="uwe-btn uwe-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "status" && (
            <section className="uwe-form">
              <h2>Systemstatus</h2>
              <p>
                Vollständige Diagnose für UWE, Datenbank, Storage, Cloudflare, Auth, Mail,
                Brain, RTX-Inference, Embeddings und Jobs — ohne Secrets.
              </p>
              <p style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                <Link className="uwe-btn uwe-btn-primary" href="/system">
                  System-Hub öffnen
                </Link>
                <Link className="uwe-btn" href="/admin/status">
                  Admin Status Dashboard
                </Link>
                <Link className="uwe-btn" href="/ai">
                  KI
                </Link>
              </p>
            </section>
          )}
    </StudioAppShell>
  );
}
