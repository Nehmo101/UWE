import Link from "next/link";
import {
  AppShell,
  CANONICAL_LABELS,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  CanonicalStatusEnum,
  getAppRepository,
  resolveEffectiveBackupsPath,
  resolveEffectiveUploadsPath,
  VisibilityEnum,
} from "@uwe/database/server";
import { updateSettingsAction, setWorldGuestModeAction } from "../settings-actions";

const TABS = [
  { id: "general", label: "General" },
  { id: "worlds", label: "Worlds" },
  { id: "portal", label: "Portal" },
  { id: "privacy", label: "Privacy" },
  { id: "storage", label: "Storage" },
  { id: "ai", label: "AI" },
  { id: "backup", label: "Backup" },
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
            <form action={updateSettingsAction} className="uwe-form">
              <input type="hidden" name="tab" value="general" />
              <h2>App Settings</h2>
              <label>
                Theme / Erscheinungsbild
                <select name="theme" defaultValue={settings.app.theme}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </label>
              <p className="uwe-hint">
                Theme-Einstellung wird für zukünftige UI-Anpassungen vorbereitet.
              </p>
              <button type="submit" className="uwe-btn uwe-btn-primary">
                Speichern
              </button>
            </form>
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
              <label>
                Upload-Pfad
                <input
                  name="uploadsPath"
                  defaultValue={settings.storage.uploadsPath}
                  placeholder="Leer = Umgebungsvariable / Standard"
                />
              </label>
              <p className="uwe-hint">Aktiver Pfad: {uploadsPath}</p>
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
        </>
      }
    />
  );
}
