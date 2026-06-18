import Link from "next/link";
import {
  AppShell,
  BACKGROUND_PATTERN_LABELS,
  CANONICAL_LABELS,
  PageHeader,
  SidebarNav,
  SidebarSection,
  ThemeSettingsPanel,
  TopBarBrand,
  VISIBILITY_LABELS,
  VisualThemePreview,
} from "@uwe/shared-ui";
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
  resolveImageStudioConfig,
  VisibilityEnum,
} from "@uwe/database/server";
import { updateSettingsAction, setWorldGuestModeAction } from "../settings-actions";

const TABS = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Erscheinungsbild" },
  { id: "worlds", label: "Worlds" },
  { id: "portal", label: "Portal" },
  { id: "privacy", label: "Privacy" },
  { id: "storage", label: "Storage" },
  { id: "ai", label: "AI" },
  { id: "integrations", label: "Integrationen" },
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
  const imageStudioConfig = resolveImageStudioConfig();
  const calendarConfig = resolveCalendarConfig();
  const dndApiConfig = resolveDndApiConfig();
  const agentJobsConfig = resolveAgentJobsConfig();

  const pathSourceLabel = {
    settings: "Studio-Einstellungen",
    env: "Umgebungsvariable",
    default: "Standard",
  } as const;

  return (
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Studio" subtitle="Einstellungen" href="/" />
        </>
      }
      sidebar={
        <>
          <SidebarSection title="Navigation">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/" },
                { label: "Einstellungen", href: "/settings", active: true },
              ]}
            />
          </SidebarSection>
          <SidebarSection title="Bereiche">
            <SidebarNav
              items={TABS.map((tab) => ({
                label: tab.label,
                href: `/settings?tab=${tab.id}`,
                active: activeTab === tab.id,
              }))}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <PageHeader
            title="Admin- & Systemeinstellungen"
            summary="Zentrale Konfiguration für App, Portal, Speicher, KI und Datenschutz."
          />

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
                <Link href="/settings?tab=appearance">Erscheinungsbild</Link> (lokal im
                Browser). Serverseitige App-Theme-Vorgabe (
                <code>{settings.app.theme}</code>) bleibt für zukünftige Sync-Optionen
                erhalten.
              </p>
            </section>
          )}

          {activeTab === "appearance" && (
            <>
              <ThemeSettingsPanel />
              <form
                id="uwe-visual-settings-form"
                action={updateSettingsAction}
                className="uwe-form"
                style={{ marginTop: "2rem" }}
              >
                <input type="hidden" name="tab" value="general" />
                <h2>Server-Standards (alle Nutzer)</h2>
                <p className="uwe-hint">
                  Diese Vorgaben gelten als SSR-Default über <code>data-uwe-*</code>-Attribute.
                  Persönliche Theme-Auswahl oben überschreibt sie im Browser.
                </p>
                <div className="uwe-visual-settings-grid">
                  <div>
                    <label>
                      Theme / Erscheinungsbild
                      <select name="theme" defaultValue={settings.app.theme}>
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="system">System</option>
                      </select>
                    </label>
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
            </>
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
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="portalEnabled"
                  defaultChecked={settings.portal.portalEnabled}
                />
                Portal aktiv
              </label>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="guestAccessEnabled"
                  defaultChecked={settings.portal.guestAccessEnabled}
                />
                Guest Access aktiv
              </label>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="publicSharingEnabled"
                  defaultChecked={settings.portal.publicSharingEnabled}
                />
                Public Sharing aktiv
              </label>
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
            <section className="uwe-form">
              <h2>Integrationen (ENV-gesteuert)</h2>
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
                </tbody>
              </table>
              <p className="uwe-hint" style={{ marginTop: "1rem" }}>
                Siehe <code>.env.example</code> für IMAGE_STUDIO_*, CALENDAR_*, DND_*, AGENT_JOBS_* und
                CALDAV_PASSWORD.
              </p>
            </section>
          )}

          {activeTab === "mail" && (
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="mail" />
              <h2>Mail Settings</h2>
              <p className="uwe-hint">
                SMTP-Host, Benutzer und Passwort werden nur über <code>.env</code> konfiguriert.
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
              <section style={{ marginTop: "1.5rem" }}>
                <h3>SMTP-Status (aus ENV)</h3>
                <dl className="uwe-dl">
                  <div>
                    <dt>Host</dt>
                    <dd>{settings.mail.smtp.host ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Port</dt>
                    <dd>{settings.mail.smtp.port ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>From</dt>
                    <dd>{settings.mail.smtp.fromAddress ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>User konfiguriert</dt>
                    <dd>{settings.mail.smtp.userConfigured ? "Ja" : "Nein"}</dd>
                  </div>
                  <div>
                    <dt>Passwort konfiguriert</dt>
                    <dd>{settings.mail.smtp.passwordConfigured ? "Ja" : "Nein"}</dd>
                  </div>
                  <div>
                    <dt>Diagnose</dt>
                    <dd>{settings.mail.smtp.message}</dd>
                  </div>
                </dl>
              </section>
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
                <Link className="uwe-btn uwe-btn-primary" href="/admin/status">
                  Admin Status Dashboard öffnen
                </Link>
                <Link className="uwe-btn" href="/admin/ai-prompt">
                  KI-Prompt (mobil)
                </Link>
              </p>
            </section>
          )}
        </>
      }
    />
  );
}
