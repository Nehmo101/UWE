"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useMemo, useState } from "react";
import { waitForJob } from "@/src/lib/poll-job";
import { formatStudioDate } from "@/src/lib/format";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";
import { ResponsiveTable } from "@uwe/shared-ui";

interface BackupPermissions {
  role: string;
  canCreate: boolean;
  canDownload: boolean;
  canRestore: boolean;
  canPreview: boolean;
  retentionCount: number;
  encryptionConfigured: boolean;
}

interface StoredBackup {
  id: string;
  filename: string;
  manifest: {
    type: string;
    createdAt: string;
    worldSlug?: string;
    campaignSlug?: string;
    stats: {
      worlds: number;
      pages: number;
      assets: number;
    };
  };
  size: number;
}

interface PreviewItem {
  entityType: string;
  identifier: string;
  status: string;
  message?: string;
}

interface RestorePreview {
  manifest: StoredBackup["manifest"];
  items: PreviewItem[];
  conflicts: PreviewItem[];
  stats: Record<string, number>;
  warnings: string[];
  missingAssets: string[];
}

interface RestoreResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  usersNeedingPassword?: string[];
  items: Array<{ entityType: string; identifier: string; status: string; error?: string }>;
}

interface BackupSchedule {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
}

interface Props {
  initialBackups: StoredBackup[];
  defaultWorldSlug?: string;
  defaultCampaignSlug?: string;
}

const LIST_CLASS = "list-disc space-y-1 pl-5 text-sm";

