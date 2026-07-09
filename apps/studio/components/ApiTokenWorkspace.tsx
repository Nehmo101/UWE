"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDate } from "@/src/lib/format";

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
      <section className="uwe-v2-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Neuen API-Token erstellen</h2>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="z.B. n8n Integration" />
        </label>
        <label>
          Ablauf
          <select
            value={expiryPreset}
            onChange={(event) => setExpiryPreset(event.target.value as ExpiryPreset)}
          >
            <option value="30">30 Tage</option>
            <option value="90">90 Tage</option>
            <option value="365">1 Jahr</option>
            <option value="never">Kein Ablauf</option>
          </select>
        </label>
        <fieldset>
          <legend>Scopes (eng halten)</legend>
          <div className="uwe-form-grid">
            {scopes.map((scope) => (
              <label key={scope.value} className="uwe-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.value)}
                  onChange={() => toggleScope(scope.value)}
                />
                {scope.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" className="uwe-v2-btn uwe-v2-btn-primary" onClick={() => void createToken()}>
          Token erstellen
        </button>
        {createdToken && (
          <div className="uwe-notice uwe-notice-warn" style={{ marginTop: "1rem" }}>
            <p>
              <strong>Token (nur einmal sichtbar):</strong> <code>{createdToken}</code>
            </p>
            <button type="button" className="uwe-v2-btn uwe-v2-btn-sm" onClick={() => void copyCreatedToken()}>
              {copied ? "Kopiert" : "In Zwischenablage kopieren"}
            </button>
          </div>
        )}
      </section>

      {error && <p className="uwe-notice uwe-notice-error">{error}</p>}

      <section className="uwe-v2-card">
        <h2>Aktive Tokens ({tokens.length})</h2>
        {loading ? (
          <p className="uwe-dashboard-muted">Lade…</p>
        ) : tokens.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine API-Tokens vorhanden.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Ablauf</th>
                <th>Letzte Nutzung</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => {
                const expired =
                  token.expiresAt != null && new Date(token.expiresAt).getTime() <= Date.now();
                return (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td>
                      <code>{token.tokenPrefix}…</code>
                    </td>
                    <td>{token.scopes.join(", ")}</td>
                    <td>{tokenExpiryLabel(token)}</td>
                    <td>{token.lastUsedAt ? formatStudioDate(token.lastUsedAt) : "—"}</td>
                    <td>
                      {!token.isActive ? "widerrufen" : expired ? "abgelaufen" : "aktiv"}
                    </td>
                    <td>
                      {token.isActive && (
                        <button type="button" className="uwe-v2-btn uwe-v2-btn-ghost" onClick={() => void revokeToken(token.id)}>
                          Widerrufen
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
