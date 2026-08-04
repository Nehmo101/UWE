import type { HostBackupEntry, LocalHostLogsResult } from "../../lib/tauri";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";

import { formatBytes } from "./host-format";

/**
 * Auswählbare Host-Logs. „landing" ist die Startseite auf dem Apex-Origin.
 * Es werden bewusst alle Ziele angeboten, auch nicht installierte — eine leere
 * Logdatei ist eine klarere Antwort als ein fehlender Knopf.
 */
export const LOG_TARGETS = [
  { id: "command-center", label: "Einrichtung" },
  { id: "studio", label: "Studio" },
  { id: "portal", label: "Portal" },
  { id: "brain", label: "Brain" },
  { id: "family", label: "Family" },
  { id: "landing", label: "Startseite" },
  { id: "cloudflared", label: "Tunnel" },
] as const satisfies ReadonlyArray<{ id: LocalHostLogsResult["target"]; label: string }>;

interface BackupsProps {
  backups: HostBackupEntry[];
  disabled: boolean;
  canBackup: boolean;
  onCreate: () => void;
  onReload: () => void;
  onRestore: (name: string) => void;
}

export function HostBackupsCard({
  backups,
  disabled,
  canBackup,
  onCreate,
  onReload,
  onRestore,
}: BackupsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Backups</CardTitle>
      </CardHeader>
      <CardContent>
        {backups.length === 0 ? (
          <p className="connector-muted">
            Noch keine Backups. Über „Backup erstellen&quot; wird eines angelegt.
          </p>
        ) : (
          <ul className="command-center-user-list">
            {backups.map((backup) => (
              <li key={backup.name} className="command-center-user-row">
                <div className="command-center-user-main">
                  <div>
                    <strong>{backup.name}</strong>
                    <p className="connector-muted">
                      {formatBytes(backup.sizeBytes)} ·{" "}
                      {new Date(backup.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => onRestore(backup.name)} disabled={disabled}>
                  Wiederherstellen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <div className="connector-actions">
          <Button variant="ghost" onClick={onCreate} disabled={disabled || !canBackup}>
            Backup erstellen
          </Button>
          <Button variant="ghost" onClick={onReload} disabled={disabled}>
            Liste neu laden
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

interface LogsProps {
  target: LocalHostLogsResult["target"];
  lines: string[];
  onSelect: (target: LocalHostLogsResult["target"]) => void;
}

export function HostLogsCard({ target, lines, onSelect }: LogsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Host-Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="connector-actions">
          {LOG_TARGETS.map((entry) => (
            <Button
              key={entry.id}
              variant={target === entry.id ? "secondary" : "ghost"}
              onClick={() => onSelect(entry.id)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
        <pre className="connector-log-output">
          {lines.length ? lines.join("\n") : "Noch keine Logzeilen geladen."}
        </pre>
      </CardContent>
    </Card>
  );
}
