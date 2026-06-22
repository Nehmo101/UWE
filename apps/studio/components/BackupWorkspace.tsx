"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useMemo, useState } from "react";
import { waitForJob } from "@/src/lib/poll-job";
import { formatStudioDate } from "@/src/lib/format";

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

interface Props {
  initialBackups: StoredBackup[];
  defaultWorldSlug?: string;
  defaultCampaignSlug?: string;
}

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
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState<string>("");
  const [uploadBase64, setUploadBase64] = useState<string>("");
  const [uploadFilename, setUploadFilename] = useState<string>("");
  const [permissions, setPermissions] = useState<BackupPermissions | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [sendPasswordSetupEmails, setSendPasswordSetupEmails] = useState(false);
  const [showRestoreWarning, setShowRestoreWarning] = useState(false);

  useEffect(() => {
    async function loadPermissions() {
      const response = await fetch(studioApiUrl("/api/backup?permissions=1"));
      if (response.ok) {
        setPermissions(await response.json());
      }
    }
    void loadPermissions();
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
        await waitForJob(data.job.id);
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

    if (!restoreConfirmed) {
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
      setRestoreConfirmed(false);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Restore fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="uwe-backup-workspace">
      {permissions && (
        <p className="uwe-hint" style={{ marginBottom: "1rem" }}>
          Rolle: <strong>{permissions.role}</strong> · Aufbewahrung: letzte{" "}
          {permissions.retentionCount} Backups
          {permissions.encryptionConfigured ? " · Verschlüsselung aktiv (ENV)" : ""}
        </p>
      )}

      {permissions?.canCreate && (
      <section className="uwe-panel" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Backup erstellen</h2>
        <div className="uwe-filter-bar" style={{ marginBottom: "1rem" }}>
          {(["full", "world", "campaign"] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={backupType === type ? "active" : undefined}
              onClick={() => setBackupType(type)}
            >
              {type === "full" ? "Vollständig" : type === "world" ? "Welt" : "Kampagne"}
            </button>
          ))}
        </div>

        {(backupType === "world" || backupType === "campaign") && (
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            Welt-Slug
            <input
              className="uwe-input"
              value={worldSlug}
              onChange={(event) => setWorldSlug(event.target.value)}
              placeholder="terra"
            />
          </label>
        )}

        {backupType === "campaign" && (
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            Kampagnen-Slug
            <input
              className="uwe-input"
              value={campaignSlug}
              onChange={(event) => setCampaignSlug(event.target.value)}
              placeholder="hauptkampagne"
            />
          </label>
        )}

        <label style={{ display: "block", marginBottom: "1rem" }}>
          Format
          <select
            className="uwe-input"
            value={format}
            onChange={(event) => setFormat(event.target.value as "zip" | "json")}
          >
            <option value="zip">ZIP (Daten + Assets)</option>
            <option value="json">JSON (nur Metadaten)</option>
          </select>
        </label>

        <button
          type="button"
          className="uwe-btn uwe-btn-primary"
          disabled={busy === "create"}
          onClick={createBackup}
        >
          {busy === "create" ? "Erstelle…" : "Backup erstellen"}
        </button>
      </section>
      )}

      <section className="uwe-panel" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Gespeicherte Backups</h2>
        {backups.length === 0 ? (
          <p className="wiki-empty">Noch keine Backups vorhanden.</p>
        ) : (
          <div className="uwe-table-wrap">
            <table className="uwe-table">
              <thead>
                <tr>
                  <th>Datei</th>
                  <th>Typ</th>
                  <th>Inhalt</th>
                  <th>Erstellt</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>{backup.filename}</td>
                    <td>{backup.manifest.type}</td>
                    <td>
                      {backup.manifest.stats.worlds} Welten · {backup.manifest.stats.pages} Seiten ·{" "}
                      {backup.manifest.stats.assets} Assets
                    </td>
                    <td>{formatStudioDate(backup.manifest.createdAt)}</td>
                    <td style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {permissions?.canDownload && (
                        <button
                          type="button"
                          className="uwe-btn"
                          disabled={busy === "download"}
                          onClick={() => downloadBackup(backup.id, backup.filename)}
                        >
                          Download
                        </button>
                      )}
                      {permissions?.canPreview && (
                      <button
                        type="button"
                        className="uwe-btn"
                        onClick={() => {
                          setSelectedBackupId(backup.id);
                          setUploadBase64("");
                          setUploadFilename("");
                          setPreview(null);
                          setResult(null);
                          setRestoreConfirmed(false);
                        }}
                      >
                        Für Restore wählen
                      </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {permissions?.canPreview && (
      <section className="uwe-panel">
        <h2 style={{ marginTop: 0 }}>Backup importieren &amp; wiederherstellen</h2>
        <p className="uwe-import-alerts" style={{ marginTop: 0, padding: 0, background: "none", border: "none" }}>
          <strong style={{ color: "var(--uwe-warning)" }}>Warnung:</strong> Ein Restore überschreibt bestehende Daten. Vor jedem Restore wird
          automatisch eine Sicherheitskopie erstellt. Nur OWNER dürfen Restore ausführen.
        </p>
        <p className="uwe-hint">
          Secrets, Passwörter, Auth-Sessions und API-Keys werden nicht exportiert oder importiert.
        </p>

        <label style={{ display: "block", marginBottom: "1rem" }}>
          Backup-Datei hochladen (.zip oder .json)
          <input
            type="file"
            accept=".zip,.json,application/zip,application/json"
            onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
          />
        </label>

        {selectedBackupId && (
          <p style={{ marginBottom: "1rem" }}>
            Ausgewähltes Backup: <strong>{selectedBackupId}</strong>
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button
            type="button"
            className="uwe-btn"
            disabled={busy === "preview" || (!selectedBackupId && !uploadBase64)}
            onClick={runPreview}
          >
            {busy === "preview" ? "Analysiere…" : "Preview anzeigen"}
          </button>
          {permissions?.canRestore && (
          <button
            type="button"
            className="uwe-btn uwe-btn-primary"
            disabled={busy === "restore" || !preview}
            onClick={runRestore}
          >
            {busy === "restore" ? "Stelle wieder her…" : "Restore bestätigen"}
          </button>
          )}
        </div>

        {showRestoreWarning && (
          <div
            className="uwe-import-alerts"
            style={{ marginBottom: "1rem" }}
          >
            <h3 style={{ marginTop: 0 }}>Restore wirklich ausführen?</h3>
            <p>
              Dieser Vorgang kann bestehende Welten, Seiten und Medien verändern. Eine
              Sicherheitskopie wird vorab erstellt, trotzdem solltest du dir sicher sein.
            </p>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
              <input
                type="checkbox"
                checked={restoreConfirmed}
                onChange={(event) => setRestoreConfirmed(event.target.checked)}
              />
              Ich verstehe die Risiken und möchte den Restore ausführen.
            </label>
            <label style={{ display: "block", margin: "0.75rem 0" }}>
              <input
                type="checkbox"
                checked={sendPasswordSetupEmails}
                onChange={(event) => setSendPasswordSetupEmails(event.target.checked)}
              />
              Passwort-Setup-Mails an wiederhergestellte Benutzer senden (SMTP erforderlich)
            </label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="uwe-btn uwe-btn-primary"
                disabled={!restoreConfirmed || busy === "restore"}
                onClick={runRestore}
              >
                Restore endgültig starten
              </button>
              <button
                type="button"
                className="uwe-btn"
                onClick={() => {
                  setShowRestoreWarning(false);
                  setRestoreConfirmed(false);
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {preview && (
          <div style={{ marginBottom: "1rem" }}>
            <h3>Vorschau</h3>
            <p>{previewSummary}</p>
            {preview.warnings.length > 0 && (
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div className="uwe-table-wrap">
              <table className="uwe-table">
                <thead>
                  <tr>
                    <th>Typ</th>
                    <th>Bezeichner</th>
                    <th>Status</th>
                    <th>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.slice(0, 50).map((item) => (
                    <tr key={`${item.entityType}-${item.identifier}-${item.status}`}>
                      <td>{item.entityType}</td>
                      <td>{item.identifier}</td>
                      <td>{item.status}</td>
                      <td>{item.message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div>
            <h3>Ergebnis</h3>
            <p>
              {result.created} erstellt · {result.updated} aktualisiert · {result.skipped} übersprungen ·{" "}
              {result.failed} fehlgeschlagen
            </p>
            {result.errors.length > 0 && (
              <div>
                <h4>Fehlerprotokoll</h4>
                <ul>
                  {result.errors.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
            {(result.usersNeedingPassword?.length ?? 0) > 0 && (
              <div>
                <h4>Benutzer ohne Passwort</h4>
                <p>
                  Diese Konten wurden ohne Passwort wiederhergestellt. Nutzer müssen{" "}
                  <strong>/forgot-password</strong> verwenden oder ein Admin sendet Setup-Mails beim
                  Restore.
                </p>
                <ul>
                  {result.usersNeedingPassword!.map((email) => (
                    <li key={email}>{email}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
      )}

      {error && (
        <p className="uwe-error-alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
