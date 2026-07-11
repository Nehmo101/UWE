"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";

interface ApiTokenView {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ScopeOption {
  value: string;
  label: string;
}

type ExpiryPreset = "30" | "90" | "365" | "never";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

/** TODO(design-kit): Native select bleibt — kontrollierte Preset-Auswahl,
    siehe gleiches Muster in AuditLogWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function resolveExpiresAt(preset: ExpiryPreset): string | null {
  if (preset === "never") return null;
  const days = Number(preset);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function tokenExpiryLabel(token: ApiTokenView): string {
  if (!token.expiresAt) return "Kein Ablauf";
  const expiresAt = new Date(token.expiresAt);
  if (expiresAt.getTime() <= Date.now()) return "Abgelaufen";
  return formatStudioDate(token.expiresAt);
}

export function ApiTokenWorkspace() {
  const [tokens, setTokens] = useState<ApiTokenView[]>([]);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>("365");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(studioApiUrl("/api/admin/api-tokens"));
      if (!response.ok) {
        throw new Error(`API-Tokens konnten nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as {
        tokens: ApiTokenView[];
        availableScopes: ScopeOption[];
      };
      setTokens(data.tokens);
      setScopes(data.availableScopes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  async function createToken() {
    setError(null);
    setCreatedToken(null);
    setCopied(false);
    const response = await fetch(studioApiUrl("/api/admin/api-tokens"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        scopes: selectedScopes,
        expiresAt: resolveExpiresAt(expiryPreset),
      }),
    });
    const data = (await response.json()) as { plaintextToken?: string; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Token konnte nicht erstellt werden.");
      return;
    }
    setCreatedToken(data.plaintextToken ?? null);
    setName("");
    setSelectedScopes([]);
    await loadTokens();
  }

  async function copyCreatedToken() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
    } catch {
      setError("Kopieren in die Zwischenablage fehlgeschlagen.");
    }
  }

  async function revokeToken(id: string) {
    const response = await fetch(studioApiUrl(`/api/admin/api-tokens/${id}`), { method: "DELETE" });
    if (!response.ok) {
      setError("Widerruf fehlgeschlagen.");
      return;
    }
    await loadTokens();
  }

  function toggleScope(scope: string) {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Neuen API-Token erstellen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-token-name">Name</Label>
            <Input
              id="api-token-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z.B. n8n Integration"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-token-expiry">Ablauf</Label>
            <select
              id="api-token-expiry"
              value={expiryPreset}
              onChange={(event) => setExpiryPreset(event.target.value as ExpiryPreset)}
              className={NATIVE_SELECT_CLASS}
            >
              <option value="30">30 Tage</option>
              <option value="90">90 Tage</option>
              <option value="365">1 Jahr</option>
              <option value="never">Kein Ablauf</option>
            </select>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Scopes (eng halten)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {scopes.map((scope) => (
                <label key={scope.value} className="flex items-center gap-2 text-sm text-foreground">
                  {/* TODO(design-kit): natives Checkbox-Element — Kit hat noch keine Checkbox-Komponente. */}
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="h-4 w-4 rounded border-input"
                  />
                  {scope.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="button" onClick={() => void createToken()} className="self-start">
            Token erstellen
          </Button>
          {createdToken && (
            <Alert tone="warning">
              <p>
                <strong>Token (nur einmal sichtbar):</strong> <code>{createdToken}</code>
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => void copyCreatedToken()}
              >
                {copied ? "Kopiert" : "In Zwischenablage kopieren"}
              </Button>
            </Alert>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert tone="danger" role="alert" className="mb-6">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Aktive Tokens ({tokens.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine API-Tokens vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Name</th>
                    <th className={TH_CLASS}>Prefix</th>
                    <th className={TH_CLASS}>Scopes</th>
                    <th className={TH_CLASS}>Ablauf</th>
                    <th className={TH_CLASS}>Letzte Nutzung</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS} />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => {
                    const expired =
                      token.expiresAt != null && new Date(token.expiresAt).getTime() <= Date.now();
                    return (
                      <tr key={token.id}>
                        <td className={TD_CLASS}>{token.name}</td>
                        <td className={TD_CLASS}>
                          <code>{token.tokenPrefix}…</code>
                        </td>
                        <td className={TD_CLASS}>{token.scopes.join(", ")}</td>
                        <td className={TD_CLASS}>{tokenExpiryLabel(token)}</td>
                        <td className={TD_CLASS}>{token.lastUsedAt ? formatStudioDate(token.lastUsedAt) : "—"}</td>
                        <td className={TD_CLASS}>
                          {!token.isActive ? "widerrufen" : expired ? "abgelaufen" : "aktiv"}
                        </td>
                        <td className={TD_CLASS}>
                          {token.isActive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void revokeToken(token.id)}
                            >
                              Widerrufen
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
