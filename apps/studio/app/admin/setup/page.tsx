import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
  getAppRepository,
  getOwnerSetupSnapshot,
  prisma,
  resolveEffectiveBackupsPath,
  resolveEffectiveExportsPath,
  resolveEffectiveUploadsPath,
  type OwnerSetupSectionId,
} from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { OwnerSetupSectionView } from "@/components/owner-setup/OwnerSetupSectionView";
import { OwnerSetupTestPanel } from "@/components/owner-setup/OwnerSetupTestPanel";
import { getCurrentAuthUser, requireAdminAccess } from "@/src/lib/auth";
import { updateOwnerSetupAction } from "../../owner-setup-actions";

const TABS = [
  { id: "system", label: "System" },
  { id: "access", label: "Zugriff" },
  { id: "cloudflare", label: "Cloudflare & Domains" },
  { id: "mail", label: "Mail" },
  { id: "rtx", label: "RTX & Hardware" },
  { id: "printer", label: "Drucker" },
  { id: "diagnose", label: "Diagnose" },
] as const satisfies readonly { id: OwnerSetupSectionId; label: string }[];

type SetupTabId = (typeof TABS)[number]["id"];

interface Props {
  searchParams: Promise<{ tab?: string; saved?: string }>;
}

function isSetupTabId(value: string | undefined): value is SetupTabId {
  return TABS.some((tab) => tab.id === value);
}

