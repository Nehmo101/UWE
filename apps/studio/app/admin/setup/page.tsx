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
import { Alert, badgeVariants, Button, buttonVariants, cn, Input, Label } from "@/src/components/ui";
import { updateOwnerSetupAction } from "../../owner-setup-actions";

const TABS = [
  { id: "system", label: "System" },
  { id: "access", label: "Zugriff" },
  { id: "cloudflare", label: "Cloudflare & Domains" },
  { id: "brain", label: "Brain (privat)" },
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
        title="Einrichtung (Host & Owner)"
        summary="Checkliste für Self-Hosting: Status, Secrets, Tests und Diagnose. Laufende Betriebs-Konfiguration hier; einmaliges Erst-Setup unter /setup. Theme, Welten und erweiterte App-Optionen → Einstellungen."
        actions={
          <HealthBadge
            status={snapshot.ok ? "ok" : "degraded"}
            label={canEdit ? "Owner" : "Nur Lesen"}
          />
        }
      />
      {!canEdit && (
        <Alert tone="info" className="mb-4">
          Du siehst die Einrichtung im Lesemodus. Nur <strong>OWNER</strong> darf speichern und
          Tests ausführen.
        </Alert>
      )}

      {saved === "1" && (
        <Alert tone="success" className="mb-4">
          Einrichtung gespeichert.
        </Alert>
      )}

      <Alert tone="info" className="mb-4">
        <strong>Erstinstallation:</strong> einmaliges Owner-Setup über{" "}
        <Link href="/setup">/setup</Link>. Diese Seite ist für nachträgliche Host-Konfiguration
        (SMTP, Cloudflare, RTX, Pfade).
      </Alert>

      <Alert tone="info" className="mb-4">
        Für Theme, Welten und erweiterte App-Optionen: <Link href="/settings">Einstellungen</Link>
        {" · "}
        <Link href="/admin/checklist">Aufgabenliste</Link>
      </Alert>

      <nav className="flex flex-wrap gap-2" aria-label="Einrichtungsbereiche">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "system" ? "/admin/setup" : `/admin/setup?tab=${tab.id}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={cn(
              badgeVariants({ variant: activeTab === tab.id ? "accent" : "default" }),
              "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {section && (
        <OwnerSetupSectionView section={section}>
          {activeTab === "system" && canEdit && (
            <form action={updateOwnerSetupAction} className="flex flex-col gap-4" id="paths">
              <input type="hidden" name="tab" value="system" />
              <h3 className="text-lg font-semibold tracking-tight">Speicher & Backup (Datenbank)</h3>
              <p className="text-sm text-muted-foreground">
                Pfade werden in der Datenbank gespeichert — keine manuelle Host-Datei nötig.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-system-uploads">Uploads-Pfad</Label>
                <Input id="setup-system-uploads" name="uploadsPath" defaultValue={uploadsPath} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-system-exports">Exports-Pfad</Label>
                <Input id="setup-system-exports" name="exportsPath" defaultValue={exportsPath} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-system-backups">Backup-Pfad</Label>
                <Input id="setup-system-backups" name="backupsPath" defaultValue={backupsPath} />
              </div>
              {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="autoBackupEnabled"
                  defaultChecked={settings.backup.autoBackupEnabled}
                  className="size-4 rounded border-input"
                />
                Automatisches Backup aktivieren
              </label>
              <div>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          )}

          {activeTab === "access" && canEdit && (
            <form action={updateOwnerSetupAction} className="flex flex-col gap-4" id="portal">
              <input type="hidden" name="tab" value="access" />
              <h3 className="text-lg font-semibold tracking-tight">Portal & Session</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="portalEnabled"
                  defaultChecked={settings.portal.portalEnabled}
                  className="size-4 rounded border-input"
                />
                Portal aktiv
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="guestAccessEnabled"
                  defaultChecked={settings.portal.guestAccessEnabled}
                  className="size-4 rounded border-input"
                />
                Gastzugang
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="publicSharingEnabled"
                  defaultChecked={settings.portal.publicSharingEnabled}
                  className="size-4 rounded border-input"
                />
                Öffentliche Freigabe
              </label>
              <div className="flex flex-col gap-1.5" id="session">
                <Label htmlFor="setup-access-session-timeout">
                  Session-Timeout (Minuten, 0 = aus)
                </Label>
                <Input
                  id="setup-access-session-timeout"
                  type="number"
                  name="sessionInactivityTimeoutMinutes"
                  min={0}
                  max={1440}
                  defaultValue={settings.auth.sessionInactivityTimeoutMinutes}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Benutzer und Rollen: <Link href="/admin/users">Benutzerverwaltung</Link>
              </p>
              <div>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          )}

          {activeTab === "cloudflare" && section.testAction && (
            <OwnerSetupTestPanel action={section.testAction} canEdit={canEdit} />
          )}

          {activeTab === "brain" && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Der private Brain-Bereich (Daily Admin OS &amp; Personal Brain) ist owner-only und
                bleibt lokal bzw. im LAN — nie im öffentlichen Cloudflare-Tunnel. Erreichbarkeit,
                Brain-URL und Einstiegspfad werden unter System → Cloudflare gepflegt.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/system/cloudflare" className={buttonVariants({ variant: "secondary" })}>
                  Brain-Einstellungen (System → Cloudflare)
                </Link>
                <Link href="/life-brain" className={buttonVariants({ variant: "outline" })}>
                  Brain öffnen
                </Link>
              </div>
            </div>
          )}

          {activeTab === "mail" && canEdit && (
            <form action={updateOwnerSetupAction} className="flex flex-col gap-4" id="smtp">
              <input type="hidden" name="tab" value="mail" />
              <h3 className="text-lg font-semibold tracking-tight">SMTP (Datenbank, verschlüsselt)</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="mailEnabled"
                  defaultChecked={settings.mail.enabled}
                  className="size-4 rounded border-input"
                />
                Mail Center aktiv
              </label>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-mail-from-name">Absender-Anzeigename</Label>
                <Input
                  id="setup-mail-from-name"
                  name="fromDisplayName"
                  defaultValue={settings.mail.fromDisplayName}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-mail-smtp-host">SMTP-Host</Label>
                <Input
                  id="setup-mail-smtp-host"
                  name="smtpHost"
                  defaultValue={settings.mail.smtp.host ?? ""}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="setup-mail-smtp-port">Port</Label>
                  <Input
                    id="setup-mail-smtp-port"
                    name="smtpPort"
                    type="number"
                    defaultValue={settings.mail.smtp.port ?? 587}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="setup-mail-from-address">Absender (MAIL_FROM)</Label>
                  <Input
                    id="setup-mail-from-address"
                    name="mailFrom"
                    defaultValue={settings.mail.smtp.fromAddress ?? ""}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-mail-smtp-user">SMTP-Benutzer</Label>
                <Input
                  id="setup-mail-smtp-user"
                  name="smtpUser"
                  defaultValue={settings.mail.smtp.username ?? ""}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-mail-smtp-password">SMTP-Passwort</Label>
                <Input
                  id="setup-mail-smtp-password"
                  name="smtpPassword"
                  type="password"
                  placeholder={
                    settings.mail.smtp.passwordConfigured
                      ? "Leer = bestehendes Passwort"
                      : "Passwort eingeben"
                  }
                  autoComplete="new-password"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="smtpSecure"
                  defaultChecked={settings.mail.smtp.secure}
                  className="size-4 rounded border-input"
                />
                TLS/SSL
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="smtpUseMock"
                  defaultChecked={settings.mail.smtp.useMock}
                  className="size-4 rounded border-input"
                />
                Mock-Modus
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="clearPortalSmtp" className="size-4 rounded border-input" />
                Portal-SMTP löschen (.env-Fallback)
              </label>
              <div>
                <Button type="submit">Speichern</Button>
              </div>
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
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/system/rtx-connector" className={buttonVariants({ variant: "secondary" })}>
                  RTX Host Connector verwalten
                </Link>
                <Link href="/hardware" className={buttonVariants({ variant: "secondary" })}>
                  Hardware-Cockpit
                </Link>
              </div>
              {section.testAction && (
                <OwnerSetupTestPanel action={section.testAction} canEdit={canEdit} />
              )}
            </>
          )}

          {activeTab === "printer" && section.testAction && (
            <OwnerSetupTestPanel action={section.testAction} canEdit={canEdit} />
          )}

          {activeTab === "diagnose" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/system?tab=diagnose" className={buttonVariants()}>
                Vollständige Diagnose
              </Link>
              <Link href="/admin/status" className={buttonVariants({ variant: "outline" })}>
                Erweiterte Karten
              </Link>
              <Link href="/admin/secrets" className={buttonVariants({ variant: "outline" })}>
                Secrets-Status
              </Link>
              <Link href="/system?tab=diagnose" className={buttonVariants({ variant: "outline" })}>
                System-Hub Diagnose
              </Link>
              <Link href="/api/admin/status" className={buttonVariants({ variant: "outline" })}>
                Status JSON
              </Link>
            </div>
          )}
        </OwnerSetupSectionView>
      )}
    </SystemShell>
  );
}
