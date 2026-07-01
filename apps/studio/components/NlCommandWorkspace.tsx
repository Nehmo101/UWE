"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDateTime } from "@/src/lib/format";

interface NlCommandIntentPayload {
  intent:
    | "set_maintenance_mode"
    | "set_lock_portal"
    | "set_lock_studio"
    | "list_users"
    | "list_worlds"
    | "list_open_bugs"
    | "get_secrets_status"
    | "get_migration_status"
    | "list_pending_migrations";
  enabled?: boolean;
  message?: string;
}

interface ParseSuccessResponse {
  ok: true;
  intent: NlCommandIntentPayload;
  requiresConfirmation: boolean;
  confirmationMessage: string;
  confirmationToken: string;
  confirmationIssuedAt: number;
}

interface ParseErrorResponse {
  ok: false;
  error: string;
  code: string;
}

interface ExecuteSuccessResponse {
  ok: true;
  intent: string;
  summary: string;
  data?: unknown;
}

interface ExecuteErrorResponse {
  ok: false;
  error: string;
  code: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actorUserId: string | null;
  actionLabel: string;
  intent: string | null;
  summary: string | null;
  readOnly: boolean;
}

const EXAMPLE_COMMANDS = [
  "Zeige alle Benutzer",
  "list worlds",
  "list open bugs",
  "secrets status",
  "pending migrations",
  "migration status",
  "Wartungsmodus aktivieren",
  "lock portal",
  "unlock studio",
];

export function NlCommandWorkspace() {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseSuccessResponse | null>(null);
  const [result, setResult] = useState<ExecuteSuccessResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const response = await fetch(studioApiUrl("/api/admin/command/audit?limit=20"));
      if (!response.ok) {
        throw new Error(`Audit konnte nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as { entries: AuditEntry[] };
      setAuditEntries(data.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Audit-Ladefehler.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  async function handleParse(event: React.FormEvent) {
    event.preventDefault();
    setParsing(true);
    setError(null);
    setParsed(null);
    setResult(null);

    try {
      const response = await fetch(studioApiUrl("/api/admin/command/parse"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as ParseSuccessResponse | ParseErrorResponse;
      if (!response.ok || !data.ok) {
        const message = data.ok ? "Parsing fehlgeschlagen." : data.error;
        throw new Error(message);
      }
      setParsed(data);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Parsing fehlgeschlagen.");
    } finally {
      setParsing(false);
    }
  }

  async function handleExecute() {
    if (!parsed) return;

    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(studioApiUrl("/api/admin/command/execute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: parsed.intent,
          confirmationToken: parsed.requiresConfirmation ? parsed.confirmationToken : null,
          confirmationIssuedAt: parsed.requiresConfirmation ? parsed.confirmationIssuedAt : null,
        }),
      });
      const data = (await response.json()) as ExecuteSuccessResponse | ExecuteErrorResponse;
      if (!response.ok || !data.ok) {
        const message = data.ok ? "Ausführung fehlgeschlagen." : data.error;
        throw new Error(message);
      }
      setResult(data);
      setParsed(null);
      setText("");
      await loadAudit();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Ausführung fehlgeschlagen.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="uwe-v2-stack">
      <section className="uwe-v2-card">
        <h2 className="uwe-v2-section-title">Admin-Befehl</h2>
        <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
          Whitelist-basierte Befehle — strukturierter Intent, Klartext-Bestätigung vor Mutationen
          (Wartungsmodus, Portal-/Studio-Sperre), Ausführung über bestehende Services. Lesen: Benutzer,
          Welten, offene Bugs, Secrets-Status, Migrationen. Kein freies LLM-Tool-Calling.
        </p>

        <form onSubmit={handleParse} className="uwe-v2-stack">
          <label className="uwe-v2-label" htmlFor="nl-command-input">
            Befehl (Deutsch oder Englisch)
          </label>
          <input
            id="nl-command-input"
            className="uwe-v2-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="z. B. Zeige alle Benutzer"
            autoComplete="off"
            spellCheck={false}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="submit"
              className="uwe-v2-btn uwe-v2-btn-primary"
              disabled={parsing || !text.trim()}
            >
              {parsing ? "Analysiere…" : "Intent parsen"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: "1rem" }}>
          <p className="uwe-dashboard-muted">Beispiele:</p>
          <ul className="uwe-dashboard-list">
            {EXAMPLE_COMMANDS.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-ghost"
                  onClick={() => setText(example)}
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {error ? (
        <div className="uwe-form-error" role="alert">
          {error}
        </div>
      ) : null}

      {parsed ? (
        <section className="uwe-v2-card">
          <h2 className="uwe-v2-section-title">Bestätigung</h2>
          <dl className="uwe-dl">
            <div>
              <dt>Intent</dt>
              <dd>
                <code>{parsed.intent.intent}</code>
              </dd>
            </div>
            {parsed.intent.intent === "set_maintenance_mode" ||
            parsed.intent.intent === "set_lock_portal" ||
            parsed.intent.intent === "set_lock_studio" ? (
              <div>
                <dt>Aktion</dt>
                <dd>
                  {parsed.intent.intent === "set_maintenance_mode"
                    ? "Wartungsmodus"
                    : parsed.intent.intent === "set_lock_portal"
                      ? "Portal-Sperre"
                      : "Studio-Sperre"}
                  {": "}
                  {parsed.intent.enabled ? "aktivieren" : "deaktivieren"}
                </dd>
              </div>
            ) : null}
          </dl>
          <p>{parsed.confirmationMessage}</p>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={() => void handleExecute()}
            disabled={executing}
          >
            {executing
              ? "Führe aus…"
              : parsed.requiresConfirmation
                ? "Bestätigen und ausführen"
                : "Ausführen"}
          </button>
        </section>
      ) : null}

      {result ? (
        <section className="uwe-v2-card">
          <h2 className="uwe-v2-section-title">Ergebnis</h2>
          <p>{result.summary}</p>
          {result.data ? (
            <pre
              className="uwe-v2-code-block"
              style={{ marginTop: "0.75rem", overflow: "auto", maxHeight: "24rem" }}
            >
              {JSON.stringify(result.data, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}

      <section className="uwe-v2-card">
        <h2 className="uwe-v2-section-title">Letzte NL-Befehle (Audit)</h2>
        {auditLoading ? (
          <p className="uwe-dashboard-muted">Lade Audit-Einträge…</p>
        ) : auditEntries.length === 0 ? (
          <p className="uwe-dashboard-muted">Noch keine NL-Befehle ausgeführt.</p>
        ) : (
          <ul className="uwe-dashboard-list">
            {auditEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.intent ?? entry.actionLabel}</strong>
                {entry.readOnly ? " · lesen" : " · Mutation"}
                <p>
                  {formatStudioDateTime(new Date(entry.timestamp))}
                  {entry.summary ? ` · ${entry.summary}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