/** Native select — fester, nicht-leerer Wertebereich, siehe Muster in UserManagementWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function BackupWorkspace({
  initialBackups,
  defaultWorldSlug = "",
  defaultCampaignSlug = "",
}: Props) {
  const [backups, setBackups] = useState(initialBackups);
  const [backupType, setBackupType] = useState<"full" | "world" | "campaign">(
    defaultWorldSlug ? "world" : "full",
  );
  const [worldSlug, setWorldSlug] = useState(defaultWorldSlug);
  const [campaignSlug, setCampaignSlug] = useState(defaultCampaignSlug);
  const [format, setFormat] = useState<"zip" | "json">("zip");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState<string>("");
  const [uploadBase64, setUploadBase64] = useState<string>("");
  const [uploadFilename, setUploadFilename] = useState<string>("");
  const [permissions, setPermissions] = useState<BackupPermissions | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [sendPasswordSetupEmails, setSendPasswordSetupEmails] = useState(false);
  const [showRestoreWarning, setShowRestoreWarning] = useState(false);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  useEffect(() => {
    async function loadPermissions() {
      const response = await fetch(studioApiUrl("/api/backup?permissions=1"));
      if (response.ok) {
        setPermissions(await response.json());
      }
    }
    async function loadSchedule() {
      const response = await fetch(studioApiUrl("/api/backup/schedule"));
      if (response.ok) {
        const data = await response.json();
        setSchedule(data.schedule as BackupSchedule);
      }
    }
    void refreshBackups();
    void loadPermissions();
    void loadSchedule();
  }, []);

  const previewSummary = useMemo(() => {
    if (!preview) return null;
    return `${preview.stats.new} neu · ${preview.conflicts.length} Konflikte · ${preview.missingAssets.length} fehlende Assets`;
  }, [preview]);

  async function refreshBackups() {
    const response = await fetch(studioApiUrl("/api/backup"));
    const data = await response.json();
    if (response.ok) {
      setBackups(data.backups ?? []);
    }
  }

  async function downloadBackup(backupId: string, filename: string) {
    setBusy("download");
    setError(null);

    try {
      const response = await fetch(studioApiUrl(`/api/backup/${encodeURIComponent(backupId)}/download`));
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Download fehlgeschlagen.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Download fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function createBackup() {
    setBusy("create");
    setError(null);
    setCreateSuccess(null);
    setResult(null);

    try {
      const response = await fetch(studioApiUrl("/api/backup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: backupType,
          worldSlug: worldSlug || undefined,
          campaignSlug: campaignSlug || undefined,
          format,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Backup fehlgeschlagen.");
      }

      if (response.status === 202 && data.job?.id) {
        const job = await waitForJob(data.job.id);
        const filename =
          (job.result as { filename?: string } | undefined)?.filename ??
          data.job?.title ??
          "Backup";
        setCreateSuccess(`Backup „${filename}" wurde erstellt.`);
      } else {
        const filename = (data.backup as { filename?: string } | undefined)?.filename;
        setCreateSuccess(
          filename ? `Backup „${filename}" wurde erstellt.` : "Backup wurde erstellt.",
        );
      }

      await refreshBackups();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Backup fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setUploadBase64(arrayBufferToBase64(buffer));
    setUploadFilename(file.name);
    setSelectedBackupId("");
    setPreview(null);
    setResult(null);
  }

  async function runPreview() {
    setBusy("preview");
    setError(null);
    setResult(null);

    try {
      const response = await fetch(studioApiUrl("/api/backup/restore/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupId: selectedBackupId || undefined,
          contentBase64: uploadBase64 || undefined,
          filename: uploadFilename || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Vorschau fehlgeschlagen.");
      }
      setPreview(data.preview);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function runRestore() {
    if (!preview) {
      setError("Bitte zuerst eine Vorschau anzeigen.");
      return;
    }

    if (restoreConfirmText.trim() !== "RESTORE") {
      setShowRestoreWarning(true);
      return;
    }

    setBusy("restore");
    setError(null);
    setShowRestoreWarning(false);

    try {
      const response = await fetch(studioApiUrl("/api/backup/restore/execute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          backupId: selectedBackupId || undefined,
          contentBase64: uploadBase64 || undefined,
          filename: uploadFilename || undefined,
          autoResolveSlugConflicts: true,
          sendPasswordSetupEmails,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Restore fehlgeschlagen.");
      }

      if (response.status === 202 && data.job?.id) {
        const job = await waitForJob(data.job.id);
        setResult((job.result as { result?: RestoreResult })?.result ?? null);
      } else {
        setResult(data.result);
      }
      setRestoreConfirmText("");
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Restore fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function saveSchedule() {
    if (!schedule) return;
    setScheduleBusy(true);
    setScheduleError(null);
    setScheduleSaved(false);

    try {
      const response = await fetch(studioApiUrl("/api/backup/schedule"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Speichern fehlgeschlagen.");
      }
      setSchedule((data as { schedule: BackupSchedule }).schedule);
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 3000);
    } catch (saveError) {
      setScheduleError(saveError instanceof Error ? saveError.message : "Speichern fehlgeschlagen.");
    } finally {
      setScheduleBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {permissions && (
        <p className="text-sm text-muted-foreground">
          Rolle: <strong>{permissions.role}</strong> · Aufbewahrung: letzte{" "}
          {permissions.retentionCount} Backups
          {permissions.encryptionConfigured ? " · Verschlüsselung aktiv (ENV)" : ""}
        </p>
      )}

      {permissions?.canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Backup erstellen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {(["full", "world", "campaign"] as const).map((type) => (
                <Button key={type} type="button" variant={backupType === type ? "default" : "secondary"} onClick={() => setBackupType(type)}>
                  {type === "full" ? "Vollständig" : type === "world" ? "Welt" : "Kampagne"}
                </Button>
              ))}
            </div>

            {(backupType === "world" || backupType === "campaign") && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="backup-world-slug">Welt-Slug</Label>
                <Input id="backup-world-slug" value={worldSlug} onChange={(event) => setWorldSlug(event.target.value)} placeholder="terra" />
              </div>
            )}

            {backupType === "campaign" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="backup-campaign-slug">Kampagnen-Slug</Label>
                <Input id="backup-campaign-slug" value={campaignSlug} onChange={(event) => setCampaignSlug(event.target.value)} placeholder="hauptkampagne" />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-format">Format</Label>
              {/* TODO(design-kit): natives Select — fester Wertebereich, kein Leerwert, siehe Muster in UserManagementWorkspace.tsx. */}
              <select id="backup-format" value={format} onChange={(event) => setFormat(event.target.value as "zip" | "json")} className={NATIVE_SELECT_CLASS}>
                <option value="zip">ZIP (Daten + Assets)</option>
                <option value="json">JSON (nur Metadaten)</option>
              </select>
            </div>

            <Button type="button" disabled={busy === "create"} onClick={createBackup} className="self-start">
              {busy === "create" ? "Erstelle…" : "Backup erstellen"}
            </Button>
            {createSuccess && (
              <Alert tone="success" role="status">
                {createSuccess}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gespeicherte Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            caption="Gespeicherte Backups"
            rowKey={(backup) => backup.id}
            rows={backups}
            columns={[
              { key: "file", label: "Datei", primary: true, render: (backup) => backup.filename },
              { key: "type", label: "Typ", render: (backup) => backup.manifest.type },
              {
                key: "content",
                label: "Inhalt",
                priority: "low",
                render: (backup) =>
                  `${backup.manifest.stats.worlds} Welten · ${backup.manifest.stats.pages} Seiten · ${backup.manifest.stats.assets} Assets`,
              },
              {
                key: "created",
                label: "Erstellt",
                render: (backup) => formatStudioDate(backup.manifest.createdAt),
              },
              {
                key: "actions",
                label: "Aktionen",
                render: (backup) => (
                  <span className="flex flex-wrap gap-2">
                    {permissions?.canDownload && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy === "download"}
                        onClick={() => downloadBackup(backup.id, backup.filename)}
                      >
                        Download
                      </Button>
                    )}
                    {permissions?.canPreview && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedBackupId(backup.id);
                          setUploadBase64("");
                          setUploadFilename("");
                          setPreview(null);
                          setResult(null);
                          setRestoreConfirmText("");
                        }}
                      >
                        Für Restore wählen
                      </Button>
                    )}
                  </span>
                ),
              },
            ]}
            empty={<p className="text-sm text-muted-foreground">Noch keine Backups vorhanden.</p>}
          />
        </CardContent>
      </Card>

      {schedule && permissions?.role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle>Automatische Backups</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* TODO(design-kit): natives Checkbox-Element — Kit hat noch keine Checkbox-Komponente. */}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={schedule.enabled} onChange={(event) => setSchedule({ ...schedule, enabled: event.target.checked })} className="h-4 w-4 rounded border-input" />
              Automatische Backups aktiviert
            </label>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-schedule-frequency">Häufigkeit</Label>
              {/* TODO(design-kit): natives Select — fester Wertebereich, kein Leerwert. */}
              <select
                id="backup-schedule-frequency"
                value={schedule.frequency}
                disabled={!schedule.enabled}
                onChange={(event) => setSchedule({ ...schedule, frequency: event.target.value as BackupSchedule["frequency"] })}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
              </select>
            </div>

            <p className="text-sm text-muted-foreground">
              Der Systemd-Timer läuft täglich um 03:15 Uhr und prüft diese Einstellung.
              Bei wöchentlichem oder monatlichem Plan wird ein Backup nur erstellt, wenn
              die letzte Sicherung älter als 7 bzw. 30 Tage ist.
            </p>

            <div className="flex items-center gap-3">
              <Button type="button" disabled={scheduleBusy} onClick={saveSchedule}>
                {scheduleBusy ? "Speichere…" : "Zeitplan speichern"}
              </Button>
              {scheduleSaved && <span className="text-sm text-success">Gespeichert.</span>}
            </div>
            {scheduleError && (
              <Alert tone="danger" role="alert">
                {scheduleError}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {permissions?.canPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Backup importieren &amp; wiederherstellen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert tone="warning">
              <strong className="text-foreground">Warnung:</strong> Ein Restore überschreibt bestehende Daten.
              Vor jedem Restore wird automatisch eine Sicherheitskopie erstellt. Nur OWNER dürfen Restore
              ausführen.
            </Alert>
            <p className="text-sm text-muted-foreground">
              Secrets, Passwörter, Auth-Sessions und API-Keys werden nicht exportiert oder importiert.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-upload">Backup-Datei hochladen (.zip oder .json)</Label>
              <input id="backup-upload" type="file" accept=".zip,.json,application/zip,application/json" onChange={(event) => handleUpload(event.target.files?.[0] ?? null)} className="text-sm text-foreground" />
            </div>

            {selectedBackupId && (
              <p className="text-sm">
                Ausgewähltes Backup: <strong>{selectedBackupId}</strong>
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy === "preview" || (!selectedBackupId && !uploadBase64)} onClick={runPreview}>
                {busy === "preview" ? "Analysiere…" : "Preview anzeigen"}
              </Button>
              {permissions?.canRestore && (
                <Button type="button" variant="destructive" disabled={busy === "restore" || !preview} onClick={runRestore}>
                  {busy === "restore" ? "Stelle wieder her…" : "Restore bestätigen"}
                </Button>
              )}
            </div>

            {showRestoreWarning && (
              <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-4">
                <h3 className="text-base font-semibold">Restore wirklich ausführen?</h3>
                <p className="text-sm">
                  Dieser Vorgang kann bestehende Welten, Seiten und Medien verändern. Eine
                  Sicherheitskopie wird vorab erstellt, trotzdem solltest du dir sicher sein.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="backup-restore-confirm">
                    Zur Bestätigung <strong>RESTORE</strong> eingeben
                  </Label>
                  <Input id="backup-restore-confirm" type="text" value={restoreConfirmText} onChange={(event) => setRestoreConfirmText(event.target.value)} placeholder="RESTORE" autoComplete="off" spellCheck={false} />
                </div>
                {/* TODO(design-kit): natives Checkbox-Element — Kit hat noch keine Checkbox-Komponente. */}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sendPasswordSetupEmails} onChange={(event) => setSendPasswordSetupEmails(event.target.checked)} className="h-4 w-4 rounded border-input" />
                  Passwort-Setup-Mails an wiederhergestellte Benutzer senden (SMTP erforderlich)
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" disabled={restoreConfirmText.trim() !== "RESTORE" || busy === "restore"} onClick={runRestore}>
                    Restore endgültig starten
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowRestoreWarning(false);
                      setRestoreConfirmText("");
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}

            {preview && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Vorschau</h3>
                <p className="text-sm">{previewSummary}</p>
                {preview.warnings.length > 0 && (
                  <ul className={LIST_CLASS}>
                    {preview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
                <ResponsiveTable
                  caption="Restore-Vorschau"
                  rowKey={(item) => `${item.entityType}-${item.identifier}-${item.status}`}
                  rows={preview.items.slice(0, 50)}
                  columns={[
                    {
                      key: "identifier",
                      label: "Bezeichner",
                      primary: true,
                      render: (item) => item.identifier,
                    },
                    { key: "type", label: "Typ", render: (item) => item.entityType },
                    { key: "status", label: "Status", render: (item) => item.status },
                    { key: "message", label: "Hinweis", render: (item) => item.message ?? "—" },
                  ]}
                />
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Ergebnis</h3>
                <p className="text-sm">
                  {result.created} erstellt · {result.updated} aktualisiert · {result.skipped} übersprungen ·{" "}
                  {result.failed} fehlgeschlagen
                </p>
                {result.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold">Fehlerprotokoll</h4>
                    <ul className={LIST_CLASS}>
                      {result.errors.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.usersNeedingPassword?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold">Benutzer ohne Passwort</h4>
                    <p className="text-sm">
                      Diese Konten wurden ohne Passwort wiederhergestellt. Nutzer müssen{" "}
                      <strong>/forgot-password</strong> verwenden oder ein Admin sendet Setup-Mails beim
                      Restore.
                    </p>
                    <ul className={LIST_CLASS}>
                      {result.usersNeedingPassword!.map((email) => (
                        <li key={email}>{email}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}
    </div>
  );
}
