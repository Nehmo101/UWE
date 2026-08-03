import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

type Props = {
  onLoadLogs: (category?: string) => Promise<string[]>;
};

const LOG_CATEGORIES = ["", "connection", "models", "downloads", "jobs", "error", "security"];

function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Unbekannter Fehler";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "Unbekannter Fehler";
}

export function LogsPanel({ onLoadLogs }: Props) {
  const [category, setCategory] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadLogs = useCallback(async (nextCategory = category) => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const nextLines = await onLoadLogs(nextCategory || undefined);
      setLines(nextLines);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, [category, onLoadLogs]);

  useEffect(() => {
    void loadLogs("");
  }, [loadLogs]);

  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setNotice("Logs in die Zwischenablage kopiert.");
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }

  const title = useMemo(
    () => (category ? `Kategorie: ${category}` : "Alle Kategorien"),
    [category],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connector-Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="connector-stack">
          <p className="connector-muted">
            {title}. Es werden nur redigierte lokale Connector-Logs angezeigt, nie Tokens oder Payloads.
          </p>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          {lines.length === 0 ? (
            <div className="connector-empty-state">Keine Logs für den aktuellen Filter gefunden.</div>
          ) : (
            <pre className="connector-log-output">{lines.join("\n")}</pre>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="connector-actions">
          <label className="connector-field">
            <span>Kategorie</span>
            <select
              className="connector-select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {LOG_CATEGORIES.map((value) => (
                <option key={value || "all"} value={value}>
                  {value || "Alle"}
                </option>
              ))}
            </select>
          </label>
          <Button variant="ghost" onClick={() => void loadLogs()} disabled={busy}>
            Filtern
          </Button>
          <Button variant="secondary" onClick={copyLogs} disabled={busy || lines.length === 0}>
            Kopieren
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