export default async function OwnerSetupPage({ searchParams }: Props) {
  await requireAdminAccess();
  const user = await getCurrentAuthUser();
  const canEdit = user?.role === "owner";

  const { tab: tabParam, saved } = await searchParams;
  const activeTab: SetupTabId = isSetupTabId(tabParam) ? tabParam : "system";

  const [snapshot, settings] = await Promise.all([
    getOwnerSetupSnapshot(prisma, {
      role: user?.role ?? "unknown",
      canEdit,
    }),
    getAppRepository().getSystemSettings(),
  ]);

  const section = snapshot.sections.find((entry) => entry.id === activeTab);

  const uploadsPath = resolveEffectiveUploadsPath(settings);
  const backupsPath = resolveEffectiveBackupsPath(settings);
  const exportsPath = resolveEffectiveExportsPath(settings);

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Einrichtung" }]}
        />
      }
    >
      <PageHeader
        title="Einrichtung"
        summary="Zentrale Owner-Einrichtung — System, Zugriff, Cloudflare, Mail, RTX, Drucker und Diagnose ohne Secrets im Klartext."
        actions={
          <HealthBadge
            status={snapshot.ok ? "ok" : "degraded"}
            label={canEdit ? "Owner" : "Nur Lesen"}
          />
        }
      />
      {!canEdit && (
        <p className="uwe-notice" role="status" style={{ marginBottom: "1rem" }}>
          Du siehst die Einrichtung im Lesemodus. Nur <strong>OWNER</strong> darf speichern und
          Tests ausführen.
        </p>
      )}

      {saved === "1" && (
        <p className="uwe-notice" style={{ marginBottom: "1rem" }}>
          Einstellungen gespeichert.
        </p>
      )}

      <nav className="uwe-settings-tabs" aria-label="Einrichtungsbereiche">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "system" ? "/admin/setup" : `/admin/setup?tab=${tab.id}`}
            className={activeTab === tab.id ? "active" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {section && (
        <OwnerSetupSectionView section={section}>
          {activeTab === "system" && canEdit && (
            <form action={updateOwnerSetupAction} className="uwe-form uwe-settings-stack" id="paths">
              <input type="hidden" name="tab" value="system" />
              <h3 className="uwe-v2-section-title">Speicher & Backup (Datenbank)</h3>
              <p className="uwe-hint">
                Pfade werden in der Datenbank gespeichert — keine manuelle Host-Datei nötig.
              </p>
              <label>
                Uploads-Pfad
                <input name="uploadsPath" defaultValue={uploadsPath} />
              </label>
              <label>
                Exports-Pfad
                <input name="exportsPath" defaultValue={exportsPath} />
              </label>
              <label>
                Backup-Pfad
                <input name="backupsPath" defaultValue={backupsPath} />
              </label>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="autoBackupEnabled"
                  defaultChecked={settings.backup.autoBackupEnabled}
                />
                Automatisches Backup aktivieren
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "access" && canEdit && (
            <form action={updateOwnerSetupAction} className="uwe-form uwe-settings-stack" id="portal">
              <input type="hidden" name="tab" value="access" />
              <h3 className="uwe-v2-section-title">Portal & Session</h3>
              <label className="uwe-checkbox">
                <input type="checkbox" name="portalEnabled" defaultChecked={settings.portal.portalEnabled} />
                Portal aktiv
              </label>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="guestAccessEnabled"
                  defaultChecked={settings.portal.guestAccessEnabled}
                />
                Gastzugang
              </label>
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  name="publicSharingEnabled"
                  defaultChecked={settings.portal.publicSharingEnabled}
                />
                Öffentliche Freigabe
              </label>
              <label id="session">
                Session-Timeout (Minuten, 0 = aus)
                <input
                  type="number"
                  name="sessionInactivityTimeoutMinutes"
                  min={0}
                  max={1440}
                  defaultValue={settings.auth.sessionInactivityTimeoutMinutes}
                />
              </label>
              <p className="uwe-hint">
                Benutzer und Rollen:{" "}
                <Link href="/admin/users">Benutzerverwaltung</Link>
              </p>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "cloudflare" && section.testAction && (
            <OwnerSetupTestPanel action={section.testAction} canEdit={canEdit} />
          )}

          {activeTab === "mail" && canEdit && (
            <form action={updateOwnerSetupAction} className="uwe-form uwe-settings-stack" id="smtp">
              <input type="hidden" name="tab" value="mail" />
              <h3 className="uwe-v2-section-title">SMTP (Datenbank, verschlüsselt)</h3>
              <label className="uwe-checkbox">
                <input type="checkbox" name="mailEnabled" defaultChecked={settings.mail.enabled} />
                Mail Center aktiv
              </label>
              <label>
                Absender-Anzeigename
                <input name="fromDisplayName" defaultValue={settings.mail.fromDisplayName} />
              </label>
              <label>
                SMTP-Host
                <input name="smtpHost" defaultValue={settings.mail.smtp.host ?? ""} />
              </label>
              <div className="uwe-form-row uwe-form-row-2">
                <label>
                  Port
                  <input
                    name="smtpPort"
                    type="number"
                    defaultValue={settings.mail.smtp.port ?? 587}
                  />
                </label>
                <label>
                  Absender (MAIL_FROM)
                  <input name="mailFrom" defaultValue={settings.mail.smtp.fromAddress ?? ""} />
                </label>
              </div>
              <label>
                SMTP-Benutzer
                <input name="smtpUser" defaultValue={settings.mail.smtp.username ?? ""} autoComplete="off" />
              </label>
              <label>
                SMTP-Passwort
                <input
                  name="smtpPassword"
                  type="password"
                  placeholder={
                    settings.mail.smtp.passwordConfigured
                      ? "Leer = bestehendes Passwort"
                      : "Passwort eingeben"
                  }
                  autoComplete="new-password"
                />
              </label>
              <label className="uwe-checkbox">
                <input type="checkbox" name="smtpSecure" defaultChecked={settings.mail.smtp.secure} />
                TLS/SSL
              </label>
              <label className="uwe-checkbox">
                <input type="checkbox" name="smtpUseMock" defaultChecked={settings.mail.smtp.useMock} />
                Mock-Modus
              </label>
              <label className="uwe-checkbox">
                <input type="checkbox" name="clearPortalSmtp" />
                Portal-SMTP löschen (.env-Fallback)
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Speichern
              </button>
            </form>
          )}

          {activeTab === "mail" && section.testAction && (
            <OwnerSetupTestPanel
              action={section.testAction}
              canEdit={canEdit}
              defaultEmail={user?.email ?? ""}
            />
          )}

          {activeTab === "rtx" && (
            <>
              <p style={{ marginTop: "1rem" }}>
                <Link href="/system/rtx-connector" className="uwe-v2-btn uwe-v2-btn-secondary">
                  RTX Host Connector verwalten
                </Link>{" "}
                <Link href="/hardware" className="uwe-v2-btn uwe-v2-btn-secondary">
                  Hardware-Cockpit
                </Link>
              </p>
              {section.testAction && (
                <OwnerSetupTestPanel action={section.testAction} canEdit={canEdit} />
              )}
            </>
          )}

          {activeTab === "printer" && section.testAction && (
            <OwnerSetupTestPanel action={section.testAction} canEdit={canEdit} />
          )}

          {activeTab === "diagnose" && (
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
              <Link href="/admin/status" className="uwe-v2-btn uwe-v2-btn-primary">
                Vollständige Diagnose
              </Link>
              <Link href="/admin/secrets" className="uwe-v2-btn">
                Secrets-Status
              </Link>
              <Link href="/system?tab=diagnose" className="uwe-v2-btn">
                System-Hub Diagnose
              </Link>
              <Link href="/api/admin/status" className="uwe-v2-btn">
                Status JSON
              </Link>
            </div>
          )}
        </OwnerSetupSectionView>
      )}
    </SystemShell>
  );
}
