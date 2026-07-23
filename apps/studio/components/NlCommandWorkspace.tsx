"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDateTime } from "@/src/lib/format";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";

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
    | "list_pending_migrations"
    | "assign_world_role"
    | "remove_world_membership"
    | "disable_user"
    | "enable_user"
    | "invite_user"
    | "create_world"
    | "set_user_role"
    | "list_world_members"
    | "delete_user"
    | "reset_password";
  enabled?: boolean;
  message?: string;
  userQuery?: string;
  worldQuery?: string;
  role?: string;
  email?: string;
  displayName?: string;
  worldRole?: string;
  name?: string;
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
  "Mach Carina zur Spielerin in Terra",
  "Mach Carina zum Admin",
  "Erstelle eine neue Welt Aventurien",
  "invite player@example.com as player in terra",
  "disable user carina",
  "zeige mitglieder in terra",
  "delete user testplayer",
  "reset password for carina",
  "list open bugs",
  "secrets status",
  "pending migrations",
  "Wartungsmodus aktivieren",
  "lock portal",
];

/** Beispiel-Chips im eingeklappten Zustand — Rest hinter „+ n weitere". */
const EXAMPLE_PREVIEW_COUNT = 5;

export function NlCommandWorkspace({ initialText }: { initialText?: string } = {}) {
  const [text, setText] = useState(initialText ?? "");
  const [parsing, setParsing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseSuccessResponse | null>(null);
  const [result, setResult] = useState<ExecuteSuccessResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [showAllExamples, setShowAllExamples] = useState(false);

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

  const runParse = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setParsing(true);
    setError(null);
    setParsed(null);
    setResult(null);

    try {
      const response = await fetch(studioApiUrl("/api/admin/command/parse"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
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
  }, []);

  function handleParse(event: React.FormEvent) {
    event.preventDefault();
    void runParse(text);
  }

  // Aus der Command-Palette vorbefüllt (?q=): direkt parsen. Ausführung bleibt
  // ein bewusster zweiter Klick — Bestätigungs-/HMAC-Flow unverändert.
  useEffect(() => {
    if (initialText?.trim()) {
      void runParse(initialText);
    }
  }, [initialText, runParse]);

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin-Befehl</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Whitelist-basierte Befehle — strukturierter Intent, Klartext-Bestätigung vor Mutationen
            (Wartungsmodus, Portal-/Studio-Sperre), Ausführung über bestehende Services. Lesen: Benutzer,
            Welten, offene Bugs, Secrets-Status, Migrationen. Kein freies LLM-Tool-Calling.
          </p>

          <form onSubmit={handleParse} className="flex flex-col gap-3">
            <Label htmlFor="nl-command-input">Befehl (Deutsch oder Englisch)</Label>
            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-3 focus-within:border-primary">
              <span aria-hidden="true" className="font-mono font-bold text-primary">
                ›
              </span>
              <Input
                id="nl-command-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="z. B. Zeige alle Benutzer"
                autoComplete="off"
                spellCheck={false}
                className="border-0 bg-transparent px-0 font-mono shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={parsing || !text.trim()}>
                {parsing ? "Analysiere…" : "Intent parsen"}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Beispiele:</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {(showAllExamples
                ? EXAMPLE_COMMANDS
                : EXAMPLE_COMMANDS.slice(0, EXAMPLE_PREVIEW_COUNT)
              ).map((example) => (
                <li key={example}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="font-mono text-xs"
                    onClick={() => setText(example)}
                  >
                    {example}
                  </Button>
                </li>
              ))}
              {EXAMPLE_COMMANDS.length > EXAMPLE_PREVIEW_COUNT ? (
                <li>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="font-mono text-xs text-muted-foreground"
                    onClick={() => setShowAllExamples((current) => !current)}
                  >
                    {showAllExamples
                      ? "weniger anzeigen"
                      : `+ ${EXAMPLE_COMMANDS.length - EXAMPLE_PREVIEW_COUNT} weitere`}
                  </Button>
                </li>
              ) : null}
            </ul>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      {parsed ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Beleg
              {parsed.requiresConfirmation ? (
                <Badge variant="warning">Mutation</Badge>
              ) : (
                <Badge variant="success">Lesen</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2.5">
              <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt className="m-0 font-semibold text-muted-foreground">Intent</dt>
                <dd className="m-0 break-words">
                  <code>{parsed.intent.intent}</code>
                </dd>
              </div>
              {parsed.intent.intent === "set_maintenance_mode" ||
              parsed.intent.intent === "set_lock_portal" ||
              parsed.intent.intent === "set_lock_studio" ? (
                <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-1">
                  <dt className="m-0 font-semibold text-muted-foreground">Aktion</dt>
                  <dd className="m-0 break-words">
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
            <Button type="button" onClick={() => void handleExecute()} disabled={executing} className="self-start">
              {executing
                ? "Führe aus…"
                : parsed.requiresConfirmation
                  ? "Bestätigen und ausführen"
                  : "Ausführen"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Ergebnis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p>{result.summary}</p>
            {result.data ? (
              <pre className="max-h-96 overflow-auto rounded-[var(--radius)] border border-border bg-muted p-3 font-mono text-xs">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Journal (Audit)</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <p className="text-sm text-muted-foreground">Lade Audit-Einträge…</p>
          ) : auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine NL-Befehle ausgeführt.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0 font-mono text-xs">
              {auditEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border py-2 last:border-b-0"
                >
                  <span className="text-muted-foreground">
                    {formatStudioDateTime(new Date(entry.timestamp))}
                  </span>
                  <strong>{entry.intent ?? entry.actionLabel}</strong>
                  {entry.readOnly ? (
                    <Badge variant="success">Lesen</Badge>
                  ) : (
                    <Badge variant="warning">Mutation</Badge>
                  )}
                  {entry.summary ? (
                    <span className="whitespace-pre-line text-muted-foreground">
                      {entry.summary}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
